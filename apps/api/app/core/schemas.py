from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional


class BracketProgramDefinition(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    key: str
    name: str
    division: Optional[str] = "Any"
    scoring_mode: str = Field(
        validation_alias=AliasChoices("scoring_mode", "scoringMode")
    )
    entry_fee: Optional[float] = Field(
        default=None, validation_alias=AliasChoices("entry_fee", "entryFee")
    )
    enabled: bool = True
    allow_byes: Optional[bool] = Field(
        default=False, validation_alias=AliasChoices("allow_byes", "allowByes")
    )
    display_order: Optional[int] = Field(
        default=None, validation_alias=AliasChoices("display_order", "displayOrder")
    )


class SidePotDefinition(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    key: str
    name: str
    enabled: bool = False


class SidePotsSettingsDefinition(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    tournament_id: int
    entry_fee: float = 0
    prize_amount: float = 0
    pots: List[SidePotDefinition] = Field(default_factory=list)


class SidePotWinner(BaseModel):
    player_id: int
    player_name: str


class SidePotAccountingSummary(BaseModel):
    key: str
    name: str
    entry_count: int
    pool: float
    status: Literal["empty", "pending", "complete", "tied"]
    winning_metric: Optional[int] = None
    winners: List[SidePotWinner] = Field(default_factory=list)
    # Legacy compatibility fields for existing clients that only support one winner.
    winner_id: Optional[int] = None
    winner_name: Optional[str] = None
    winner_metric: Optional[int] = None


class SidePotAccountingOut(BaseModel):
    tournament_id: int
    squad_id: Optional[int] = None
    entry_fee: float
    prize_amount: float
    total_pool: float
    summaries: List[SidePotAccountingSummary] = Field(default_factory=list)


class LoginRequest(BaseModel):
    username: str
    password: str
    grant_type: Optional[str] = "password"


class TokenPairResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    session_id: str
    user_id: int
    is_admin: bool
    first_name: Optional[str] = None
    challenge_required: bool = False
    challenge_type: Optional[str] = None
    dev_notice_required: bool = False
    dev_notice_version: str = "1.0"


class DevNoticeAcceptRequest(BaseModel):
    version: str


class DevNoticeAcceptResponse(BaseModel):
    accepted: bool
    version: str


class LegalDisclosureAcceptRequest(BaseModel):
    version: str


class LegalDisclosureStatus(BaseModel):
    required: bool
    version: str
    title: str
    effective_date: str
    body: List[str]
    acknowledgment: str
    accepted_at: Optional[datetime] = None
    next_required_at: Optional[datetime] = None


class ChangelogEntry(BaseModel):
    date: str
    version: str
    changes: List[str]


class ChangelogResponse(BaseModel):
    entries: List[ChangelogEntry]


class RefreshTokenRequest(BaseModel):
    pass


class LogoutRequest(BaseModel):
    all_sessions: bool = False


class SessionRevokeResponse(BaseModel):
    revoked_sessions: int


class SessionInfo(BaseModel):
    session_id: str
    issued_at: datetime
    last_seen_at: datetime
    expires_at: datetime
    is_revoked: bool
    revoked_at: Optional[datetime] = None
    device_nickname: Optional[str] = None
    region_hint: Optional[str] = None
    risk_score: float = 0.0
    is_current: bool = False


class SessionListResponse(BaseModel):
    sessions: List[SessionInfo]


class SessionRevokeRequest(BaseModel):
    session_id: str


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
    is_admin: bool
    email_verified: bool = False
    email_verified_at: Optional[datetime] = None


class UserAccountUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    organization: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class AccountDeletionRequest(BaseModel):
    current_password: str
    confirmation: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetVerifyRequest(BaseModel):
    email: Optional[EmailStr] = None
    token: Optional[str] = None
    code: Optional[str] = None

    @model_validator(mode="after")
    def validate_token_or_code(self):
        token_value = (self.token or self.code or "").strip()
        if not token_value:
            raise ValueError("token or code is required")
        return self


class PasswordResetConfirmRequest(PasswordResetVerifyRequest):
    new_password: str = Field(min_length=8)


class EmailVerificationConfirmRequest(BaseModel):
    token: Optional[str] = None
    code: Optional[str] = None

    @model_validator(mode="after")
    def validate_token_or_code(self):
        token_value = (self.token or self.code or "").strip()
        if not token_value:
            raise ValueError("token or code is required")
        return self


class PlayerBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    tournament_id: int
    squad_id: int | None = None
    user_id: int | None = None
    bowler_profile_id: int | None = None
    full_name: str = Field(validation_alias=AliasChoices("full_name", "name"))
    average: int | None = None
    handicap_entry_count: int | None = Field(
        default=None,
        validation_alias=AliasChoices("handicap_entry_count", "handicap_entries"),
    )
    scratch_entry_count: int | None = Field(
        default=None,
        validation_alias=AliasChoices("scratch_entry_count", "scratch_entries"),
    )
    program_entry_counts: Dict[str, int] | None = Field(
        default=None,
        validation_alias=AliasChoices("program_entry_counts", "bracket_entries"),
    )
    side_pot_entries: Dict[str, bool] | None = Field(
        default=None,
        validation_alias=AliasChoices("side_pot_entries", "sidePotEntries"),
    )
    lane: str | None = None
    division: str | None = None
    usbc_number: str | None = Field(
        default=None, validation_alias=AliasChoices("usbc_number", "usbc")
    )
    amount_paid: float | None = None


class PlayerCreate(PlayerBase):
    pass


class PlayerUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    tournament_id: int | None = None
    squad_id: int | None = None
    user_id: int | None = None
    bowler_profile_id: int | None = None
    full_name: str | None = Field(
        default=None, validation_alias=AliasChoices("full_name", "name")
    )
    average: int | None = None
    handicap_entry_count: int | None = Field(
        default=None,
        validation_alias=AliasChoices("handicap_entry_count", "handicap_entries"),
    )
    scratch_entry_count: int | None = Field(
        default=None,
        validation_alias=AliasChoices("scratch_entry_count", "scratch_entries"),
    )
    program_entry_counts: Dict[str, int] | None = Field(
        default=None,
        validation_alias=AliasChoices("program_entry_counts", "bracket_entries"),
    )
    side_pot_entries: Dict[str, bool] | None = Field(
        default=None,
        validation_alias=AliasChoices("side_pot_entries", "sidePotEntries"),
    )
    lane: str | None = None
    division: str | None = None
    usbc_number: str | None = Field(
        default=None, validation_alias=AliasChoices("usbc_number", "usbc")
    )
    amount_paid: float | None = None


class Player(PlayerBase):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int


class BowlerProfileBase(BaseModel):
    first_name: str
    last_name: str
    usbc_number: str | None = None


class BowlerProfile(BowlerProfileBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    is_active: bool
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime


class TournamentBase(BaseModel):
    name: str
    venue_id: Optional[int] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    squad_times: Dict[str, List[str]] = Field(default_factory=dict)


class TournamentCreate(TournamentBase):
    is_public: bool = False


class TournamentUpdate(TournamentBase):
    is_public: Optional[bool] = None


class Tournament(TournamentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    is_public: bool
    has_logo: Optional[bool] = None
    logo_file_name: Optional[str] = None
    logo_mime_type: Optional[str] = None
    venue: Optional["TcVenue"] = None
    entry_count: Optional[int] = None
    brackets_configured: Optional[bool] = None
    lifecycle_status: str = "setup"
    scores_locked: bool = False
    archived_at: Optional[datetime] = None
    finalized_at: Optional[datetime] = None
    finalized_by_user_id: Optional[int] = None


class TournamentAuditEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tournament_id: int
    event_type: str
    user_id: Optional[int] = None
    user_display_name: str
    summary: str
    before_values: Optional[Dict[str, Any]] = None
    after_values: Optional[Dict[str, Any]] = None
    reason: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    created_at: datetime


class TcVenueBase(BaseModel):
    name: str
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    external_provider: Optional[str] = None
    external_place_id: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None


class TcVenueCreate(TcVenueBase):
    name: str


class TcVenue(TcVenueBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class TcVenueSearchResult(BaseModel):
    source: Literal["internal", "external"]
    venue: TcVenue | TcVenueCreate


class TournamentSetupStateUpsert(BaseModel):
    payload: Dict[str, Any] = Field(default_factory=dict)
    is_published: bool = False


class TournamentSetupState(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tournament_id: int
    user_id: int
    payload: Dict[str, Any]
    is_published: bool
    created_at: datetime
    updated_at: datetime


class TournamentSetupStateSummary(BaseModel):
    tournament_id: int
    tournament_name: str
    tournament_location: str | None = None
    tournament_start_date: str | None = None
    tournament_end_date: str | None = None
    is_published: bool
    created_at: datetime
    updated_at: datetime


class TournamentBracketSettingsBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    tournament_id: int
    bracket_size: Optional[int] = None
    first_place_amount: Optional[float] = Field(
        default=None, validation_alias=AliasChoices("first_place_amount", "first_place")
    )
    second_place_amount: Optional[float] = Field(
        default=None,
        validation_alias=AliasChoices("second_place_amount", "second_place"),
    )
    house_fee_amount: Optional[float] = Field(
        default=None, validation_alias=AliasChoices("house_fee_amount", "house_amount")
    )
    default_entry_fee: Optional[float] = Field(
        default=None,
        validation_alias=AliasChoices("default_entry_fee", "cost_per_bracket"),
    )
    bracket_programs: List[BracketProgramDefinition] | None = None
    side_pots_settings: SidePotsSettingsDefinition | None = Field(
        default=None,
        validation_alias=AliasChoices("side_pots_settings", "sidePotsSettings"),
    )
    handicap_percentage: Optional[float] = 80.0
    handicap_base: Optional[float] = 200.0
    allow_byes: Optional[bool] = Field(
        default=False, validation_alias=AliasChoices("allow_byes", "allow_bye")
    )

    @field_validator("bracket_size")
    @classmethod
    def validate_bracket_size(cls, value: Optional[int]) -> Optional[int]:
        if value is None:
            return value
        if value != 8:
            raise ValueError("Bracket size must be 8 for three-game sets")
        return value


class TournamentBracketSettingsCreate(TournamentBracketSettingsBase):
    pass


class TournamentBracketSettingsUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    bracket_size: Optional[int] = None
    first_place_amount: Optional[float] = Field(
        default=None, validation_alias=AliasChoices("first_place_amount", "first_place")
    )
    second_place_amount: Optional[float] = Field(
        default=None,
        validation_alias=AliasChoices("second_place_amount", "second_place"),
    )
    house_fee_amount: Optional[float] = Field(
        default=None, validation_alias=AliasChoices("house_fee_amount", "house_amount")
    )
    default_entry_fee: Optional[float] = Field(
        default=None,
        validation_alias=AliasChoices("default_entry_fee", "cost_per_bracket"),
    )
    bracket_programs: List[BracketProgramDefinition] | None = None
    side_pots_settings: SidePotsSettingsDefinition | None = Field(
        default=None,
        validation_alias=AliasChoices("side_pots_settings", "sidePotsSettings"),
    )
    handicap_percentage: Optional[float] = None
    handicap_base: Optional[float] = None
    allow_byes: Optional[bool] = Field(
        default=None, validation_alias=AliasChoices("allow_byes", "allow_bye")
    )

    @field_validator("bracket_size")
    @classmethod
    def validate_bracket_size(cls, value: Optional[int]) -> Optional[int]:
        if value is None:
            return value
        if value != 8:
            raise ValueError("Bracket size must be 8 for three-game sets")
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
