from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, synonym


class Base(DeclarativeBase):
    pass


class UserSquadSelection(Base):
    __tablename__ = "user_squad_selections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    tournament_squad_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tournament_squads.id"), nullable=False, index=True
    )

    squad_id = synonym("tournament_squad_id")


class TournamentSquad(Base):
    __tablename__ = "tournament_squads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tournaments.id"), nullable=False, index=True
    )
    date: Mapped[str] = mapped_column(String, nullable=False)
    time: Mapped[str] = mapped_column(String, nullable=False)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(
        String, unique=True, index=True, nullable=False
    )
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    organization: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    password: Mapped[str] = mapped_column(String, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    email_verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True, index=True
    )
    dev_notice_version_accepted: Mapped[Optional[str]] = mapped_column(
        String(10), nullable=True
    )
    dev_notice_accepted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True
    )

    @property
    def email_verified(self) -> bool:
        return self.email_verified_at is not None


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    token_family: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    refresh_token_hash: Mapped[str] = mapped_column(
        String(128), nullable=False, unique=True, index=True
    )
    source_ip_hash: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True, index=True
    )
    user_agent_fingerprint: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True
    )
    device_nickname: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    region_hint: Mapped[Optional[str]] = mapped_column(
        String(80), nullable=True, index=True
    )
    risk_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    is_revoked: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, index=True
    )
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    replaced_by_session_id: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True
    )


class LoginAttempt(Base):
    __tablename__ = "login_attempts"
    __table_args__ = (
        UniqueConstraint(
            "username", "source_ip_hash", name="uq_login_attempt_username_ip"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    source_ip_hash: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    window_start: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    blocked_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"
    __table_args__ = (
        UniqueConstraint(
            "idempotency_key", "endpoint_scope", name="uq_idempotency_key_scope"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    idempotency_key: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True
    )
    endpoint_scope: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    request_fingerprint: Mapped[str] = mapped_column(String(128), nullable=False)
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True, index=True
    )
    status_code: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    response_body: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    state: Mapped[str] = mapped_column(
        String(24), nullable=False, default="processing", index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(
        String(128), nullable=False, unique=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    used_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True, index=True
    )


class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    email: Mapped[str] = mapped_column(String, nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(
        String(128), nullable=False, unique=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    used_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True, index=True
    )


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    admin_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    action: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    target_type: Mapped[Optional[str]] = mapped_column(
        String(40), nullable=True, index=True
    )
    target_id: Mapped[Optional[str]] = mapped_column(String(80), nullable=True, index=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    details: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True
    )


class AdminUserReview(Base):
    __tablename__ = "admin_user_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    admin_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    note: Mapped[str] = mapped_column(Text, nullable=False)
    is_resolved: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, index=True
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    resolved_by_user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class UserFeedbackMessage(Base):
    __tablename__ = "user_feedback_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    subject: Mapped[str] = mapped_column(String(160), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open", index=True)
    admin_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resolved_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class AdminTournamentNote(Base):
    __tablename__ = "admin_tournament_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournaments.id"), nullable=False, index=True)
    admin_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    note: Mapped[str] = mapped_column(Text, nullable=False)
    is_resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    resolved_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class AdminAnnouncement(Base):
    __tablename__ = "admin_announcements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    audience_type: Mapped[str] = mapped_column(String(30), nullable=False, default="all", index=True)
    audience_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft", index=True)
    requires_acknowledgment: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    starts_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    created_by_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class UserAcknowledgment(Base):
    __tablename__ = "user_acknowledgments"
    __table_args__ = (UniqueConstraint("user_id", "content_type", "content_id", "version", name="uq_user_ack_content_version"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    content_id: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    version: Mapped[str] = mapped_column(String(40), nullable=False)
    acknowledged_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True)


class LegalDisclosureAcceptance(Base):
    __tablename__ = "legal_disclosure_acceptances"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    disclosure_version: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    disclosure_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    accepted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    next_required_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    acceptance_source: Mapped[str] = mapped_column(String(40), nullable=False, default="required_modal")


class BowlerProfile(Base):
    __tablename__ = "bowler_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    first_name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    last_name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    usbc_number: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, index=True
    )
    archived_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class TournamentPlayer(Base):
    __tablename__ = "tournament_players"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tournaments.id"), nullable=False, index=True
    )
    squad_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("tournament_squads.id"), nullable=True, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    bowler_profile_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("bowler_profiles.id"), nullable=True, index=True
    )
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    average: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    handicap_pins: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    handicap_entry_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    scratch_entry_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    program_entry_counts: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    side_pot_entries: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    lane: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    division: Mapped[Optional[str]] = mapped_column(String, nullable=True, default="Open")
    usbc_number: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    amount_paid: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=0.0)

    name = synonym("full_name")
    handicap = synonym("handicap_pins")
    handicap_entries = synonym("handicap_entry_count")
    scratch_entries = synonym("scratch_entry_count")
    bracket_entries = synonym("program_entry_counts")
    usbc = synonym("usbc_number")


class DuplicatePlayerResolution(Base):
    __tablename__ = "duplicate_player_resolutions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournaments.id"), nullable=False, index=True)
    left_player_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournament_players.id"), nullable=False, index=True)
    right_player_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournament_players.id"), nullable=False, index=True)
    resolution: Mapped[str] = mapped_column(String(30), nullable=False)
    resolved_by_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True)
    __table_args__ = (UniqueConstraint("tournament_id", "left_player_id", "right_player_id", name="uq_duplicate_player_pair"),)


class Tournament(Base):
    __tablename__ = "tournaments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    start_date: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    end_date: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    squad_times: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    archived_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True, index=True
    )
    archive_reason: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    lifecycle_status: Mapped[str] = mapped_column(String(32), nullable=False, default="setup", index=True)
    scores_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    finalized_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    finalized_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)


class TournamentAuditLog(Base):
    __tablename__ = "tournament_audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tournaments.id"), nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True, index=True
    )
    user_display_name: Mapped[str] = mapped_column(String(160), nullable=False)
    summary: Mapped[str] = mapped_column(String(500), nullable=False)
    before_values: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    after_values: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    entity_type: Mapped[Optional[str]] = mapped_column(String(60), nullable=True, index=True)
    entity_id: Mapped[Optional[str]] = mapped_column(String(80), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True
    )


class TournamentStaffMember(Base):
    __tablename__ = "tournament_staff_members"
    __table_args__ = (UniqueConstraint("tournament_id", "user_id", name="uq_tournament_staff_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournaments.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    invited_by_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class TournamentStaffInvitation(Base):
    __tablename__ = "tournament_staff_invitations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournaments.id"), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    invited_by_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    responded_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class TournamentRestorePoint(Base):
    __tablename__ = "tournament_restore_points"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournaments.id"), nullable=False, index=True)
    created_by_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    trigger: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    summary: Mapped[str] = mapped_column(String(500), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    activity_watermark_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True)
    restored_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    restored_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)


class TournamentCentral(Base):
    __tablename__ = "tc_tournaments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    venue_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("tc_venues.id"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    start_date: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    end_date: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    squad_times: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    logo_blob: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    logo_mime_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    logo_file_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)


class TcVenue(Base):
    __tablename__ = "tc_venues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    address_line_1: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address_line_2: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    zip: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, default="US")
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    external_provider: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    external_place_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        index=True,
    )

    __table_args__ = (
        UniqueConstraint("external_provider", "external_place_id", name="uq_tc_venues_external_place"),
    )


class TournamentSetupState(Base):
    __tablename__ = "tournament_setup_states"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tournaments.id"), nullable=False, index=True, unique=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        index=True,
    )


class TournamentCentralSetupState(Base):
    __tablename__ = "tc_tournament_setup_states"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tc_tournaments.id"), nullable=False, index=True, unique=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        index=True,
    )


class TcTournamentDocument(Base):
    __tablename__ = "tc_tournament_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tc_tournaments.id"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    doc_type: Mapped[str] = mapped_column(String(40), nullable=False, default="other")
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(120), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    file_blob: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True
    )


class TcRegistration(Base):
    __tablename__ = "tc_registrations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    confirmation_code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    tournament_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("tc_tournaments.id"),
        nullable=False,
        index=True,
    )
    account_user_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )
    contact_first_name: Mapped[str] = mapped_column(String(120), nullable=False)
    contact_last_name: Mapped[str] = mapped_column(String(120), nullable=False)
    contact_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending", index=True)
    payment_status: Mapped[str] = mapped_column(String(24), nullable=False, default="unpaid", index=True)
    subtotal_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    fees_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    terms_accepted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        index=True,
    )
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    source: Mapped[str] = mapped_column(String(40), nullable=False, default="public")


class TcRegistrationBowler(Base):
    __tablename__ = "tc_registration_bowlers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    registration_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("tc_registrations.id"),
        nullable=False,
        index=True,
    )
    tournament_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("tc_tournaments.id"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )
    first_name: Mapped[str] = mapped_column(String(120), nullable=False)
    last_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    usbc_number: Mapped[Optional[str]] = mapped_column(String(40), nullable=True, index=True)
    average: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    date_of_birth: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    zip_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        index=True,
    )


class TcEntry(Base):
    __tablename__ = "tc_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    registration_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("tc_registrations.id"),
        nullable=False,
        index=True,
    )
    tournament_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("tc_tournaments.id"),
        nullable=False,
        index=True,
    )
    event_config_id: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    event_name_snapshot: Mapped[str] = mapped_column(String(255), nullable=False)
    division_config_id: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, index=True)
    division_name_snapshot: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    squad_config_id: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, index=True)
    squad_name_snapshot: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    squad_date_snapshot: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    squad_time_snapshot: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    entry_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reentry_number: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending", index=True)
    entry_fee_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        index=True,
    )


class TcEntryBowler(Base):
    __tablename__ = "tc_entry_bowlers"
    __table_args__ = (
        UniqueConstraint("entry_id", "bowler_id", name="uq_tc_entry_bowler_pair"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    entry_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("tc_entries.id"),
        nullable=False,
        index=True,
    )
    bowler_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("tc_registration_bowlers.id"),
        nullable=False,
        index=True,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    role: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)


class TcRegistrationAnswer(Base):
    __tablename__ = "tc_registration_answers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    registration_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("tc_registrations.id"),
        nullable=False,
        index=True,
    )
    entry_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("tc_entries.id"),
        nullable=True,
        index=True,
    )
    bowler_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("tc_registration_bowlers.id"),
        nullable=True,
        index=True,
    )
    question_config_id: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    question_label_snapshot: Mapped[str] = mapped_column(String(255), nullable=False)
    answer_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )


class TournamentBracketSettings(Base):
    __tablename__ = "tournament_bracket_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tournaments.id"), nullable=False, index=True
    )
    bracket_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    first_place_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    second_place_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    house_fee_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    default_entry_fee: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bracket_programs: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    side_pots_settings: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    handicap_percentage: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True, default=80.0
    )
    handicap_base: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True, default=200.0
    )
    allow_byes: Mapped[Optional[bool]] = mapped_column(
        Boolean, nullable=True, default=False
    )

    first_place = synonym("first_place_amount")
    second_place = synonym("second_place_amount")
    house_amount = synonym("house_fee_amount")
    cost_per_bracket = synonym("default_entry_fee")
    allow_bye = synonym("allow_byes")


class PlayerScore(Base):
    __tablename__ = "player_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    player_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tournament_players.id"), nullable=False, index=True
    )
    tournament_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tournaments.id"), nullable=False, index=True
    )
    squad_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tournament_squads.id"), nullable=False, index=True
    )
    game1_scratch: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    game1_with_handicap: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    game2_scratch: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    game2_with_handicap: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    game3_scratch: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    game3_with_handicap: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    bowler_id = synonym("player_id")
    game1_total = synonym("game1_with_handicap")
    game2_total = synonym("game2_with_handicap")
    game3_total = synonym("game3_with_handicap")


class ScoreCorrection(Base):
    __tablename__ = "score_corrections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournaments.id"), nullable=False, index=True)
    score_id: Mapped[int] = mapped_column(Integer, ForeignKey("player_scores.id"), nullable=False, index=True)
    player_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournament_players.id"), nullable=False, index=True)
    field_name: Mapped[str] = mapped_column(String(40), nullable=False)
    old_value: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    new_value: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reason: Mapped[str] = mapped_column(String(1000), nullable=False)
    changed_by_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True)


class BracketWinner(Base):
    __tablename__ = "bracket_winners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tournaments.id"), nullable=False, index=True
    )
    squad_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("tournament_squads.id"), nullable=True, index=True
    )
    bracket_snapshot_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("bracket_snapshots.id"), nullable=True, index=True
    )
    player_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tournament_players.id"), nullable=False, index=True
    )
    bracket_group_key: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )
    bracket_label: Mapped[str] = mapped_column(String(100), nullable=False)
    placement: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    placement_text: Mapped[str] = mapped_column(String(10), nullable=False)
    player_name: Mapped[str] = mapped_column(String(100), nullable=False)
    winning_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)

    bracket_id = synonym("bracket_snapshot_id")
    bowler_id = synonym("player_id")
    bracket_type = synonym("bracket_group_key")
    bracket_name = synonym("bracket_label")


class BracketPayout(Base):
    __tablename__ = "bracket_payouts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tournaments.id"), nullable=False, index=True
    )
    squad_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("tournament_squads.id"), nullable=True, index=True
    )
    bracket_snapshot_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("bracket_snapshots.id"), nullable=True, index=True
    )
    bracket_winner_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("bracket_winners.id"), nullable=False, index=True
    )
    player_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tournament_players.id"), nullable=False, index=True
    )
    bracket_group_key: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )
    bracket_label: Mapped[str] = mapped_column(String(100), nullable=False)
    placement: Mapped[int] = mapped_column(Integer, nullable=False)
    player_name: Mapped[str] = mapped_column(String(100), nullable=False)
    prize_pool_total: Mapped[float] = mapped_column(Float, nullable=False)
    payout_percentage: Mapped[float] = mapped_column(Float, nullable=False)
    payout_amount: Mapped[float] = mapped_column(Float, nullable=False)
    entry_fee: Mapped[float] = mapped_column(Float, nullable=False)
    bracket_size: Mapped[int] = mapped_column(Integer, nullable=False)
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    paid_date: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    payment_method: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
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
    tournament_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tournaments.id"), nullable=False, index=True
    )
    squad_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("tournament_squads.id"), nullable=True, index=True
    )
    total_prize_pool: Mapped[float] = mapped_column(Float, nullable=False)
    total_scratch_pool: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0
    )
    total_handicap_pool: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0
    )
    total_paid_out: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    total_unpaid: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    scratch_brackets_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    handicap_brackets_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    total_winners: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    scratch_entry_fee: Mapped[float] = mapped_column(Float, nullable=False)
    handicap_entry_fee: Mapped[float] = mapped_column(Float, nullable=False)
    house_percentage: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True, default=0.0
    )
    house_fee_amount: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True, default=0.0
    )
    is_finalized: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    finalized_date: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    calculated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    calculated_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    finalized_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)

    house_amount = synonym("house_fee_amount")


class PayoutAdjustment(Base):
    __tablename__ = "payout_adjustments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournaments.id"), nullable=False, index=True)
    payout_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("bracket_payouts.id"), nullable=True, index=True)
    adjustment_type: Mapped[str] = mapped_column(String(30), nullable=False)
    old_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    new_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    reason: Mapped[str] = mapped_column(String(1000), nullable=False)
    adjusted_by_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True)


class FirstRoundMatchupHistory(Base):
    __tablename__ = "first_round_matchup_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tournaments.id"), nullable=False, index=True
    )
    left_player_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tournament_players.id"), nullable=False, index=True
    )
    right_player_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tournament_players.id"), nullable=False, index=True
    )
    bracket_group_key: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )
    bracket_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    player_a_id = synonym("left_player_id")
    player_b_id = synonym("right_player_id")
    bracket_type = synonym("bracket_group_key")


class BracketSnapshot(Base):
    __tablename__ = "bracket_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tournaments.id"), nullable=False, index=True
    )
    squad_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("tournament_squads.id"), nullable=True, index=True
    )
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    bracket_size: Mapped[int] = mapped_column(Integer, nullable=False, default=8)
    player_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    is_current: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    bracket_data = synonym("payload")
    is_active = synonym("is_current")


class Changelog(Base):
    __tablename__ = "changelog"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    version: Mapped[str] = mapped_column(String(20), nullable=False, unique=True, index=True)
    date: Mapped[str] = mapped_column(String(10), nullable=False)
    changes: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


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
