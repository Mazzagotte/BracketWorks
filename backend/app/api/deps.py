import logging
from fastapi import HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from ..core import models, utils
from ..core.config import settings

logger = logging.getLogger(__name__)

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
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        payload = utils.decode_access_token(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    if not payload:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    
    if "sub" not in payload:
        raise HTTPException(status_code=401, detail="Missing user id in token")
    
    user_id = payload["sub"]
    try:
        user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    except Exception as e:
        raise HTTPException(status_code=500, detail="Database error")
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user


def require_admin_user(current_user: models.User = Depends(get_current_user)):
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
