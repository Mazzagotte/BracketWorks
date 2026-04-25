from pydantic import BaseModel, validator
from typing import ClassVar, Optional
import re

class BracketValidation(BaseModel):
    """Enhanced validation for bracket operations"""
    ALLOWED_BRACKET_SIZES: ClassVar[set[int]] = {8}
    
    @staticmethod
    def validate_bracket_size(size: int) -> int:
        """Ensure bracket size is one of the supported values."""
        if not isinstance(size, int):
            raise ValueError("Bracket size must be an integer")
        if size not in BracketValidation.ALLOWED_BRACKET_SIZES:
            allowed = ", ".join(str(s) for s in sorted(BracketValidation.ALLOWED_BRACKET_SIZES))
            raise ValueError(f"Bracket size must be one of: {allowed}")
        return size
    
    @staticmethod
    def validate_tournament_id(tournament_id) -> int:
        """Validate tournament ID - accepts string or int"""
        # Convert to int if it's a string
        try:
            tournament_id_int = int(tournament_id)
        except (ValueError, TypeError):
            raise ValueError("Tournament ID must be a positive integer")
        
        if tournament_id_int <= 0:
            raise ValueError("Tournament ID must be a positive integer")
        
        return tournament_id_int
    
    @staticmethod
    def sanitize_player_name(name: str) -> str:
        """Sanitize player names to prevent XSS"""
        if not isinstance(name, str):
            raise ValueError("Player name must be a string")
        
        # Check for potentially malicious content BEFORE sanitizing
        if '<script' in name.lower() or 'javascript:' in name.lower():
            raise ValueError("Invalid characters in player name")
        
        # Remove potential HTML tags
        name = re.sub(r'<[^>]*>', '', name)
        # Limit length
        name = name[:100]
        # Remove excessive whitespace
        name = ' '.join(name.split())
        
        if not name.strip():
            raise ValueError("Player name cannot be empty")
            
        return name.strip()
    
    @staticmethod
    def validate_score(score: Optional[int]) -> Optional[int]:
        """Validate bowling scores"""
        if score is None:
            return None
        
        if not isinstance(score, int) or score < 0 or score > 300:
            raise ValueError("Score must be between 0 and 300")
        
        return score

class TournamentCreateValidated(BaseModel):
    name: str
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    
    @validator('name')
    def validate_name(cls, v):
        if not v or len(v.strip()) < 2:
            raise ValueError("Tournament name must be at least 2 characters")
        if len(v) > 100:
            raise ValueError("Tournament name must be less than 100 characters")
        return v.strip()
    
    @validator('location')
    def validate_location(cls, v):
        if v and len(v) > 200:
            raise ValueError("Location must be less than 200 characters")
        return v.strip() if v else None