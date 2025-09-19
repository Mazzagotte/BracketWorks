from fastapi import HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from ..core import models, utils
from ..core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db: Session = SessionLocal()
    try:
        yield db
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
    print("TEST: get_current_user called")
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger("jwt-auth")
    if not token:
        print("[AUTH] Missing bearer token on request")
        logger.warning("Missing bearer token on request")
        raise HTTPException(status_code=401, detail="Not authenticated")
    print(f"[AUTH] Received token: {token}")
    logger.info(f"Received token: {token}")
    try:
        payload = utils.decode_access_token(token)
        print(f"[AUTH] Decoded payload: {payload}")
        logger.info(f"Decoded payload: {payload}")
    except Exception as e:
        print(f"[AUTH] JWT decode error: {e}")
        logger.error(f"JWT decode error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")
    if not payload:
        print("[AUTH] Payload is None after decoding token")
        logger.error("Payload is None after decoding token")
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    if "sub" not in payload:
        print(f"[AUTH] Missing 'sub' in payload: {payload}")
        logger.error(f"Missing 'sub' in payload: {payload}")
        raise HTTPException(status_code=401, detail="Missing user id in token")
    user_id = payload["sub"]
    print(f"[AUTH] Looking up user_id: {user_id}")
    logger.info(f"Looking up user_id: {user_id}")
    try:
        user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    except Exception as e:
        print(f"[AUTH] DB error during user lookup: {e}")
        logger.error(f"DB error during user lookup: {e}")
        raise HTTPException(status_code=500, detail="Database error")
    if not user:
        print(f"[AUTH] User not found for user_id: {user_id}")
        logger.error(f"User not found for user_id: {user_id}")
        raise HTTPException(status_code=404, detail="User not found")
    print(f"[AUTH] Authenticated user: {user.username} (ID: {user.id})")
    logger.info(f"Authenticated user: {user.username} (ID: {user.id})")
    return user
