
from pydantic import BaseModel
import os


class Settings(BaseModel):
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    DATABASE_URL: str = "postgresql://bracketworks_database_user:MW0r5GaFvgwfEQ7LLqArlUKOybMlkYLG@dpg-d34bbaripnbc73fqtcng-a.oregon-postgres.render.com/bracketworks_database"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me")

settings = Settings()
