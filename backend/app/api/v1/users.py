from fastapi import BackgroundTasks, status, APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from ...core import models, schemas
from ...core.config import settings
from ..deps import get_db
from fastapi.responses import JSONResponse
from passlib.hash import bcrypt
from passlib.context import CryptContext
import logging

# Optimize bcrypt for faster verification (reduce rounds for development)
pwd_context = CryptContext(
    schemes=["bcrypt"], 
    deprecated="auto",
    bcrypt__default_rounds=10  # Reduced from default 12 for better performance
)
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Optimize query with explicit select for performance
    user = (
        db.query(models.User)
        .filter(models.User.username == form_data.username.strip())
        .first()
    )
    
    if not user:
        # Use timing-safe comparison to prevent username enumeration
        pwd_context.verify("dummy_password", "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    
    if not pwd_context.verify(form_data.password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    
    from ...core.utils import create_access_token
    access_token = create_access_token({"sub": str(user.id)})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "is_admin": user.is_admin,
        "first_name": user.first_name
    }

@router.post("/login-json")
def login_json(login_data: schemas.LoginRequest, db: Session = Depends(get_db)):
    # Optimize query with explicit select for performance
    user = (
        db.query(models.User)
        .filter(models.User.username == login_data.username.strip())
        .first()
    )
    
    if not user:
        # Use timing-safe comparison to prevent username enumeration
        pwd_context.verify("dummy_password", "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    
    if not pwd_context.verify(login_data.password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    
    from ...core.utils import create_access_token
    access_token = create_access_token({"sub": str(user.id)})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "is_admin": user.is_admin,
        "first_name": user.first_name
    }

RESET_TOKEN_EXPIRE_MINUTES = 15

def create_reset_token(email: str) -> str:
    """Create a signed JWT reset token valid for 15 minutes."""
    from ...core.utils import create_access_token
    from datetime import timedelta
    return create_access_token(
        {"sub": email, "type": "password_reset"},
        expires_delta=timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    )

def verify_reset_token(token: str) -> str | None:
    """Decode and validate a reset token. Returns email or None."""
    from ...core.utils import decode_access_token
    payload = decode_access_token(token)
    if not payload or payload.get("type") != "password_reset":
        return None
    return payload.get("sub")

def create_reset_email_html(reset_code: str, username: str) -> str:
    """Create HTML email template for password reset"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #232b36 0%, #3a4756 100%); color: white; padding: 20px; text-align: center; }}
            .content {{ background: #f9f9f9; padding: 30px; }}
            .reset-code {{ font-size: 24px; font-weight: bold; color: #007bff; text-align: center; padding: 20px; background: white; margin: 20px 0; border-radius: 5px; }}
            .footer {{ text-align: center; padding: 20px; color: #666; font-size: 14px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>BracketWorks</h1>
                <h2>Password Reset Request</h2>
            </div>
            <div class="content">
                <p>Hello {username},</p>
                <p>You requested a password reset for your BracketWorks account. Use the following code to reset your password:</p>
                <div class="reset-code">{reset_code}</div>
                <p>This code will expire in 15 minutes for security reasons.</p>
                <p>If you didn't request this reset, please ignore this email.</p>
                <p>Thanks,<br>The BracketWorks Team</p>
            </div>
            <div class="footer">
                <p>© 2025 BracketWorks. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """

def send_email(to_email: str, subject: str, body: str):
    """Send email using SendGrid API"""
    try:
        # Create SendGrid message
        message = Mail(
            from_email=(settings.FROM_EMAIL, settings.FROM_NAME),
            to_emails=to_email,
            subject=subject,
            html_content=body
        )
        
        # Send email via SendGrid
        if settings.SENDGRID_API_KEY:
            sg = SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
            response = sg.send(message)
            logger.info(f"Email sent successfully. Status code: {response.status_code}")
            return True
        else:
            logger.warning("SendGrid API key not configured - email not sent")
            return False
            
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False

@router.post("/request-password-reset")
def request_password_reset(email: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Always return the same message to prevent email enumeration
    generic_response = {"message": "If that email is registered, a reset link has been sent"}

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        return generic_response

    token = create_reset_token(email)
    html_body = create_reset_email_html(token, user.username)
    background_tasks.add_task(send_email, email, "BracketWorks - Password Reset", html_body)
    return generic_response

@router.post("/verify-reset-code")
def verify_reset_code(token: str):
    email = verify_reset_token(token)
    if not email:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    return {"message": "Token verified"}

@router.post("/reset-password")
def reset_password(token: str, new_password: str, db: Session = Depends(get_db)):
    email = verify_reset_token(token)
    if not email:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    user.password = bcrypt.hash(new_password)
    db.commit()
    return {"message": "Password reset successful"}

@router.post("/admin-login")
def admin_login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username, models.User.is_admin == True).first()
    if not user or not bcrypt.verify(form_data.password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials")
    return {"message": "Admin login successful", "user_id": user.id}

@router.post("/signup", response_model=schemas.UserOut)
def signup(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check if user exists
    existing = db.query(models.User).filter(models.User.username == user.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    existing_email = db.query(models.User).filter(models.User.email == user.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already exists")
    # Hash password
    hashed_password = bcrypt.hash(user.password)
    # Create user
    db_user = models.User(
        username=user.username,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        organization=user.organization,
        password=hashed_password,
        is_admin=False
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


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
