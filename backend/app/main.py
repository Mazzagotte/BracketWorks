
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .api.v1 import health, bowlers, brackets, tournaments, users, squads, bracket_settings, scores, payouts

app = FastAPI(title="BracketWorks API", version="0.0.1")

# CORS origins - includes both local dev and production
origins = [
    "http://localhost:3000",
    "https://bracketworks.app",
    "https://www.bracketworks.app",
    "https://bracketworks-frontend.onrender.com"  # Add your Render frontend URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https?://(localhost|127\\.0\\.0\\.1)(:\\d+)?",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


app.include_router(health.router, prefix="/api/v1/health", tags=["health"])
app.include_router(bowlers.router, prefix="/api/v1/bowlers", tags=["bowlers"])
app.include_router(brackets.router, prefix="/api/v1/brackets", tags=["brackets"])
app.include_router(tournaments.router, prefix="/api/v1/tournaments", tags=["tournaments"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(squads.router, prefix="/api/v1/squads", tags=["squads"])
app.include_router(bracket_settings.router, prefix="/api/v1/bracket-settings", tags=["bracket-settings"])
app.include_router(scores.router, prefix="/api/v1/scores", tags=["scores"])
app.include_router(payouts.router, prefix="/api/v1/payouts", tags=["payouts"])
