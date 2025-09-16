
from pydantic import BaseModel
import os

class Settings(BaseModel):
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "bracketworks")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "bracketworks")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "bracketworks")
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "db")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me")

settings = Settings()
