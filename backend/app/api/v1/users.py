from fastapi import BackgroundTasks, status, APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from ...core import models, schemas
from ..deps import get_db
from fastapi.responses import JSONResponse
from passlib.hash import bcrypt
import secrets
import smtplib
from email.message import EmailMessage

router = APIRouter()

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not bcrypt.verify(form_data.password, user.password):
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

# In-memory store for reset codes (use Redis or DB in production)
reset_codes = {}

def send_email(to_email: str, subject: str, body: str):
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = "your@email.com"
    msg["To"] = to_email
    msg.set_content(body)

    # SMTP placeholder settings
    smtp_server = "smtp.yourprovider.com"
    smtp_port = 587
    smtp_user = "your@email.com"
    smtp_password = "yourpassword"

    try:
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
    except Exception as e:
        print(f"Email send failed: {e}")

@router.post("/request-password-reset")
def request_password_reset(email: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Find user by email
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    code = secrets.token_urlsafe(8)
    reset_codes[email] = code
    background_tasks.add_task(send_email, email, "Password Reset", f"Your reset code: {code}")
    return {"message": "Reset code sent to email"}

@router.post("/verify-reset-code")
def verify_reset_code(email: str, code: str):
    if reset_codes.get(email) != code:
        raise HTTPException(status_code=400, detail="Invalid reset code")
    return {"message": "Code verified"}

@router.post("/reset-password")
def reset_password(email: str, code: str, new_password: str, db: Session = Depends(get_db)):
    if reset_codes.get(email) != code:
        raise HTTPException(status_code=400, detail="Invalid reset code")
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
        is_admin=bool(user.is_admin) if hasattr(user, 'is_admin') else False
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user
