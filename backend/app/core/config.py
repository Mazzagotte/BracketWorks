
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel
import os


load_dotenv(Path(__file__).resolve().parents[3] / ".env", override=False)

class Settings(BaseModel):
    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
    
    # API Settings
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "BracketWorks API"
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql://bracketworks:bracketworks@localhost:5432/bracketworks"
    )
    DATABASE_POOL_SIZE: int = int(os.getenv("DATABASE_POOL_SIZE", "20"))  # Increased for dev
    DATABASE_MAX_OVERFLOW: int = int(os.getenv("DATABASE_MAX_OVERFLOW", "30"))  # Increased for dev
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me-in-production")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "120"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))
    LOGIN_RATE_LIMIT_WINDOW_MINUTES: int = int(os.getenv("LOGIN_RATE_LIMIT_WINDOW_MINUTES", "15"))
    LOGIN_RATE_LIMIT_ACCOUNT_THRESHOLD: int = int(os.getenv("LOGIN_RATE_LIMIT_ACCOUNT_THRESHOLD", "5"))
    LOGIN_RATE_LIMIT_IP_HARD_CAP: int = int(os.getenv("LOGIN_RATE_LIMIT_IP_HARD_CAP", "25"))
    LOGIN_RATE_LIMIT_BASE_BLOCK_SECONDS: int = int(os.getenv("LOGIN_RATE_LIMIT_BASE_BLOCK_SECONDS", "30"))
    LOGIN_RATE_LIMIT_MAX_BLOCK_SECONDS: int = int(os.getenv("LOGIN_RATE_LIMIT_MAX_BLOCK_SECONDS", "900"))
    
    # Email Settings
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    FROM_EMAIL: str = os.getenv("FROM_EMAIL", "no-reply@bracketworks.app")
    FROM_NAME: str = os.getenv("FROM_NAME", "BracketWorks")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "https://bracketworks.app")
    
    # Caching
    CACHE_TTL_SECONDS: int = int(os.getenv("CACHE_TTL_SECONDS", "300"))
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    # Distributed rate limiting
    REDIS_URL: str = os.getenv("REDIS_URL", "")
    RATE_LIMIT_KEY_PREFIX: str = os.getenv("RATE_LIMIT_KEY_PREFIX", "bracketworks:ratelimit")
    RATE_LIMIT_LOGIN_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_LOGIN_PER_MINUTE", "10"))
    RATE_LIMIT_PASSWORD_RESET_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PASSWORD_RESET_PER_MINUTE", "6"))
    RATE_LIMIT_PUBLIC_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PUBLIC_PER_MINUTE", "120"))
    RATE_LIMIT_BRACKET_GENERATE_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_BRACKET_GENERATE_PER_MINUTE", "20"))

    # Experimental bracket optimizer
    BRACKETS_EXPERIMENTAL_ENABLED: bool = os.getenv("BRACKETS_EXPERIMENTAL_ENABLED", "true").lower() == "true"
    BRACKETS_EXPERIMENTAL_ATTEMPTS: int = int(os.getenv("BRACKETS_EXPERIMENTAL_ATTEMPTS", "64"))
    
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"
    
    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"

settings = Settings()
