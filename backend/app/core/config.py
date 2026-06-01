
from pathlib import Path

from pydantic import model_validator
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
    CORS_ORIGINS: str = "https://bracketworks.app,https://www.bracketworks.app"
    DEV_CORS_ORIGINS: str = "http://localhost:3000,http://localhost:8000,http://127.0.0.1:3000,http://127.0.0.1:8000"
    TRUSTED_PROXY_IPS: str = "127.0.0.1,::1"
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
    REFRESH_TOKEN_COOKIE_NAME: str = "refresh_token"
    REFRESH_TOKEN_COOKIE_PATH: str = "/api/v1/users"
    REFRESH_TOKEN_COOKIE_DOMAIN: str = ""
    REFRESH_TOKEN_COOKIE_SAMESITE: str = "lax"
    REFRESH_TOKEN_COOKIE_SECURE: bool = True
    CSRF_HEADER_NAME: str = "x-csrf-token"
    CSRF_COOKIE_NAME: str = "csrf_token"
    CSRF_COOKIE_PATH: str = "/api/v1/users"
    CSRF_COOKIE_DOMAIN: str = ""
    CSRF_COOKIE_SAMESITE: str = "lax"
    CSRF_COOKIE_SECURE: bool = True
    CSRF_PROTECT_REFRESH_AND_LOGOUT: bool = True
    SECURITY_HEADERS_ENABLED: bool = True
    SECURITY_HEADERS_HSTS_MAX_AGE_SECONDS: int = 31536000
    LOGIN_RATE_LIMIT_WINDOW_MINUTES: int = 15
    LOGIN_RATE_LIMIT_ACCOUNT_THRESHOLD: int = 5
    LOGIN_RATE_LIMIT_IP_HARD_CAP: int = 25
    LOGIN_RATE_LIMIT_BASE_BLOCK_SECONDS: int = 30
    LOGIN_RATE_LIMIT_MAX_BLOCK_SECONDS: int = 900
    PASSWORD_MIN_LENGTH: int = 12
    PASSWORD_REQUIRE_UPPERCASE: bool = True
    PASSWORD_REQUIRE_LOWERCASE: bool = True
    PASSWORD_REQUIRE_DIGIT: bool = True
    PASSWORD_REQUIRE_SYMBOL: bool = True
    PASSWORD_BREACH_CHECK_ENABLED: bool = True
    PASSWORD_BREACH_API_TIMEOUT_SECONDS: int = 4
    PASSWORD_BREACH_MAX_COUNT: int = 0
    PASSWORD_BCRYPT_ROUNDS: int = 12

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

    @model_validator(mode="after")
    def validate_security_settings(self) -> "Settings":
        if not self.is_production:
            return self

        secret = (self.SECRET_KEY or "").strip()
        weak_secret_values = {
            "",
            "change-me-in-production",
            "changeme",
            "secret",
            "default",
        }

        if self.DEBUG:
            raise ValueError("DEBUG must be false in production")

        if secret in weak_secret_values or len(secret) < 32:
            raise ValueError(
                "SECRET_KEY is too weak for production. Use a cryptographically random value with length >= 32."
            )

        if "localhost" in self.CORS_ORIGINS.lower() or "127.0.0.1" in self.CORS_ORIGINS:
            raise ValueError("CORS_ORIGINS cannot include localhost values in production")

        valid_samesite = {"lax", "strict", "none"}
        if self.REFRESH_TOKEN_COOKIE_SAMESITE.lower() not in valid_samesite:
            raise ValueError("REFRESH_TOKEN_COOKIE_SAMESITE must be one of: lax, strict, none")

        if self.REFRESH_TOKEN_COOKIE_SAMESITE.lower() == "none" and not self.REFRESH_TOKEN_COOKIE_SECURE:
            raise ValueError("REFRESH_TOKEN_COOKIE_SECURE must be true when REFRESH_TOKEN_COOKIE_SAMESITE is 'none'")

        if self.CSRF_COOKIE_SAMESITE.lower() not in valid_samesite:
            raise ValueError("CSRF_COOKIE_SAMESITE must be one of: lax, strict, none")

        if self.CSRF_COOKIE_SAMESITE.lower() == "none" and not self.CSRF_COOKIE_SECURE:
            raise ValueError("CSRF_COOKIE_SECURE must be true when CSRF_COOKIE_SAMESITE is 'none'")

        if self.PASSWORD_BCRYPT_ROUNDS < 12:
            raise ValueError("PASSWORD_BCRYPT_ROUNDS must be >= 12 in production")

        return self


settings = Settings()
