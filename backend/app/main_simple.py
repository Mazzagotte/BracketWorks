"""
Ultra-minimal FastAPI backend for BracketWorks
This version has zero external dependencies except FastAPI and should always start
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import json

app = FastAPI(title="BracketWorks API", version="0.0.1")

# Simple CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for now to test
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# In-memory data store for testing
fake_users = {
    "test@example.com": {
        "id": 1,
        "email": "test@example.com",
        "name": "Test User",
        "password": "test123"  # In reality, this would be hashed
    }
}

fake_bowlers = [
    {"id": 1, "name": "John Doe", "average": 185, "handicap": 15, "scratch": 3},
    {"id": 2, "name": "Jane Smith", "average": 170, "handicap": 20, "scratch": 2},
    {"id": 3, "name": "Mike Johnson", "average": 195, "handicap": 8, "scratch": 4}
]

@app.get("/")
def root():
    return {"message": "BracketWorks API is running!", "status": "ok"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/api/v1/health")
def api_health():
    return {"status": "ok"}

@app.get("/api/v1/health/status")
def api_health_status():
    return {"status": "ok", "message": "API is healthy"}

@app.post("/api/v1/users/login")
def login(credentials: dict):
    email = credentials.get("email", "").lower()
    password = credentials.get("password", "")
    
    if email in fake_users and fake_users[email]["password"] == password:
        return {
            "access_token": "fake-jwt-token",
            "token_type": "bearer",
            "user": {
                "id": fake_users[email]["id"],
                "email": fake_users[email]["email"],
                "name": fake_users[email]["name"]
            }
        }
    
    raise HTTPException(status_code=401, detail="Invalid credentials")

@app.get("/api/v1/bowlers/")
def get_bowlers():
    return fake_bowlers

@app.post("/api/v1/bowlers/")
def create_bowler(bowler: dict):
    new_bowler = {
        "id": len(fake_bowlers) + 1,
        "name": f"{bowler.get('name', 'Unknown')}",
        "average": bowler.get("average", 0),
        "handicap": bowler.get("handicap", 0),
        "scratch": bowler.get("scratch", 0)
    }
    fake_bowlers.append(new_bowler)
    return new_bowler

@app.get("/api/v1/tournaments/{tournament_id}")
def get_tournament(tournament_id: int):
    return {
        "id": tournament_id,
        "name": "Test Tournament",
        "location": "Test Bowling Center",
        "date": "2024-01-15"
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)