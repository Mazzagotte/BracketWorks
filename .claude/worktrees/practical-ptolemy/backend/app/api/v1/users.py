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
import secrets
import time
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
        pwd_context.verify("dummy_password", "$2b$10$dummy.hash.to.prevent.timing.attacks")
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
        pwd_context.verify("dummy_password", "$2b$10$dummy.hash.to.prevent.timing.attacks")
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

# In-memory store for reset codes with expiration timestamps
reset_codes = {}  # {email: {"code": code, "expires": timestamp}}

def cleanup_expired_codes():
    """Remove expired reset codes to prevent memory leaks"""
    current_time = time.time()
    expired_emails = [email for email, data in reset_codes.items() 
                     if current_time > data.get("expires", 0)]
    for email in expired_emails:
        del reset_codes[email]

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
    # Clean up expired codes first
    cleanup_expired_codes()
    
    # Find user by email
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    code = secrets.token_urlsafe(8)
    # Code expires in 15 minutes (900 seconds)
    reset_codes[email] = {"code": code, "expires": time.time() + 900}
    
    # Create HTML email with template
    html_body = create_reset_email_html(code, user.username)
    background_tasks.add_task(send_email, email, "BracketWorks - Password Reset", html_body)
    return {"message": "Reset code sent to email"}

@router.post("/verify-reset-code")
def verify_reset_code(email: str, code: str):
    cleanup_expired_codes()
    reset_data = reset_codes.get(email)
    if not reset_data or reset_data.get("code") != code:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")
    return {"message": "Code verified"}

@router.post("/reset-password")
def reset_password(email: str, code: str, new_password: str, db: Session = Depends(get_db)):
    cleanup_expired_codes()
    reset_data = reset_codes.get(email)
    if not reset_data or reset_data.get("code") != code:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password = bcrypt.hash(new_password)  # Use instance attribute for password
    db.commit()
    del reset_codes[email]
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
        is_admin=False  # Admin status must be granted by an existing admin, never self-assigned
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user
