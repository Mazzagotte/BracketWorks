from datetime import datetime, timedelta
from jose import JWTError, jwt
from .config import settings

# Use SECRET_KEY from environment/config
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    
    # Use current timestamp for better performance
    now = datetime.utcnow()
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    token_type = to_encode.get("type", "access")

    to_encode.update({
        "exp": expire,
        "iat": now,  # Add issued at time
        "type": token_type  # Token type for validation
    })
    
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
