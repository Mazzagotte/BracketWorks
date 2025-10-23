
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

# Secure CORS configuration
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
_origins_raw = os.getenv("CORS_ORIGINS", "http://localhost:3000").strip()

if ENVIRONMENT == "production":
    # Production: Only allow specific domains
    origins = [o.strip() for o in _origins_raw.split(",") if o.strip() and not o.strip().startswith("http://localhost")]
    allow_credentials = True
    allowed_methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    logger.info(f"Production CORS origins: {origins}")
else:
    # Development: Allow localhost variations
    base_origins = [o.strip() for o in _origins_raw.split(",") if o.strip()]
    dev_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000", 
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ]
    origins = list(set(base_origins + dev_origins))
    allow_credentials = True
    allowed_methods = ["*"]
    logger.info(f"Development CORS origins: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=allow_credentials,
    allow_methods=allowed_methods,
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
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
