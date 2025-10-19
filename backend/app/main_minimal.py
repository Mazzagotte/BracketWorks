import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Create a minimal FastAPI app that starts without database dependencies
app = FastAPI(
    title="BracketWorks API",
    version="0.0.1",
    description="Bowling Tournament Management API"
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

print(f"CORS Origins configured: {origins}")  # For debugging

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
        "status": "healthy",
        "cors_origins": origins
    }

# Basic health endpoint
@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "API is running"}

# API v1 health endpoint
@app.get("/api/v1/health/status")
async def api_health():
    return {"status": "ok", "message": "API v1 is healthy"}

# Only import and include routers if database is available
try:
    # Test database connection before importing database-dependent modules
    database_url = os.getenv("DATABASE_URL")
    if database_url and "postgresql" in database_url:
        print("Database URL found, importing full API modules...")
        
        # Import API modules only if database is available
        from app.api.v1 import health, bowlers, brackets, tournaments, users, squads, bracket_settings, scores, payouts

        # Include all routers
        app.include_router(health.router, prefix="/api/v1/health", tags=["health"])
        app.include_router(bowlers.router, prefix="/api/v1/bowlers", tags=["bowlers"])
        app.include_router(brackets.router, prefix="/api/v1/brackets", tags=["brackets"])
        app.include_router(tournaments.router, prefix="/api/v1/tournaments", tags=["tournaments"])
        app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
        app.include_router(squads.router, prefix="/api/v1/squads", tags=["squads"])
        app.include_router(bracket_settings.router, prefix="/api/v1/bracket-settings", tags=["bracket-settings"])
        app.include_router(scores.router, prefix="/api/v1/scores", tags=["scores"])
        app.include_router(payouts.router, prefix="/api/v1/payouts", tags=["payouts"])
        
        print("✅ All API routers loaded successfully")
    else:
        print("⚠️ No database URL found, running in minimal mode")
        
except Exception as e:
    print(f"⚠️ Could not load full API modules: {e}")
    print("Running in minimal mode with basic health checks only")

# Additional startup info
@app.on_event("startup")
async def startup_event():
    print("🚀 BracketWorks API starting up...")
    print(f"Environment: {os.getenv('NODE_ENV', 'development')}")
    print(f"CORS Origins: {origins}")