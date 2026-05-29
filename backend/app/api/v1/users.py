from fastapi import BackgroundTasks, Request, status, APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from ...core import models, schemas
from ...core.config import settings
from ..deps import get_db, get_current_user, require_admin_user
from ...services.email_service import (
    sendEmailChangeEmail,
    sendPasswordChangeEmail,
    sendResetPasswordEmail,
    sendVerifyEmail,
    sendWelcomeEmail,
)
from passlib.context import CryptContext
from datetime import datetime, timedelta
import hashlib
import logging
import secrets
import uuid

# Optimize bcrypt for faster verification (reduce rounds for development)
pwd_context = CryptContext(
    schemes=["bcrypt"], 
    deprecated="auto",
    bcrypt__default_rounds=10  # Reduced from default 12 for better performance
)

logger = logging.getLogger(__name__)

router = APIRouter()

_DUMMY_BCRYPT_HASH = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"


def _utcnow() -> datetime:
    # Database columns use timezone-naive DateTime, so keep comparisons naive UTC.
    return datetime.utcnow()


def _hash_value(value: str) -> str:
    payload = f"{settings.SECRET_KEY}:{value}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _client_ip_hash(request: Request) -> str:
    client_ip = request.client.host if request.client else "unknown"
    return _hash_value(client_ip)


def _user_agent_fingerprint(request: Request) -> str:
    user_agent = request.headers.get("user-agent", "unknown")
    return _hash_value(user_agent)


def _device_nickname_from_request(request: Request) -> str | None:
    user_agent = (request.headers.get("user-agent") or "").strip()
    if not user_agent:
        return None
    return user_agent[:120]


def _region_hint_from_request(request: Request) -> str | None:
    hinted = (
        request.headers.get("x-region")
        or request.headers.get("x-country")
        or request.headers.get("cf-ipcountry")
    )
    value = (hinted or "unknown").strip()
    return value[:80] if value else None


def _find_or_create_login_attempt(db: Session, username: str, source_ip_hash: str) -> models.LoginAttempt:
    attempt = (
        db.query(models.LoginAttempt)
        .filter(
            models.LoginAttempt.username == username,
            models.LoginAttempt.source_ip_hash == source_ip_hash,
        )
        .first()
    )
    if attempt:
        return attempt

    attempt = models.LoginAttempt(
        username=username,
        source_ip_hash=source_ip_hash,
        window_start=_utcnow(),
        failed_count=0,
    )
    db.add(attempt)
    db.flush()
    return attempt


def _enforce_login_rate_limit(db: Session, username: str, source_ip_hash: str) -> None:
    now = _utcnow()
    window_start_cutoff = now - timedelta(minutes=settings.LOGIN_RATE_LIMIT_WINDOW_MINUTES)

    ip_failures = (
        db.query(models.LoginAttempt)
        .filter(
            models.LoginAttempt.source_ip_hash == source_ip_hash,
            models.LoginAttempt.window_start >= window_start_cutoff,
        )
        .with_entities(models.LoginAttempt.failed_count)
        .all()
    )
    total_ip_failures = sum(row.failed_count for row in ip_failures)
    if total_ip_failures >= settings.LOGIN_RATE_LIMIT_IP_HARD_CAP:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts from this network. Please try again later.",
        )

    attempt = _find_or_create_login_attempt(db, username=username, source_ip_hash=source_ip_hash)
    if attempt.window_start < window_start_cutoff:
        attempt.window_start = now
        attempt.failed_count = 0
        attempt.blocked_until = None

    if attempt.blocked_until and attempt.blocked_until > now:
        retry_after = max(1, int((attempt.blocked_until - now).total_seconds()))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Login temporarily blocked due to failed attempts. Retry in {retry_after} seconds.",
        )


def _register_failed_login(db: Session, username: str, source_ip_hash: str) -> None:
    now = _utcnow()
    window_start_cutoff = now - timedelta(minutes=settings.LOGIN_RATE_LIMIT_WINDOW_MINUTES)
    attempt = _find_or_create_login_attempt(db, username=username, source_ip_hash=source_ip_hash)

    if attempt.window_start < window_start_cutoff:
        attempt.window_start = now
        attempt.failed_count = 0
        attempt.blocked_until = None

    attempt.failed_count += 1
    attempt.updated_at = now

    threshold = settings.LOGIN_RATE_LIMIT_ACCOUNT_THRESHOLD
    if attempt.failed_count >= threshold:
        progressive_level = attempt.failed_count - threshold + 1
        block_seconds = min(
            settings.LOGIN_RATE_LIMIT_MAX_BLOCK_SECONDS,
            settings.LOGIN_RATE_LIMIT_BASE_BLOCK_SECONDS * progressive_level,
        )
        attempt.blocked_until = now + timedelta(seconds=block_seconds)

    db.commit()


def _clear_failed_login_attempts(db: Session, username: str, source_ip_hash: str) -> None:
    (
        db.query(models.LoginAttempt)
        .filter(
            models.LoginAttempt.username == username,
            models.LoginAttempt.source_ip_hash == source_ip_hash,
        )
        .delete()
    )
    db.commit()


def _issue_session_tokens(user: models.User, db: Session, request: Request, token_family: str | None = None) -> schemas.TokenPairResponse:
    from ...core.utils import create_access_token

    now = _utcnow()
    session_id = str(uuid.uuid4())
    family = token_family or str(uuid.uuid4())
    refresh_token = secrets.token_urlsafe(48)

    auth_session = models.AuthSession(
        session_id=session_id,
        user_id=user.id,
        token_family=family,
        refresh_token_hash=_hash_refresh_token(refresh_token),
        source_ip_hash=_client_ip_hash(request),
        user_agent_fingerprint=_user_agent_fingerprint(request),
        device_nickname=_device_nickname_from_request(request),
        region_hint=_region_hint_from_request(request),
        risk_score=0.0,
        issued_at=now,
        last_seen_at=now,
        expires_at=now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        is_revoked=False,
    )
    db.add(auth_session)
    db.commit()

    access_token = create_access_token({"sub": str(user.id), "sid": session_id})
    return schemas.TokenPairResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        session_id=session_id,
        user_id=user.id,
        is_admin=user.is_admin,
        first_name=user.first_name,
    )


def _revoke_token_family(db: Session, token_family: str) -> int:
    now = _utcnow()
    sessions = (
        db.query(models.AuthSession)
        .filter(models.AuthSession.token_family == token_family, models.AuthSession.is_revoked.is_(False))
        .all()
    )
    for session in sessions:
        session.is_revoked = True
        session.revoked_at = now
    db.commit()
    return len(sessions)


def _authenticate_and_issue_tokens(username: str, password: str, db: Session, request: Request) -> schemas.TokenPairResponse:
    normalized_username = username.strip()
    source_ip_hash = _client_ip_hash(request)
    _enforce_login_rate_limit(db, normalized_username, source_ip_hash)

    user = (
        db.query(models.User)
        .filter(models.User.username.ilike(normalized_username))
        .first()
    )

    if not user:
        pwd_context.verify("dummy_password", _DUMMY_BCRYPT_HASH)
        _register_failed_login(db, normalized_username, source_ip_hash)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not pwd_context.verify(password, user.password):
        _register_failed_login(db, normalized_username, source_ip_hash)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    _clear_failed_login_attempts(db, normalized_username, source_ip_hash)
    return _issue_session_tokens(user=user, db=db, request=request)


@router.get("/me", response_model=schemas.UserOut)
def get_my_account(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=schemas.UserOut)
def update_my_account(
    payload: schemas.UserAccountUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    incoming = payload.model_dump(exclude_unset=True)
    if not incoming:
        raise HTTPException(status_code=400, detail="No fields provided for update")

    previous_email = current_user.email.strip().lower()
    email_changed = False

    if "username" in incoming:
        normalized_username = (incoming["username"] or "").strip()
        if len(normalized_username) < 3:
            raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
        existing_username = (
            db.query(models.User.id)
            .filter(models.User.username == normalized_username, models.User.id != current_user.id)
            .first()
        )
        if existing_username:
            raise HTTPException(status_code=400, detail="Username already exists")
        current_user.username = normalized_username

    if "email" in incoming:
        normalized_email = (incoming["email"] or "").strip().lower()
        existing_email = (
            db.query(models.User.id)
            .filter(models.User.email == normalized_email, models.User.id != current_user.id)
            .first()
        )
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already exists")
        if normalized_email != previous_email:
            current_user.email = normalized_email
            current_user.email_verified_at = None
            email_changed = True

    if "first_name" in incoming:
        current_user.first_name = (incoming["first_name"] or "").strip()

    if "last_name" in incoming:
        current_user.last_name = (incoming["last_name"] or "").strip()

    if "organization" in incoming:
        org_value = incoming["organization"]
        current_user.organization = org_value.strip() if isinstance(org_value, str) and org_value.strip() else None

    db.commit()
    db.refresh(current_user)

    if email_changed:
        background_tasks.add_task(
            sendEmailChangeEmail,
            previous_email,
            first_name=current_user.first_name,
            previous_email=previous_email,
            new_email=current_user.email,
        )
        _issue_email_verification(db, current_user, background_tasks)

    return current_user


@router.post("/change-password")
def change_my_password(
    payload: schemas.ChangePasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not pwd_context.verify(payload.current_password, current_user.password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if pwd_context.verify(payload.new_password, current_user.password):
        raise HTTPException(status_code=400, detail="New password must be different from current password")

    current_user.password = pwd_context.hash(payload.new_password)
    db.commit()
    background_tasks.add_task(sendPasswordChangeEmail, current_user.email, current_user.first_name)

    return {"message": "Password updated successfully"}


@router.post("/login", response_model=schemas.TokenPairResponse)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    return _authenticate_and_issue_tokens(form_data.username, form_data.password, db, request)

@router.post("/login-json", response_model=schemas.TokenPairResponse)
def login_json(
    request: Request,
    login_data: schemas.LoginRequest,
    db: Session = Depends(get_db),
):
    return _authenticate_and_issue_tokens(login_data.username, login_data.password, db, request)


@router.post("/refresh", response_model=schemas.TokenPairResponse)
def refresh_tokens(
    request: Request,
    payload: schemas.RefreshTokenRequest,
    db: Session = Depends(get_db),
):
    now = _utcnow()
    token_hash = _hash_refresh_token(payload.refresh_token)

    session = (
        db.query(models.AuthSession)
        .filter(models.AuthSession.refresh_token_hash == token_hash)
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    if session.is_revoked or session.expires_at <= now:
        if session.is_revoked:
            _revoke_token_family(db, session.token_family)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token is no longer valid")

    user = db.query(models.User).filter(models.User.id == session.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session user no longer exists")

    session.is_revoked = True
    session.revoked_at = now
    session.last_seen_at = now

    refreshed = _issue_session_tokens(user=user, db=db, request=request, token_family=session.token_family)
    session.replaced_by_session_id = refreshed.session_id
    db.commit()
    return refreshed


@router.get("/sessions", response_model=schemas.SessionListResponse)
def list_my_sessions(
    include_revoked: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.AuthSession).filter(models.AuthSession.user_id == current_user.id)
    if not include_revoked:
        query = query.filter(models.AuthSession.is_revoked.is_(False))

    sessions = query.order_by(models.AuthSession.last_seen_at.desc()).all()
    return schemas.SessionListResponse(
        sessions=[
            schemas.SessionInfo(
                session_id=s.session_id,
                issued_at=s.issued_at,
                last_seen_at=s.last_seen_at,
                expires_at=s.expires_at,
                is_revoked=s.is_revoked,
                revoked_at=s.revoked_at,
                device_nickname=s.device_nickname,
                region_hint=s.region_hint,
                risk_score=s.risk_score or 0.0,
            )
            for s in sessions
        ]
    )


@router.post("/sessions/revoke", response_model=schemas.SessionRevokeResponse)
def revoke_single_session(
    payload: schemas.SessionRevokeRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    now = _utcnow()
    session = (
        db.query(models.AuthSession)
        .filter(
            models.AuthSession.user_id == current_user.id,
            models.AuthSession.session_id == payload.session_id,
            models.AuthSession.is_revoked.is_(False),
        )
        .first()
    )
    if not session:
        return schemas.SessionRevokeResponse(revoked_sessions=0)

    session.is_revoked = True
    session.revoked_at = now
    db.commit()
    return schemas.SessionRevokeResponse(revoked_sessions=1)


@router.post("/logout", response_model=schemas.SessionRevokeResponse)
def logout(
    payload: schemas.LogoutRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    now = _utcnow()
    revoked_sessions = 0

    active_sessions = (
        db.query(models.AuthSession)
        .filter(models.AuthSession.user_id == current_user.id, models.AuthSession.is_revoked.is_(False))
    )

    if payload.all_sessions:
        sessions = active_sessions.all()
        for session in sessions:
            session.is_revoked = True
            session.revoked_at = now
        revoked_sessions = len(sessions)
    elif payload.refresh_token:
        token_hash = _hash_refresh_token(payload.refresh_token)
        session = active_sessions.filter(models.AuthSession.refresh_token_hash == token_hash).first()
        if session:
            session.is_revoked = True
            session.revoked_at = now
            revoked_sessions = 1
    else:
        session = active_sessions.order_by(models.AuthSession.last_seen_at.desc()).first()
        if session:
            session.is_revoked = True
            session.revoked_at = now
            revoked_sessions = 1

    db.commit()
    return schemas.SessionRevokeResponse(revoked_sessions=revoked_sessions)


@router.post("/admin/revoke-user-sessions/{user_id}", response_model=schemas.SessionRevokeResponse)
def admin_revoke_user_sessions(
    user_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin_user),
):
    now = _utcnow()
    sessions = (
        db.query(models.AuthSession)
        .filter(models.AuthSession.user_id == user_id, models.AuthSession.is_revoked.is_(False))
        .all()
    )
    for session in sessions:
        session.is_revoked = True
        session.revoked_at = now
    db.commit()
    return schemas.SessionRevokeResponse(revoked_sessions=len(sessions))

RESET_TOKEN_EXPIRE_MINUTES = 10
EMAIL_VERIFICATION_EXPIRE_MINUTES = 30

def create_reset_token(email: str) -> str:
    return secrets.token_urlsafe(32)


def create_email_verification_token(email: str) -> str:
    return secrets.token_urlsafe(32)


def _invalidate_existing_reset_tokens(db: Session, user_id: int, now: datetime) -> None:
    active_tokens = (
        db.query(models.PasswordResetToken)
        .filter(
            models.PasswordResetToken.user_id == user_id,
            models.PasswordResetToken.used_at.is_(None),
            models.PasswordResetToken.expires_at >= now,
        )
        .all()
    )
    for active_token in active_tokens:
        active_token.used_at = now


def _save_reset_token(db: Session, user_id: int, token: str) -> models.PasswordResetToken:
    now = _utcnow()
    _invalidate_existing_reset_tokens(db, user_id, now)
    reset_token = models.PasswordResetToken(
        user_id=user_id,
        token_hash=_hash_value(token),
        expires_at=now + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES),
    )
    db.add(reset_token)
    db.commit()
    db.refresh(reset_token)
    return reset_token


def _get_valid_reset_record(db: Session, token: str) -> models.PasswordResetToken | None:
    token_hash = _hash_value(token)
    reset_record = (
        db.query(models.PasswordResetToken)
        .filter(models.PasswordResetToken.token_hash == token_hash)
        .first()
    )
    if not reset_record:
        return None
    now = _utcnow()
    if reset_record.used_at is not None or reset_record.expires_at < now:
        return None
    return reset_record


def _invalidate_existing_email_verification_tokens(db: Session, user_id: int, now: datetime) -> None:
    active_tokens = (
        db.query(models.EmailVerificationToken)
        .filter(
            models.EmailVerificationToken.user_id == user_id,
            models.EmailVerificationToken.used_at.is_(None),
            models.EmailVerificationToken.expires_at >= now,
        )
        .all()
    )
    for active_token in active_tokens:
        active_token.used_at = now


def _save_email_verification_token(db: Session, user_id: int, email: str, token: str) -> models.EmailVerificationToken:
    now = _utcnow()
    _invalidate_existing_email_verification_tokens(db, user_id, now)
    verification_token = models.EmailVerificationToken(
        user_id=user_id,
        email=email,
        token_hash=_hash_value(token),
        expires_at=now + timedelta(minutes=EMAIL_VERIFICATION_EXPIRE_MINUTES),
    )
    db.add(verification_token)
    db.commit()
    db.refresh(verification_token)
    return verification_token


def _get_valid_email_verification_record(db: Session, token: str) -> models.EmailVerificationToken | None:
    token_hash = _hash_value(token)
    verification_record = (
        db.query(models.EmailVerificationToken)
        .filter(models.EmailVerificationToken.token_hash == token_hash)
        .first()
    )
    if not verification_record:
        return None
    now = _utcnow()
    if verification_record.used_at is not None or verification_record.expires_at < now:
        return None
    return verification_record


def _issue_email_verification(db: Session, user: models.User, background_tasks: BackgroundTasks) -> str:
    token = create_email_verification_token(user.email)
    _save_email_verification_token(db, user.id, user.email, token)
    background_tasks.add_task(sendVerifyEmail, user.email, token, None)
    return token

@router.post("/request-password-reset")
def request_password_reset(payload: schemas.PasswordResetRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Always return the same message to prevent email enumeration
    generic_response = {"message": "If an account exists for this email, a password reset link has been sent."}

    email = payload.email.strip().lower()
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        return generic_response

    token = create_reset_token(email)
    _save_reset_token(db, user.id, token)
    background_tasks.add_task(sendResetPasswordEmail, email, token, None)
    return generic_response

@router.post("/verify-reset-code")
def verify_reset_code(payload: schemas.PasswordResetVerifyRequest, db: Session = Depends(get_db)):
    token = (payload.token or payload.code or "").strip()
    reset_record = _get_valid_reset_record(db, token)
    if not reset_record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    user = db.query(models.User).filter(models.User.id == reset_record.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    email = user.email
    if payload.email and payload.email.lower().strip() != email.lower().strip():
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    return {"message": "Token verified", "email": email}

@router.post("/reset-password")
def reset_password(payload: schemas.PasswordResetConfirmRequest, db: Session = Depends(get_db)):
    token = (payload.token or payload.code or "").strip()
    reset_record = _get_valid_reset_record(db, token)
    if not reset_record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    user = db.query(models.User).filter(models.User.id == reset_record.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    email = user.email
    if payload.email and payload.email.lower().strip() != email.lower().strip():
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    user.password = bcrypt.hash(payload.new_password)
    reset_record.used_at = _utcnow()
    db.commit()
    return {"message": "Password reset successful"}

@router.post("/signup", response_model=schemas.UserOut)
def signup(user: schemas.UserCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Check if user exists
    existing = db.query(models.User).filter(models.User.username == user.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    normalized_email = user.email.strip().lower()
    existing_email = db.query(models.User).filter(models.User.email == normalized_email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already exists")
    # Hash password
    hashed_password = bcrypt.hash(user.password)
    # Create user
    db_user = models.User(
        username=user.username,
        email=normalized_email,
        first_name=user.first_name,
        last_name=user.last_name,
        organization=user.organization,
        password=hashed_password,
        is_admin=False,
        email_verified_at=None,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    background_tasks.add_task(sendWelcomeEmail, db_user.email, db_user.first_name)
    _issue_email_verification(db, db_user, background_tasks)
    return db_user


@router.post("/request-email-verification")
def request_email_verification(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.email_verified_at is not None:
        return {"message": "Email already verified"}

    _issue_email_verification(db, current_user, background_tasks)
    return {"message": "Verification email sent"}


@router.post("/verify-email")
def verify_email(payload: schemas.EmailVerificationConfirmRequest, db: Session = Depends(get_db)):
    token = (payload.token or payload.code or "").strip()
    verification_record = _get_valid_email_verification_record(db, token)
    if not verification_record:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    user = db.query(models.User).filter(models.User.id == verification_record.user_id).first()
    if not user or user.email.strip().lower() != verification_record.email.strip().lower():
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    now = _utcnow()
    user.email_verified_at = now
    verification_record.used_at = now
    db.commit()
    return {"message": "Email verified successfully"}


@router.get("/check-username")
def check_username(username: str, db: Session = Depends(get_db)):
    normalized_username = username.strip()

    if len(normalized_username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")

    existing = (
        db.query(models.User.id)
        .filter(models.User.username == normalized_username)
        .first()
    )

    return {"available": existing is None}
