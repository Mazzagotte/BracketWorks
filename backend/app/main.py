from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .api.v1 import health, bowlers, brackets, tournaments, users

app = FastAPI(title="BracketWorks API", version="0.0.1")

# Robust CORS for local dev and configured origins
_origins_raw = (settings.CORS_ORIGINS or "").strip()
origins = [o.strip() for o in _origins_raw.split(",") if o.strip()]

# If wildcard is used, credentials must be disabled per CORS spec
allow_credentials = True
if _origins_raw == "*" or "*" in origins:
    origins = ["*"]
    allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    # Allow any localhost/127.0.0.1 port during development
    allow_origin_regex=r"https?://(localhost|127\\.0\\.0\\.1)(:\\d+)?",
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1/health", tags=["health"])
app.include_router(bowlers.router, prefix="/api/v1/bowlers", tags=["bowlers"])
app.include_router(brackets.router, prefix="/api/v1/brackets", tags=["brackets"])
app.include_router(tournaments.router, prefix="/api/v1/tournaments", tags=["tournaments"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
