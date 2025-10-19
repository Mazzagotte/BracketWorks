
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from app.api.v1.tournaments import router as tournaments_router
from app.api.v1.squads import router as squads_router
from app.api.v1.brackets import router as brackets_router
from app.api.v1.bowlers import router as bowlers_router
from app.api.v1.users import router as users_router
from app.api.v1.bracket_settings import router as bracket_settings_router
from app.api.v1.scores import router as scores_router
from app.api.v1.payouts import router as payouts_router
from app.api.v1.health import router as health_router
from app.core.monitoring import setup_monitoring
from app.core.logging_config import setup_logging

# Initialize logging
logger = setup_logging()
logger.info("Starting BracketWorks API...")

app = FastAPI(
    title="BracketWorks API", 
    version="1.0.0",
    description="Professional bowling tournament bracket management system",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add monitoring middleware
setup_monitoring(app)

# Configurable and safe CORS defaults
_origins_raw = os.getenv("CORS_ORIGINS", "http://localhost:3000").strip()
origins = [o.strip() for o in _origins_raw.split(",") if o.strip()]
allow_credentials = True
if _origins_raw == "*" or "*" in origins:
    origins = ["*"]
    allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https?://(localhost|127\\.0\\.1)(:\\d+)?",
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers
app.include_router(health_router, prefix="/api/v1/health", tags=["health"])
app.include_router(tournaments_router, prefix="/api/v1/tournaments", tags=["tournaments"])
app.include_router(squads_router, prefix="/api/v1/squads", tags=["squads"])
app.include_router(brackets_router, prefix="/api/v1/brackets", tags=["brackets"])
app.include_router(bowlers_router, prefix="/api/v1/bowlers", tags=["bowlers"])
app.include_router(users_router, prefix="/api/v1/users", tags=["users"])
app.include_router(bracket_settings_router, prefix="/api/v1/bracket-settings", tags=["bracket-settings"])
app.include_router(scores_router, prefix="/api/v1/scores", tags=["scores"])
app.include_router(payouts_router, prefix="/api/v1/payouts", tags=["payouts"])
