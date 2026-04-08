
import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import health, bowlers, brackets, tournaments, users, squads, bracket_settings, scores, payouts
from app.core.config import settings
from app.core.monitoring import setup_monitoring

logger = logging.getLogger(__name__)

_is_production = settings.ENVIRONMENT == "production"
app = FastAPI(
    title="BracketWorks API",
    version="0.0.1",
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
    openapi_url=None if _is_production else "/openapi.json",
)

# CORS origins - get from environment variable with fallback to local dev
cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:3000")
origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]

# Add localhost patterns for development
origins.extend([
    "http://localhost:3000",
    "http://localhost:8000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000"
])

# Remove duplicates while preserving order
origins = list(dict.fromkeys(origins))

logger.info(f"CORS Origins configured: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https?://(localhost|127\\.0\\.0\\.1)(:\\d+)?",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Root endpoint for basic testing
@app.get("/")
async def root():
    return {
        "message": "BracketWorks API is running!",
        "version": "0.0.1",
        "status": "healthy"
    }

# Basic health endpoint
@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "API is running"}

app.include_router(health.router, prefix="/api/v1/health", tags=["health"])
app.include_router(bowlers.router, prefix="/api/v1/bowlers", tags=["bowlers"])
app.include_router(brackets.router, prefix="/api/v1/brackets", tags=["brackets"])
app.include_router(tournaments.router, prefix="/api/v1/tournaments", tags=["tournaments"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(squads.router, prefix="/api/v1/squads", tags=["squads"])
app.include_router(bracket_settings.router, prefix="/api/v1/bracket-settings", tags=["bracket-settings"])
app.include_router(scores.router, prefix="/api/v1/scores", tags=["scores"])
app.include_router(payouts.router, prefix="/api/v1/payouts", tags=["payouts"])

setup_monitoring(app)
