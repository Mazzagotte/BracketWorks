from pydantic import AliasChoices, BaseModel, ConfigDict, EmailStr, Field, field_validator
from datetime import datetime
from typing import Dict, List, Optional


class BracketProgramDefinition(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    key: str
    name: str
    division: Optional[str] = "Any"
    scoring_mode: str = Field(validation_alias=AliasChoices("scoring_mode", "scoringMode"))
    entry_fee: Optional[float] = Field(default=None, validation_alias=AliasChoices("entry_fee", "entryFee"))
    enabled: bool = True
    allow_byes: Optional[bool] = Field(default=False, validation_alias=AliasChoices("allow_byes", "allowByes"))
    display_order: Optional[int] = Field(default=None, validation_alias=AliasChoices("display_order", "displayOrder"))

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
    model_config = ConfigDict(from_attributes=True)

    id: int

class SelectedSquadDelete(BaseModel):
    user_id: int

class SquadBase(BaseModel):
    tournament_id: int
    date: str
    time: str

class SquadCreate(SquadBase):
    pass

class Squad(SquadBase):
    model_config = ConfigDict(from_attributes=True)

    id: int

class UserCreate(BaseModel):
    first_name: str
    last_name: str
    username: str
    email: EmailStr
    organization: Optional[str] = None
    password: str

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str
    last_name: str
    username: str
    email: EmailStr
    organization: Optional[str] = None
    is_admin: int


class UserAccountUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    organization: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class PlayerBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    tournament_id: int
    squad_id: int | None = None
    user_id: int | None = None
    full_name: str = Field(validation_alias=AliasChoices("full_name", "name"))
    average: int | None = None
    handicap_entry_count: int | None = Field(default=None, validation_alias=AliasChoices("handicap_entry_count", "handicap_entries"))
    scratch_entry_count: int | None = Field(default=None, validation_alias=AliasChoices("scratch_entry_count", "scratch_entries"))
    program_entry_counts: Dict[str, int] | None = Field(default=None, validation_alias=AliasChoices("program_entry_counts", "bracket_entries"))
    lane: str | None = None
    division: str | None = None
    usbc_number: str | None = Field(default=None, validation_alias=AliasChoices("usbc_number", "usbc"))
    amount_paid: float | None = None


class PlayerCreate(PlayerBase):
    pass


class PlayerUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    tournament_id: int | None = None
    squad_id: int | None = None
    user_id: int | None = None
    full_name: str | None = Field(default=None, validation_alias=AliasChoices("full_name", "name"))
    average: int | None = None
    handicap_entry_count: int | None = Field(default=None, validation_alias=AliasChoices("handicap_entry_count", "handicap_entries"))
    scratch_entry_count: int | None = Field(default=None, validation_alias=AliasChoices("scratch_entry_count", "scratch_entries"))
    program_entry_counts: Dict[str, int] | None = Field(default=None, validation_alias=AliasChoices("program_entry_counts", "bracket_entries"))
    lane: str | None = None
    division: str | None = None
    usbc_number: str | None = Field(default=None, validation_alias=AliasChoices("usbc_number", "usbc"))
    amount_paid: float | None = None


class Player(PlayerBase):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int

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
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int


class TournamentBracketSettingsBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    tournament_id: int
    bracket_size: Optional[int] = None
    first_place_amount: Optional[float] = Field(default=None, validation_alias=AliasChoices("first_place_amount", "first_place"))
    second_place_amount: Optional[float] = Field(default=None, validation_alias=AliasChoices("second_place_amount", "second_place"))
    house_fee_amount: Optional[float] = Field(default=None, validation_alias=AliasChoices("house_fee_amount", "house_amount"))
    default_entry_fee: Optional[float] = Field(default=None, validation_alias=AliasChoices("default_entry_fee", "cost_per_bracket"))
    bracket_programs: List[BracketProgramDefinition] | None = None
    handicap_percentage: Optional[float] = 80.0
    handicap_base: Optional[float] = 200.0
    allow_byes: Optional[bool] = Field(default=False, validation_alias=AliasChoices("allow_byes", "allow_bye"))

    @field_validator('bracket_size')
    @classmethod
    def validate_bracket_size(cls, value: Optional[int]) -> Optional[int]:
        if value is None:
            return value
        if value != 8:
            raise ValueError('Bracket size must be 8 for three-game sets')
        return value

class TournamentBracketSettingsCreate(TournamentBracketSettingsBase):
    pass


class TournamentBracketSettingsUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    bracket_size: Optional[int] = None
    first_place_amount: Optional[float] = Field(default=None, validation_alias=AliasChoices("first_place_amount", "first_place"))
    second_place_amount: Optional[float] = Field(default=None, validation_alias=AliasChoices("second_place_amount", "second_place"))
    house_fee_amount: Optional[float] = Field(default=None, validation_alias=AliasChoices("house_fee_amount", "house_amount"))
    default_entry_fee: Optional[float] = Field(default=None, validation_alias=AliasChoices("default_entry_fee", "cost_per_bracket"))
    bracket_programs: List[BracketProgramDefinition] | None = None
    handicap_percentage: Optional[float] = None
    handicap_base: Optional[float] = None
    allow_byes: Optional[bool] = Field(default=None, validation_alias=AliasChoices("allow_byes", "allow_bye"))

    @field_validator('bracket_size')
    @classmethod
    def validate_bracket_size(cls, value: Optional[int]) -> Optional[int]:
        if value is None:
            return value
        if value != 8:
            raise ValueError('Bracket size must be 8 for three-game sets')
        return value

class TournamentBracketSettings(TournamentBracketSettingsBase):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int


BowlerBase = PlayerBase
BowlerCreate = PlayerCreate
BowlerUpdate = PlayerUpdate
Bowler = Player
BracketSettingsBase = TournamentBracketSettingsBase
BracketSettingsCreate = TournamentBracketSettingsCreate
BracketSettingsUpdate = TournamentBracketSettingsUpdate
BracketSettings = TournamentBracketSettings
