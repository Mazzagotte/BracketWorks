"""
Standalone FastAPI backend for BracketWorks - No app module dependencies
This runs directly without needing the app module structure
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os

# Create the FastAPI app
app = FastAPI(title="BracketWorks API", version="0.0.1")

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://bracketworks.onrender.com",
        "https://www.bracketworks.onrender.com", 
        "http://localhost:3000",
        "http://localhost:8000",
        "*"  # Allow all for testing
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["*"],
)

# Pydantic models for request/response validation
class LoginRequest(BaseModel):
    username: str
    password: str
    grant_type: str = "password"

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    user: dict
    first_name: str

# Fake data for testing
fake_users = {
    "test@example.com": {
        "id": 1,
        "email": "test@example.com",
        "name": "Test User",
        "password": "test123"
    }
}

fake_bowlers = [
    {"id": 1, "name": "John Doe", "average": 185, "handicap": 15, "scratch": 3},
    {"id": 2, "name": "Jane Smith", "average": 170, "handicap": 20, "scratch": 2},
    {"id": 3, "name": "Mike Johnson", "average": 195, "handicap": 8, "scratch": 4}
]

@app.get("/")
def root():
    return {
        "message": "BracketWorks API is running!",
        "status": "ok",
        "version": "0.0.1"
    }

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/api/v1/health")
def api_health():
    return {"status": "ok"}

@app.get("/api/v1/health/status")
def api_health_status():
    return {"status": "ok", "message": "API is healthy"}

@app.post("/api/v1/users/login", response_model=LoginResponse)
def login(credentials: LoginRequest):
    # Handle JSON login data (clean API design)
    email = credentials.username.lower().strip()
    password = credentials.password.strip()
    
    if email in fake_users and fake_users[email]["password"] == password:
        user_data = fake_users[email]
        return LoginResponse(
            access_token="fake-jwt-token-12345",
            token_type="bearer",
            user_id=str(user_data["id"]),
            user={
                "id": str(user_data["id"]),
                "email": user_data["email"],
                "name": user_data["name"]
            },
            first_name=user_data["name"]
        )
    
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