
from pydantic import BaseModel
import os

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
    
    # Email Settings
    SENDGRID_API_KEY: str = os.getenv("SENDGRID_API_KEY", "")
    FROM_EMAIL: str = os.getenv("FROM_EMAIL", "support@bracketworks.app")
    FROM_NAME: str = os.getenv("FROM_NAME", "BracketWorks")
    
    # Caching
    CACHE_TTL_SECONDS: int = int(os.getenv("CACHE_TTL_SECONDS", "300"))
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"
    
    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"

settings = Settings()
