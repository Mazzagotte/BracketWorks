from pydantic import BaseModel
from typing import Dict, List, Optional
from pydantic import BaseModel, EmailStr
from typing import Optional

class UserCreate(BaseModel):
    first_name: str
    last_name: str
    username: str
    email: EmailStr
    organization: Optional[str] = None
    password: str
    is_admin: Optional[int] = 0

class UserOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    username: str
    email: EmailStr
    organization: Optional[str] = None
    is_admin: int
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
    user_id: Optional[int] = None

class TournamentCreate(TournamentBase):
    pass

class TournamentUpdate(TournamentBase):
    pass

class Tournament(TournamentBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True
