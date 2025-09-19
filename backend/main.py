
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from app.api.v1.tournaments import router as tournaments_router

app = FastAPI()

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

# Include the tournaments router for all /api/v1/tournaments endpoints
app.include_router(tournaments_router, prefix="/api/v1/tournaments")
