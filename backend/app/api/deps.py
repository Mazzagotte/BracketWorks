import logging
import secrets
from datetime import datetime, timezone

from fastapi import HTTPException, Depends, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from ..core import models, utils
from ..core.config import settings

logger = logging.getLogger(__name__)


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

if _is_sqlite:
    engine = create_engine(
        settings.DATABASE_URL,
        echo=False,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
else:
    engine = create_engine(
        settings.DATABASE_URL,
        echo=False,
        pool_size=settings.DATABASE_POOL_SIZE,
        max_overflow=settings.DATABASE_MAX_OVERFLOW,
        pool_timeout=30,
        pool_pre_ping=True,
        pool_recycle=1800,
        connect_args={
            "connect_timeout": 10,
            "application_name": "bracketworks_api",
        },
    )
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    except Exception as e:
        try:
            db.rollback()
        except Exception as rollback_error:
            logger.error(
                "Database rollback failed",
                extra={"original_error": str(e), "rollback_error": str(rollback_error)},
            )
        # Re-raise to let FastAPI handle the original error
        raise
    finally:
        db.close()


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/users/login",
    auto_error=False,
)

def get_current_user(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    authenticated_by_cookie = False
    if not token:
        token = (request.cookies.get(settings.ACCESS_TOKEN_COOKIE_NAME) or "").strip() or None
        authenticated_by_cookie = bool(token)

    if authenticated_by_cookie and request.method.upper() in {"POST", "PUT", "PATCH", "DELETE"}:
        csrf_cookie = (request.cookies.get(settings.CSRF_COOKIE_NAME) or "").strip()
        csrf_header = (request.headers.get(settings.CSRF_HEADER_NAME) or "").strip()
        if not csrf_cookie or not csrf_header or not secrets.compare_digest(csrf_cookie, csrf_header):
            raise HTTPException(status_code=403, detail="Invalid CSRF token")

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        payload = utils.decode_access_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    if not payload:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    
    if "sub" not in payload:
        raise HTTPException(status_code=401, detail="Missing user id in token")

    token_type = payload.get("type", "access")
    if token_type != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")

    sid = str(payload.get("sid") or "").strip()
    if not sid:
        raise HTTPException(status_code=401, detail="Missing session id in token")
    
    user_id = payload["sub"]
    try:
        user_id_int = int(user_id)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token subject")

    auth_session = (
        db.query(models.AuthSession)
        .filter(
            models.AuthSession.session_id == sid,
            models.AuthSession.user_id == user_id_int,
        )
        .first()
    )

    if not auth_session:
        raise HTTPException(status_code=401, detail="Session no longer valid")

    now = _utcnow_naive()
    if auth_session.is_revoked or auth_session.expires_at <= now:
        raise HTTPException(status_code=401, detail="Session no longer valid")

    try:
        user = db.get(models.User, user_id_int)
    except Exception:
        raise HTTPException(status_code=500, detail="Database error")
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user


def require_admin_user(current_user: models.User = Depends(get_current_user)):
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
