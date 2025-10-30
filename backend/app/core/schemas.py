from pydantic import BaseModel, EmailStr
from typing import Dict, List, Optional

class LoginRequest(BaseModel):
    username: str
    password: str
    grant_type: Optional[str] = "password"

class SelectedSquadBase(BaseModel):
    user_id: int
    squad_id: int

class SelectedSquadCreate(SelectedSquadBase):
    pass

class SelectedSquadOut(SelectedSquadBase):
    id: int

    class Config:
        from_attributes = True

class SelectedSquadDelete(BaseModel):
    user_id: int

class SquadBase(BaseModel):
    tournament_id: int
    date: str
    time: str

class SquadCreate(SquadBase):
    pass

class Squad(SquadBase):
    id: int

    class Config:
        from_attributes = True

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
    tournament_id: int
    squad_id: int | None = None
    user_id: int
    name: str
    average: int | None = None
    handicap: int | None = None
    scratch: int | None = None
    lane: str | None = None
    division: str | None = None
    usbc: str | None = None
    amount_paid: float | None = None

class BowlerCreate(BowlerBase):
    pass

class BowlerUpdate(BaseModel):
    tournament_id: int | None = None
    squad_id: int | None = None
    user_id: int | None = None
    name: str | None = None
    average: int | None = None
    handicap: int | None = None
    scratch: int | None = None
    lane: str | None = None
    division: str | None = None
    usbc: str | None = None
    amount_paid: float | None = None

class Bowler(BowlerBase):
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
    pass  # user_id will be set from the authenticated user, not from request body

class TournamentUpdate(TournamentBase):
    pass

class Tournament(TournamentBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True

class BracketSettingsBase(BaseModel):
    tournament_id: int
    bracket_size: Optional[int] = None
    first_place: Optional[float] = None
    second_place: Optional[float] = None
    house_amount: Optional[float] = None
    cost_per_bracket: Optional[float] = None
    handicap_percentage: Optional[float] = 80.0
    handicap_base: Optional[float] = 200.0

class BracketSettingsCreate(BracketSettingsBase):
    pass

class BracketSettingsUpdate(BaseModel):
    bracket_size: Optional[int] = None
    first_place: Optional[float] = None
    second_place: Optional[float] = None
    house_amount: Optional[float] = None
    cost_per_bracket: Optional[float] = None
    handicap_percentage: Optional[float] = None
    handicap_base: Optional[float] = None

class BracketSettings(BracketSettingsBase):
    id: int

    class Config:
        from_attributes = True
