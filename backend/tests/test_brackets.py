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
def test_brackets_preview_endpoint(client):
    """Test the brackets preview endpoint"""
    response = client.get("/api/v1/brackets/preview?size=8")
    assert response.status_code == 200
    data = response.json()
    assert "rounds" in data

@pytest.mark.unit
def test_bracket_generation_service():
    """Test bracket generation logic directly"""
    from app.services.brackets_simple import generate_bracket_preview
    
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
    """Test bracket preview generation"""
    from app.services.brackets_simple import generate_bracket_preview
    
    # generate_bracket_preview only supports size=8
    preview_8 = generate_bracket_preview(8)
    assert preview_8["size"] == 8
    assert "rounds" in preview_8
    assert len(preview_8["rounds"]) == 3  # 8 -> 4 -> 2 -> winner (3 rounds)

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
    """Test that generate_bracket_preview enforces its size constraint"""
    from app.services.brackets_simple import generate_bracket_preview
    import pytest as _pytest
    
    # Only size 8 is supported
    preview_8 = generate_bracket_preview(8)
    assert preview_8["size"] == 8
    
    # Other sizes raise ValueError
    with _pytest.raises(ValueError):
        generate_bracket_preview(64)

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


@pytest.mark.unit
def test_detect_bye_misconfiguration_errors_one_short_without_byes():
    from app.api.v1.brackets import detect_bye_misconfiguration_errors

    result = {
        "bracket_groups": [
            {
                "key": "womens_scratch",
                "name": "Women's Scratch",
                "allow_byes": False,
                "entries_count": 7,
                "refund_entries": 7,
                "brackets": [],
            }
        ]
    }

    errors = detect_bye_misconfiguration_errors(result, bracket_size=8)
    assert len(errors) == 1
    assert "Women's Scratch" in errors[0]
    assert "Enable allow_byes" in errors[0]

