from fastapi import BackgroundTasks, Request, Response, status, APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import or_, select
from pydantic import BaseModel
from ...core import models, schemas
from ...core.config import settings
from ...core.password_policy import PasswordPolicyError, validate_password_policy
from ...core import legal_disclosure
from ..deps import get_db, get_current_user, require_admin_user
from ...services.email_service import (
    sendEmailChangeEmail,
    sendPasswordChangeEmail,
    sendResetPasswordEmail,
    sendVerifyEmail,
    sendWelcomeEmail,
)
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
import hashlib
import logging
import secrets
import uuid

pwd_context = CryptContext(
    schemes=["bcrypt"], 
    deprecated="auto",
    bcrypt__default_rounds=settings.PASSWORD_BCRYPT_ROUNDS,
)

logger = logging.getLogger(__name__)

router = APIRouter()

DEV_NOTICE_VERSION = "1.0"


class AcknowledgmentPayload(BaseModel):
    content_type: str
    content_id: str
    version: str


_DUMMY_BCRYPT_HASH = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"


def _utcnow() -> datetime:
    # Database columns use timezone-naive DateTime, so keep comparisons naive UTC.
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _hash_value(value: str) -> str:
    payload = f"{settings.SECRET_KEY}:{value}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _refresh_cookie_domain() -> str | None:
    domain = settings.REFRESH_TOKEN_COOKIE_DOMAIN.strip()
    return domain if domain else None


def _csrf_cookie_domain() -> str | None:
    domain = settings.CSRF_COOKIE_DOMAIN.strip()
    return domain if domain else None


def _access_cookie_domain() -> str | None:
    domain = settings.ACCESS_TOKEN_COOKIE_DOMAIN.strip()
    return domain if domain else None


def _set_auth_no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=settings.REFRESH_TOKEN_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=settings.REFRESH_TOKEN_COOKIE_SECURE,
        samesite=settings.REFRESH_TOKEN_COOKIE_SAMESITE.lower(),
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path=settings.REFRESH_TOKEN_COOKIE_PATH,
        domain=_refresh_cookie_domain(),
    )


def _set_access_cookie(response: Response, access_token: str) -> None:
    response.set_cookie(
        key=settings.ACCESS_TOKEN_COOKIE_NAME,
        value=access_token,
        httponly=True,
        secure=settings.ACCESS_TOKEN_COOKIE_SECURE,
        samesite=settings.ACCESS_TOKEN_COOKIE_SAMESITE.lower(),
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path=settings.ACCESS_TOKEN_COOKIE_PATH,
        domain=_access_cookie_domain(),
    )


def _set_csrf_cookie(response: Response, csrf_token: str) -> None:
    response.set_cookie(
        key=settings.CSRF_COOKIE_NAME,
        value=csrf_token,
        httponly=False,
        secure=settings.CSRF_COOKIE_SECURE,
        samesite=settings.CSRF_COOKIE_SAMESITE.lower(),
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path=settings.CSRF_COOKIE_PATH,
        domain=_csrf_cookie_domain(),
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.REFRESH_TOKEN_COOKIE_NAME,
        path=settings.REFRESH_TOKEN_COOKIE_PATH,
        domain=_refresh_cookie_domain(),
        secure=settings.REFRESH_TOKEN_COOKIE_SECURE,
        samesite=settings.REFRESH_TOKEN_COOKIE_SAMESITE.lower(),
    )


def _clear_access_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.ACCESS_TOKEN_COOKIE_NAME,
        path=settings.ACCESS_TOKEN_COOKIE_PATH,
        domain=_access_cookie_domain(),
        secure=settings.ACCESS_TOKEN_COOKIE_SECURE,
        samesite=settings.ACCESS_TOKEN_COOKIE_SAMESITE.lower(),
    )


def _clear_csrf_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.CSRF_COOKIE_NAME,
        path=settings.CSRF_COOKIE_PATH,
        domain=_csrf_cookie_domain(),
        secure=settings.CSRF_COOKIE_SECURE,
        samesite=settings.CSRF_COOKIE_SAMESITE.lower(),
    )


def _resolve_refresh_token(request: Request) -> str | None:
    cookie_token = (request.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME) or "").strip()
    return cookie_token or None


def _issue_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def _normalize_username_for_auth(value: str) -> str:
    return (value or "").strip().lower()


def _validate_csrf(request: Request) -> None:
    if not settings.CSRF_PROTECT_REFRESH_AND_LOGOUT:
        return

    cookie_token = (request.cookies.get(settings.CSRF_COOKIE_NAME) or "").strip()
    header_token = (request.headers.get(settings.CSRF_HEADER_NAME) or "").strip()

    if not cookie_token or not header_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing CSRF token")

    if not secrets.compare_digest(cookie_token, header_token):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid CSRF token")


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
    dev_notice_required = user.dev_notice_version_accepted != DEV_NOTICE_VERSION
    return schemas.TokenPairResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        session_id=session_id,
        user_id=user.id,
        is_admin=user.is_admin,
        first_name=user.first_name,
        dev_notice_required=dev_notice_required,
        dev_notice_version=DEV_NOTICE_VERSION,
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


def _revoke_all_user_sessions(db: Session, user_id: int, now: datetime | None = None) -> int:
    revoked_at = now or _utcnow()
    sessions = (
        db.query(models.AuthSession)
        .filter(
            models.AuthSession.user_id == user_id,
            models.AuthSession.is_revoked.is_(False),
        )
        .all()
    )
    for session in sessions:
        session.is_revoked = True
        session.revoked_at = revoked_at
    return len(sessions)


def _authenticate_and_issue_tokens(username: str, password: str, db: Session, request: Request) -> schemas.TokenPairResponse:
    normalized_username = _normalize_username_for_auth(username)
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
def get_my_account(response: Response, current_user: models.User = Depends(get_current_user)):
    _set_auth_no_store(response)
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

    try:
        validate_password_policy(payload.new_password)
    except PasswordPolicyError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    now = _utcnow()
    current_user.password = pwd_context.hash(payload.new_password)
    _revoke_all_user_sessions(db, current_user.id, now)
    db.commit()
    background_tasks.add_task(sendPasswordChangeEmail, current_user.email, current_user.first_name)

    return {"message": "Password updated successfully"}


@router.post("/login", response_model=schemas.TokenPairResponse)
def login(
    response: Response,
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    tokens = _authenticate_and_issue_tokens(form_data.username, form_data.password, db, request)
    _set_auth_no_store(response)
    _set_access_cookie(response, tokens.access_token)
    if tokens.refresh_token:
        _set_refresh_cookie(response, tokens.refresh_token)
        _set_csrf_cookie(response, _issue_csrf_token())
    tokens.refresh_token = None
    return tokens

@router.post("/login-json", response_model=schemas.TokenPairResponse)
def login_json(
    response: Response,
    request: Request,
    login_data: schemas.LoginRequest,
    db: Session = Depends(get_db),
):
    tokens = _authenticate_and_issue_tokens(login_data.username, login_data.password, db, request)
    _set_auth_no_store(response)
    _set_access_cookie(response, tokens.access_token)
    if tokens.refresh_token:
        _set_refresh_cookie(response, tokens.refresh_token)
        _set_csrf_cookie(response, _issue_csrf_token())
    tokens.refresh_token = None
    return tokens


@router.post("/dev-notice/accept", response_model=schemas.DevNoticeAcceptResponse)
def accept_dev_notice(
    payload: schemas.DevNoticeAcceptRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if payload.version != DEV_NOTICE_VERSION:
        raise HTTPException(status_code=400, detail="Unknown notice version")
    current_user.dev_notice_version_accepted = payload.version
    current_user.dev_notice_accepted_at = _utcnow()
    existing = db.scalar(select(models.UserAcknowledgment).where(models.UserAcknowledgment.user_id == current_user.id, models.UserAcknowledgment.content_type == "development_notice", models.UserAcknowledgment.content_id == "default", models.UserAcknowledgment.version == payload.version))
    if not existing:
        db.add(models.UserAcknowledgment(user_id=current_user.id, content_type="development_notice", content_id="default", version=payload.version))
    db.commit()
    logger.info("Dev notice accepted", extra={"user_id": current_user.id, "version": payload.version})
    return schemas.DevNoticeAcceptResponse(accepted=True, version=payload.version)


@router.get("/legal-disclosure/status", response_model=schemas.LegalDisclosureStatus)
def legal_disclosure_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    now = _utcnow()
    acceptance = legal_disclosure.latest_acceptance(db, current_user.id)
    required = acceptance is None or acceptance.next_required_at <= now
    return schemas.LegalDisclosureStatus(
        required=required,
        version=legal_disclosure.VERSION,
        title=legal_disclosure.TITLE,
        effective_date=legal_disclosure.EFFECTIVE_DATE,
        body=list(legal_disclosure.BODY),
        acknowledgment=legal_disclosure.ACKNOWLEDGMENT,
        accepted_at=acceptance.accepted_at if acceptance else None,
        next_required_at=acceptance.next_required_at if acceptance else None,
    )


@router.post("/legal-disclosure/accept", response_model=schemas.LegalDisclosureStatus)
def accept_legal_disclosure(
    payload: schemas.LegalDisclosureAcceptRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if payload.version != legal_disclosure.VERSION:
        raise HTTPException(status_code=409, detail="The disclosure has changed. Review the current version before accepting.")

    now = _utcnow()
    next_required_at = now + timedelta(days=30)
    db.add(models.LegalDisclosureAcceptance(
        user_id=current_user.id,
        disclosure_version=legal_disclosure.VERSION,
        disclosure_hash=legal_disclosure.content_hash(),
        accepted_at=now,
        next_required_at=next_required_at,
        acceptance_source="required_modal",
    ))
    db.commit()
    logger.info("Legal disclosure accepted", extra={
        "user_id": current_user.id,
        "version": legal_disclosure.VERSION,
        "next_required_at": next_required_at.isoformat(),
    })
    return schemas.LegalDisclosureStatus(
        required=False,
        version=legal_disclosure.VERSION,
        title=legal_disclosure.TITLE,
        effective_date=legal_disclosure.EFFECTIVE_DATE,
        body=list(legal_disclosure.BODY),
        acknowledgment=legal_disclosure.ACKNOWLEDGMENT,
        accepted_at=now,
        next_required_at=next_required_at,
    )


@router.post("/acknowledgments")
def acknowledge_content(payload: AcknowledgmentPayload, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    content_type, content_id, version = payload.content_type.strip().lower(), payload.content_id.strip(), payload.version.strip()
    if content_type not in {"welcome", "announcement", "legal", "instruction"} or not content_id or not version:
        raise HTTPException(status_code=400, detail="Invalid acknowledgment")
    if content_type == "announcement":
        announcement = db.get(models.AdminAnnouncement, int(content_id) if content_id.isdigit() else -1)
        if not announcement: raise HTTPException(status_code=404, detail="Announcement not found")
    existing = db.scalar(select(models.UserAcknowledgment).where(models.UserAcknowledgment.user_id == current_user.id, models.UserAcknowledgment.content_type == content_type, models.UserAcknowledgment.content_id == content_id, models.UserAcknowledgment.version == version))
    if not existing:
        db.add(models.UserAcknowledgment(user_id=current_user.id, content_type=content_type, content_id=content_id, version=version)); db.commit()
    return {"acknowledged": True}


@router.get("/announcements/active")
def get_active_announcements(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    now = _utcnow()
    audience_filters = [models.AdminAnnouncement.audience_type == "all", (models.AdminAnnouncement.audience_type == "user") & (models.AdminAnnouncement.audience_user_id == current_user.id)]
    if current_user.is_admin:
        audience_filters.append(models.AdminAnnouncement.audience_type == "admins")
    entries = db.execute(select(models.AdminAnnouncement).where(models.AdminAnnouncement.status == "active", or_(models.AdminAnnouncement.starts_at.is_(None), models.AdminAnnouncement.starts_at <= now), or_(models.AdminAnnouncement.ends_at.is_(None), models.AdminAnnouncement.ends_at >= now), or_(*audience_filters)).order_by(models.AdminAnnouncement.created_at.asc())).scalars().all()
    acknowledged_versions = set(db.execute(select(models.UserAcknowledgment.content_id, models.UserAcknowledgment.version).where(models.UserAcknowledgment.user_id == current_user.id, models.UserAcknowledgment.content_type == "announcement")).all())
    return {"announcements": [{"id": entry.id, "title": entry.title, "message": entry.message, "requires_acknowledgment": entry.requires_acknowledgment, "version": entry.updated_at.isoformat(), "acknowledged": False} for entry in entries if (str(entry.id), entry.updated_at.isoformat()) not in acknowledged_versions]}


@router.get("/changelog", response_model=schemas.ChangelogResponse)
def get_changelog(db: Session = Depends(get_db)):
    """Get changelog/what's new for the application"""
    entries = db.query(models.Changelog).order_by(models.Changelog.version.desc()).all()
    
    # If no entries in DB, return empty response
    if not entries:
        return schemas.ChangelogResponse(entries=[])
    
    # Convert to response schema
    changelog_entries = [
        schemas.ChangelogEntry(
            date=entry.date,
            version=entry.version,
            changes=entry.changes
        )
        for entry in entries
    ]
    return schemas.ChangelogResponse(entries=changelog_entries)


@router.post("/refresh", response_model=schemas.TokenPairResponse)
def refresh_tokens(
    response: Response,
    request: Request,
    _: schemas.RefreshTokenRequest,
    db: Session = Depends(get_db),
):
    _set_auth_no_store(response)
    _validate_csrf(request)
    now = _utcnow()
    refresh_token = _resolve_refresh_token(request)
    if not refresh_token:
        _clear_access_cookie(response)
        _clear_refresh_cookie(response)
        _clear_csrf_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")

    token_hash = _hash_refresh_token(refresh_token)

    session = (
        db.query(models.AuthSession)
        .filter(models.AuthSession.refresh_token_hash == token_hash)
        .first()
    )
    if not session:
        _clear_access_cookie(response)
        _clear_refresh_cookie(response)
        _clear_csrf_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    if session.is_revoked or session.expires_at <= now:
        if session.is_revoked:
            _revoke_token_family(db, session.token_family)
        _clear_access_cookie(response)
        _clear_refresh_cookie(response)
        _clear_csrf_cookie(response)
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
    _set_access_cookie(response, refreshed.access_token)
    if refreshed.refresh_token:
        _set_refresh_cookie(response, refreshed.refresh_token)
        _set_csrf_cookie(response, _issue_csrf_token())
    refreshed.refresh_token = None
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
    request: Request,
    response: Response,
    payload: schemas.LogoutRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _set_auth_no_store(response)
    _validate_csrf(request)
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
    else:
        resolved_refresh = _resolve_refresh_token(request)
        if resolved_refresh:
            token_hash = _hash_refresh_token(resolved_refresh)
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
    _clear_access_cookie(response)
    _clear_refresh_cookie(response)
    _clear_csrf_cookie(response)
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

    try:
        validate_password_policy(payload.new_password)
    except PasswordPolicyError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    now = _utcnow()
    user.password = pwd_context.hash(payload.new_password)
    reset_record.used_at = now
    _revoke_all_user_sessions(db, user.id, now)
    db.commit()
    return {"message": "Password reset successful"}

@router.post("/signup", response_model=schemas.UserOut)
def signup(user: schemas.UserCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Check if user exists
    requested_username = (user.username or "").strip()
    if len(requested_username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")

    existing = db.query(models.User).filter(models.User.username.ilike(requested_username)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    normalized_email = user.email.strip().lower()
    existing_email = db.query(models.User).filter(models.User.email == normalized_email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already exists")

    try:
        validate_password_policy(user.password)
    except PasswordPolicyError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Hash password
    hashed_password = pwd_context.hash(user.password)
    # Create user
    db_user = models.User(
        username=requested_username,
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
        .filter(models.User.username.ilike(normalized_username))
        .first()
    )

    return {"available": existing is None}
