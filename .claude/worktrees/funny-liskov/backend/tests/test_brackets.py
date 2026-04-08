import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import tempfile
import os
import sys
import json

# Add the parent directory to the path so we can import app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from app.api.deps import get_db
from app.core.models import Base

# Create test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="session")
def client():
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    with TestClient(app) as test_client:
        yield test_client
    
    # Drop tables after tests
    Base.metadata.drop_all(bind=engine)

@pytest.mark.unit
def test_app_health(client):
    """Test that the app is running"""
    response = client.get("/docs")
    assert response.status_code == 200

@pytest.mark.unit
def test_brackets_list_endpoint(client):
    """Test the brackets list endpoint"""
    response = client.get("/api/v1/brackets")
    assert response.status_code == 200
    # Should return empty list initially
    assert response.json() == []

@pytest.mark.unit
def test_bracket_generation_service():
    """Test bracket generation logic directly"""
    from app.services.brackets import generate_bracket_preview
    
    # Test valid bracket size
    preview = generate_bracket_preview(8)
    assert preview is not None
    assert "rounds" in preview
    assert len(preview["rounds"]) > 0
    
    # Test the bracket structure
    first_round = preview["rounds"][0]
    assert "matches" in first_round
    assert len(first_round["matches"]) == 4  # 8 players = 4 matches in first round

@pytest.mark.unit
def test_invalid_bracket_size():
    """Test validation for invalid bracket sizes"""
    from app.core.validators import BracketValidation
    
    # Test non-power of 2
    with pytest.raises(ValueError):
        BracketValidation.validate_bracket_size(6)
    
    # Test too small
    with pytest.raises(ValueError):
        BracketValidation.validate_bracket_size(2)
    
    # Test too large  
    with pytest.raises(ValueError):
        BracketValidation.validate_bracket_size(128)
    
    # Test valid size
    assert BracketValidation.validate_bracket_size(8) == 8

@pytest.mark.unit
def test_bracket_preview_generation():
    """Test bracket preview generation with different sizes"""
    from app.services.brackets import generate_bracket_preview
    
    # Test 4-player bracket
    preview_4 = generate_bracket_preview(4)
    assert preview_4["size"] == 4
    
    # Test 8-player bracket  
    preview_8 = generate_bracket_preview(8)
    assert preview_8["size"] == 8
    
    # Test 16-player bracket
    preview_16 = generate_bracket_preview(16)
    assert preview_16["size"] == 16

@pytest.mark.unit
def test_input_validation():
    """Test input validation functions"""
    from app.core.validators import BracketValidation
    
    # Test player name sanitization
    assert BracketValidation.sanitize_player_name("John Doe") == "John Doe"
    assert BracketValidation.sanitize_player_name("  John   Doe  ") == "John Doe"
    
    with pytest.raises(ValueError):
        BracketValidation.sanitize_player_name("")
        
    # Test script tag detection
    with pytest.raises(ValueError):
        BracketValidation.sanitize_player_name("John<script>alert('xss')</script>Doe")
    
    # Test score validation
    assert BracketValidation.validate_score(150) == 150
    assert BracketValidation.validate_score(None) is None
    
    with pytest.raises(ValueError):
        BracketValidation.validate_score(-1)
    
    with pytest.raises(ValueError):
        BracketValidation.validate_score(301)

@pytest.mark.integration
def test_cache_functionality():
    """Test caching functionality"""
    from app.core.cache import bracket_cache
    
    # Test cache set/get
    test_data = {"test": "data"}
    bracket_cache.set("test_key", test_data)
    
    retrieved = bracket_cache.get("test_key")
    assert retrieved == test_data
    
    # Test cache invalidation
    bracket_cache.invalidate("test")
    assert bracket_cache.get("test_key") is None

@pytest.mark.slow
@pytest.mark.integration
def test_large_bracket_generation():
    """Test generation of large brackets"""
    from app.services.brackets import generate_bracket_preview
    
    # Test 64-player bracket (maximum size)
    preview_64 = generate_bracket_preview(64)
    assert preview_64["size"] == 64
    assert len(preview_64["rounds"]) == 6  # 64 -> 32 -> 16 -> 8 -> 4 -> 2 -> 1
    
    # First round should have 32 matches (64 players / 2)
    first_round = preview_64["rounds"][0]
    assert len(first_round["matches"]) == 32

@pytest.mark.unit
def test_match_score_validation():
    """Test match score update validation"""
    from app.api.v1.brackets import MatchScoreUpdate
    
    # Valid scores
    update = MatchScoreUpdate(
        bracket_id="scratch_1",
        round_index=0,
        match_index=0,
        score_a=150,
        score_b=175
    )
    assert update.score_a == 150
    assert update.score_b == 175
    
    # Invalid scores should raise ValueError
    with pytest.raises(ValueError):
        MatchScoreUpdate(
            bracket_id="scratch_1",
            round_index=0,
            match_index=0,
            score_a=-1,  # Invalid
            score_b=175
        )