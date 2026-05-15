from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, declarative_base, mapped_column, synonym

Base = declarative_base()


class UserSquadSelection(Base):
    __tablename__ = "user_squad_selections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    tournament_squad_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournament_squads.id"), nullable=False, index=True)

    squad_id = synonym("tournament_squad_id")


class TournamentSquad(Base):
    __tablename__ = "tournament_squads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournaments.id"), nullable=False, index=True)
    date: Mapped[str] = mapped_column(String, nullable=False)
    time: Mapped[str] = mapped_column(String, nullable=False)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    organization: Mapped[str | None] = mapped_column(String, nullable=True)
    password: Mapped[str] = mapped_column(String, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)

    @property
    def email_verified(self) -> bool:
        return self.email_verified_at is not None


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_family: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    refresh_token_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    source_ip_hash: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    user_agent_fingerprint: Mapped[str | None] = mapped_column(String(128), nullable=True)
    device_nickname: Mapped[str | None] = mapped_column(String(120), nullable=True)
    region_hint: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    risk_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    issued_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    is_revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    replaced_by_session_id: Mapped[str | None] = mapped_column(String(64), nullable=True)


class LoginAttempt(Base):
    __tablename__ = "login_attempts"
    __table_args__ = (
        UniqueConstraint("username", "source_ip_hash", name="uq_login_attempt_username_ip"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    source_ip_hash: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    window_start: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    blocked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"
    __table_args__ = (
        UniqueConstraint("idempotency_key", "endpoint_scope", name="uq_idempotency_key_scope"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    endpoint_scope: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    request_fingerprint: Mapped[str] = mapped_column(String(128), nullable=False)
    user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    response_body: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    state: Mapped[str] = mapped_column(String(24), nullable=False, default="processing", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)


class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String, nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    admin_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    target_type: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    target_id: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, index=True)


class BowlerProfile(Base):
    __tablename__ = "bowler_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    first_name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    last_name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    usbc_number: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class TournamentPlayer(Base):
    __tablename__ = "tournament_players"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournaments.id"), nullable=False, index=True)
    squad_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tournament_squads.id"), nullable=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    bowler_profile_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("bowler_profiles.id"), nullable=True, index=True)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    average: Mapped[int | None] = mapped_column(Integer, nullable=True)
    handicap_pins: Mapped[int | None] = mapped_column(Integer, nullable=True)
    handicap_entry_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scratch_entry_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    program_entry_counts: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    lane: Mapped[str | None] = mapped_column(String, nullable=True)
    division: Mapped[str | None] = mapped_column(String, nullable=True, default="Open")
    usbc_number: Mapped[str | None] = mapped_column(String, nullable=True)
    amount_paid: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.0)

    name = synonym("full_name")
    handicap = synonym("handicap_pins")
    handicap_entries = synonym("handicap_entry_count")
    scratch_entries = synonym("scratch_entry_count")
    bracket_entries = synonym("program_entry_counts")
    usbc = synonym("usbc_number")


class Tournament(Base):
    __tablename__ = "tournaments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    start_date: Mapped[str | None] = mapped_column(String, nullable=True)
    end_date: Mapped[str | None] = mapped_column(String, nullable=True)
    squad_times: Mapped[str | None] = mapped_column(Text, nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    archive_reason: Mapped[str | None] = mapped_column(String, nullable=True)


class TournamentBracketSettings(Base):
    __tablename__ = "tournament_bracket_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournaments.id"), nullable=False, index=True)
    bracket_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    first_place_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    second_place_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    house_fee_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    default_entry_fee: Mapped[float | None] = mapped_column(Float, nullable=True)
    bracket_programs: Mapped[list | None] = mapped_column(JSON, nullable=True)
    handicap_percentage: Mapped[float | None] = mapped_column(Float, nullable=True, default=80.0)
    handicap_base: Mapped[float | None] = mapped_column(Float, nullable=True, default=200.0)
    allow_byes: Mapped[bool | None] = mapped_column(Boolean, nullable=True, default=False)

    first_place = synonym("first_place_amount")
    second_place = synonym("second_place_amount")
    house_amount = synonym("house_fee_amount")
    cost_per_bracket = synonym("default_entry_fee")
    allow_bye = synonym("allow_byes")


class PlayerScore(Base):
    __tablename__ = "player_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    player_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournament_players.id"), nullable=False, index=True)
    tournament_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournaments.id"), nullable=False, index=True)
    squad_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournament_squads.id"), nullable=False, index=True)
    game1_scratch: Mapped[int | None] = mapped_column(Integer, nullable=True)
    game1_with_handicap: Mapped[int | None] = mapped_column(Integer, nullable=True)
    game2_scratch: Mapped[int | None] = mapped_column(Integer, nullable=True)
    game2_with_handicap: Mapped[int | None] = mapped_column(Integer, nullable=True)
    game3_scratch: Mapped[int | None] = mapped_column(Integer, nullable=True)
    game3_with_handicap: Mapped[int | None] = mapped_column(Integer, nullable=True)

    bowler_id = synonym("player_id")
    game1_total = synonym("game1_with_handicap")
    game2_total = synonym("game2_with_handicap")
    game3_total = synonym("game3_with_handicap")


class BracketWinner(Base):
    __tablename__ = "bracket_winners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournaments.id"), nullable=False, index=True)
    squad_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tournament_squads.id"), nullable=True, index=True)
    bracket_snapshot_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("bracket_snapshots.id"), nullable=True, index=True)
    player_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournament_players.id"), nullable=False, index=True)
    bracket_group_key: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    bracket_label: Mapped[str] = mapped_column(String(100), nullable=False)
    placement: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    placement_text: Mapped[str] = mapped_column(String(10), nullable=False)
    player_name: Mapped[str] = mapped_column(String(100), nullable=False)
    winning_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)

    bracket_id = synonym("bracket_snapshot_id")
    bowler_id = synonym("player_id")
    bracket_type = synonym("bracket_group_key")
    bracket_name = synonym("bracket_label")


class BracketPayout(Base):
    __tablename__ = "bracket_payouts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournaments.id"), nullable=False, index=True)
    squad_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tournament_squads.id"), nullable=True, index=True)
    bracket_snapshot_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("bracket_snapshots.id"), nullable=True, index=True)
    bracket_winner_id: Mapped[int] = mapped_column(Integer, ForeignKey("bracket_winners.id"), nullable=False, index=True)
    player_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournament_players.id"), nullable=False, index=True)
    bracket_group_key: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    bracket_label: Mapped[str] = mapped_column(String(100), nullable=False)
    placement: Mapped[int] = mapped_column(Integer, nullable=False)
    player_name: Mapped[str] = mapped_column(String(100), nullable=False)
    prize_pool_total: Mapped[float] = mapped_column(Float, nullable=False)
    payout_percentage: Mapped[float] = mapped_column(Float, nullable=False)
    payout_amount: Mapped[float] = mapped_column(Float, nullable=False)
    entry_fee: Mapped[float] = mapped_column(Float, nullable=False)
    bracket_size: Mapped[int] = mapped_column(Integer, nullable=False)
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    paid_date: Mapped[str | None] = mapped_column(String, nullable=True)
    payment_method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)

    bracket_id = synonym("bracket_snapshot_id")
    winner_id = synonym("bracket_winner_id")
    bowler_id = synonym("player_id")
    bracket_type = synonym("bracket_group_key")
    bracket_name = synonym("bracket_label")


class TournamentPayoutSummary(Base):
    __tablename__ = "tournament_payout_summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournaments.id"), nullable=False, index=True)
    squad_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tournament_squads.id"), nullable=True, index=True)
    total_prize_pool: Mapped[float] = mapped_column(Float, nullable=False)
    total_scratch_pool: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    total_handicap_pool: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    total_paid_out: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    total_unpaid: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    scratch_brackets_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    handicap_brackets_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_winners: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    scratch_entry_fee: Mapped[float] = mapped_column(Float, nullable=False)
    handicap_entry_fee: Mapped[float] = mapped_column(Float, nullable=False)
    house_percentage: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.0)
    house_fee_amount: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.0)
    is_finalized: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    finalized_date: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)

    house_amount = synonym("house_fee_amount")


class FirstRoundMatchupHistory(Base):
    __tablename__ = "first_round_matchup_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournaments.id"), nullable=False, index=True)
    left_player_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournament_players.id"), nullable=False, index=True)
    right_player_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournament_players.id"), nullable=False, index=True)
    bracket_group_key: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    bracket_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    player_a_id = synonym("left_player_id")
    player_b_id = synonym("right_player_id")
    bracket_type = synonym("bracket_group_key")


class BracketSnapshot(Base):
    __tablename__ = "bracket_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournaments.id"), nullable=False, index=True)
    squad_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tournament_squads.id"), nullable=True, index=True)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    bracket_size: Mapped[int] = mapped_column(Integer, nullable=False, default=8)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_current: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    bracket_data = synonym("payload")
    is_active = synonym("is_current")


SelectedSquad = UserSquadSelection
Squad = TournamentSquad
Bowler = TournamentPlayer
BowlerProfileModel = BowlerProfile
BracketSettings = TournamentBracketSettings
Score = PlayerScore
TournamentWinner = BracketWinner
TournamentPayout = BracketPayout
PayoutSummary = TournamentPayoutSummary
MatchHistory = FirstRoundMatchupHistory
SimpleBracket = BracketSnapshot
