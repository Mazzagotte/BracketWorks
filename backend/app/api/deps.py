import logging
from fastapi import HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from ..core import models, utils
from ..core.config import settings

logger = logging.getLogger(__name__)

# Use configuration from settings
engine = create_engine(
    settings.DATABASE_URL,
    echo=False,  # Disable SQL logging for better performance
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_pre_ping=False,   # pool_recycle handles stale connections; pre_ping adds a round-trip to every request
    pool_recycle=1800,     # Recycle connections after 30 min to prevent idle timeout disconnects
    connect_args={
        "connect_timeout": 10,
        "application_name": "bracketworks_api",
        **({"sslmode": "require"} if "render.com" in settings.DATABASE_URL else {})
    } if "postgresql" in settings.DATABASE_URL else {}
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
            logger.error(f"Database rollback failed: {rollback_error}")
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
