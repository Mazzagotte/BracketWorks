
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parents[3] / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # API Settings
    CORS_ORIGINS: str = "http://localhost:3000"
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "BracketWorks API"

    # Database
    DATABASE_URL: str = "postgresql://bracketworks:bracketworks@localhost:5432/bracketworks"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 30

    # Security
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    LOGIN_RATE_LIMIT_WINDOW_MINUTES: int = 15
    LOGIN_RATE_LIMIT_ACCOUNT_THRESHOLD: int = 5
    LOGIN_RATE_LIMIT_IP_HARD_CAP: int = 25
    LOGIN_RATE_LIMIT_BASE_BLOCK_SECONDS: int = 30
    LOGIN_RATE_LIMIT_MAX_BLOCK_SECONDS: int = 900

    # Email Settings
    RESEND_API_KEY: str = ""
    FROM_EMAIL: str = "no-reply@bracketworks.app"
    FROM_NAME: str = "BracketWorks"
    FRONTEND_URL: str = "https://bracketworks.app"

    # Logging
    LOG_LEVEL: str = "INFO"

    # Distributed rate limiting
    REDIS_URL: str = ""
    RATE_LIMIT_KEY_PREFIX: str = "bracketworks:ratelimit"
    RATE_LIMIT_LOGIN_PER_MINUTE: int = 10
    RATE_LIMIT_PASSWORD_RESET_PER_MINUTE: int = 6
    RATE_LIMIT_PUBLIC_PER_MINUTE: int = 120
    RATE_LIMIT_BRACKET_GENERATE_PER_MINUTE: int = 20

    # Experimental bracket optimizer
    BRACKETS_EXPERIMENTAL_ENABLED: bool = True
    BRACKETS_EXPERIMENTAL_ATTEMPTS: int = 64

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"


settings = Settings()
