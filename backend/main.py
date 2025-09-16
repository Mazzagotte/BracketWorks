from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

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
    allow_origin_regex=r"https?://(localhost|127\\.0\\.0\\.1)(:\\d+)?",
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/v1/tournaments/")
async def read_tournaments():
    return [{"id": 1, "name": "Tournament 1"}, {"id": 2, "name": "Tournament 2"}]

@app.post("/api/v1/tournaments/")
async def create_tournament(tournament: dict):
    return {"id": 3, "name": tournament["name"]}

@app.put("/api/v1/tournaments/{tournament_id}")
async def update_tournament(tournament_id: int, tournament: dict):
    return {"id": tournament_id, "name": tournament["name"]}
