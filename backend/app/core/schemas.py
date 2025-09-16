from pydantic import BaseModel
from typing import Dict, List, Optional

class BowlerBase(BaseModel):
    name: str
    average: int | None = None

class BowlerCreate(BowlerBase):
    pass

class Bowler(BowlerBase):
    id: int

    class Config:
        from_attributes = True

class BracketBase(BaseModel):
    name: str
    squad: str | None = None
    game_count: int = 3

class BracketCreate(BracketBase):
    pass

class Bracket(BracketBase):
    id: int

    class Config:
        from_attributes = True

class TournamentBase(BaseModel):
    name: str
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    squad_times: Dict[str, List[str]] = {}

class TournamentCreate(TournamentBase):
    pass

class TournamentUpdate(TournamentBase):
    pass

class Tournament(TournamentBase):
    id: int

    class Config:
        from_attributes = True
