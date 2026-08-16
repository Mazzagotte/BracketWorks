from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
import math
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import MetaData, String, Table, asc, delete, desc, func, inspect, or_, select, text
from sqlalchemy.orm import Session

from ..deps import get_db, require_admin_user
from ...core import models
from ...core.password_policy import PasswordPolicyError, validate_password_policy
from ...core.config import settings
from ...core.async_jobs import job_store, to_dict as job_to_dict

_pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__default_rounds=settings.PASSWORD_BCRYPT_ROUNDS,
)


class AdminUpdateUserPayload(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    organization: Optional[str] = None


class AdminSetUserAdminPayload(BaseModel):
    is_admin: bool


class AdminSetUserActivePayload(BaseModel):
    is_active: bool


class AdminResetPasswordPayload(BaseModel):
    new_password: str


class AdminDeleteUserPayload(BaseModel):
    reason: str
    confirm_text: str


class AdminUpdateTournamentPayload(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_public: Optional[bool] = None


class AdminReassignTournamentPayload(BaseModel):
    new_owner_user_id: int


class AdminArchiveTournamentPayload(BaseModel):
    reason: Optional[str] = None


class AdminDeleteTournamentPayload(BaseModel):
    reason: Optional[str] = None
    force: bool = False
    confirm_text: Optional[str] = None


class AdminCreateChangelogPayload(BaseModel):
    version: str
    date: str
    changes: list[str]


class AdminUpdateChangelogPayload(BaseModel):
    date: Optional[str] = None
    changes: Optional[list[str]] = None


class AdminUserReviewPayload(BaseModel):
    kind: str
    category: str
    note: str


class AdminResolveUserReviewPayload(BaseModel):
    resolved: bool = True


class AdminTournamentNotePayload(BaseModel):
    category: str
    note: str


class AdminAnnouncementPayload(BaseModel):
    title: str
    message: str
    audience_type: str = "all"
    audience_user_id: Optional[int] = None
    status: str = "draft"
    requires_acknowledgment: bool = False
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


class AdminFeedbackUpdatePayload(BaseModel):
    status: str
    admin_note: Optional[str] = None


router = APIRouter()


def _set_admin_cache_headers(response: Response, *, max_age: int, stale_while_revalidate: int = 0) -> None:
    parts = ["private", f"max-age={max_age}"]
    if stale_while_revalidate > 0:
        parts.append(f"stale-while-revalidate={stale_while_revalidate}")
    response.headers["Cache-Control"] = ", ".join(parts)
    response.headers["Vary"] = "Accept-Encoding, Authorization"


def _serialize_value(value: Any):
    if value is None:
        return None

    if isinstance(value, bool | int | str):
        return value

    if isinstance(value, float):
        return value if math.isfinite(value) else None

    if isinstance(value, (datetime, date)):
        return value.isoformat()

    if isinstance(value, Decimal):
        return float(value)

    if isinstance(value, UUID):
        return str(value)

    if isinstance(value, (bytes, bytearray, memoryview)):
        return bytes(value).hex()

    if isinstance(value, dict):
        return {str(k): _serialize_value(v) for k, v in value.items()}

    if isinstance(value, (list, tuple, set)):
        return [_serialize_value(item) for item in value]

    return str(value)


def _serialize_utc_timestamp(value: datetime | None) -> str | None:
    if value is None:
        return None

    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    else:
        value = value.astimezone(UTC)

    return value.isoformat()


def _get_reflected_table(db: Session, table_name: str):
    metadata = MetaData()
    try:
        return Table(table_name, metadata, autoload_with=db.bind)
    except Exception:
        return None


def _total_pages(total: int, page_size: int) -> int:
    return max(1, math.ceil(total / page_size)) if total > 0 else 1


def _tournament_status(start_date: str | None, end_date: str | None, archived_at: datetime | None) -> str:
    if archived_at: return "archived"
    today = date.today().isoformat()
    if start_date and len(start_date) >= 10 and start_date[:10] > today: return "upcoming"
    if end_date and len(end_date) >= 10 and end_date[:10] < today: return "completed"
    return "current"


def _write_admin_audit(
    db: Session,
    admin_user_id: int,
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[str | int] = None,
    reason: Optional[str] = None,
    details: Optional[dict] = None,
) -> None:
    db.add(
        models.AdminAuditLog(
            admin_user_id=admin_user_id,
            action=action,
            target_type=target_type,
            target_id=str(target_id) if target_id is not None else None,
            reason=reason,
            details=details,
        )
    )


def _get_postgres_estimated_row_count(db: Session, table_name: str) -> Optional[int]:
    if db.bind is None or db.bind.dialect.name != "postgresql":
        return None

    estimate = db.execute(
        text(
            """
            SELECT reltuples::bigint
            FROM pg_class
            WHERE oid = to_regclass(:table_name)
            """
        ),
        {"table_name": table_name},
    ).scalar()

    if estimate is None:
        return None

    try:
        return int(estimate)
    except Exception:
        return None


def _get_tournament_delete_impact(db: Session, tournament_id: int) -> dict[str, int]:
    squad_ids = [
        row.id
        for row in db.execute(
            select(models.TournamentSquad.id).where(models.TournamentSquad.tournament_id == tournament_id)
        )
    ]

    user_squad_selection_count = 0
    if squad_ids:
        user_squad_selection_count = db.scalar(
            select(func.count())
            .select_from(models.UserSquadSelection)
            .where(models.UserSquadSelection.tournament_squad_id.in_(squad_ids))
        ) or 0

    return {
        "tournament": 1,
        "tournament_squads": db.scalar(select(func.count()).select_from(models.TournamentSquad).where(models.TournamentSquad.tournament_id == tournament_id)) or 0,
        "user_squad_selections": user_squad_selection_count,
        "tournament_players": db.scalar(select(func.count()).select_from(models.TournamentPlayer).where(models.TournamentPlayer.tournament_id == tournament_id)) or 0,
        "player_scores": db.scalar(select(func.count()).select_from(models.PlayerScore).where(models.PlayerScore.tournament_id == tournament_id)) or 0,
        "bracket_snapshots": db.scalar(select(func.count()).select_from(models.BracketSnapshot).where(models.BracketSnapshot.tournament_id == tournament_id)) or 0,
        "bracket_winners": db.scalar(select(func.count()).select_from(models.BracketWinner).where(models.BracketWinner.tournament_id == tournament_id)) or 0,
        "bracket_payouts": db.scalar(select(func.count()).select_from(models.BracketPayout).where(models.BracketPayout.tournament_id == tournament_id)) or 0,
        "payout_summaries": db.scalar(select(func.count()).select_from(models.TournamentPayoutSummary).where(models.TournamentPayoutSummary.tournament_id == tournament_id)) or 0,
        "first_round_history": db.scalar(select(func.count()).select_from(models.FirstRoundMatchupHistory).where(models.FirstRoundMatchupHistory.tournament_id == tournament_id)) or 0,
        "bracket_settings": db.scalar(select(func.count()).select_from(models.TournamentBracketSettings).where(models.TournamentBracketSettings.tournament_id == tournament_id)) or 0,
        "admin_notes": db.scalar(select(func.count()).select_from(models.AdminTournamentNote).where(models.AdminTournamentNote.tournament_id == tournament_id)) or 0,
    }


def _hard_delete_tournament(db: Session, tournament_id: int) -> None:
    db.execute(delete(models.AdminTournamentNote).where(models.AdminTournamentNote.tournament_id == tournament_id))
    db.execute(delete(models.BracketPayout).where(models.BracketPayout.tournament_id == tournament_id))
    db.execute(delete(models.BracketWinner).where(models.BracketWinner.tournament_id == tournament_id))
    db.execute(delete(models.TournamentPayoutSummary).where(models.TournamentPayoutSummary.tournament_id == tournament_id))
    db.execute(delete(models.BracketSnapshot).where(models.BracketSnapshot.tournament_id == tournament_id))
    db.execute(delete(models.FirstRoundMatchupHistory).where(models.FirstRoundMatchupHistory.tournament_id == tournament_id))
    db.execute(delete(models.PlayerScore).where(models.PlayerScore.tournament_id == tournament_id))
    db.execute(delete(models.TournamentPlayer).where(models.TournamentPlayer.tournament_id == tournament_id))
    db.execute(delete(models.TournamentBracketSettings).where(models.TournamentBracketSettings.tournament_id == tournament_id))

    squad_ids = [
        row.id
        for row in db.execute(
            select(models.TournamentSquad.id).where(models.TournamentSquad.tournament_id == tournament_id)
        )
    ]
    if squad_ids:
        db.execute(
            delete(models.UserSquadSelection).where(models.UserSquadSelection.tournament_squad_id.in_(squad_ids))
        )

    db.execute(delete(models.TournamentSquad).where(models.TournamentSquad.tournament_id == tournament_id))
    db.execute(delete(models.Tournament).where(models.Tournament.id == tournament_id))


def _get_user_delete_impact(db: Session, user_id: int) -> dict[str, int]:
    player_ids = list(
        db.scalars(select(models.TournamentPlayer.id).where(models.TournamentPlayer.user_id == user_id))
    )
    touched_tournament_ids = list(
        db.scalars(select(models.TournamentPlayer.tournament_id).where(models.TournamentPlayer.user_id == user_id).distinct())
    )

    bracket_winner_count = 0
    bracket_payout_count = 0
    first_round_history_count = 0
    player_score_count = 0
    if player_ids:
        bracket_winner_count = db.scalar(
            select(func.count()).select_from(models.BracketWinner).where(models.BracketWinner.player_id.in_(player_ids))
        ) or 0
        bracket_payout_count = db.scalar(
            select(func.count()).select_from(models.BracketPayout).where(models.BracketPayout.player_id.in_(player_ids))
        ) or 0
        first_round_history_count = db.scalar(
            select(func.count())
            .select_from(models.FirstRoundMatchupHistory)
            .where(
                or_(
                    models.FirstRoundMatchupHistory.left_player_id.in_(player_ids),
                    models.FirstRoundMatchupHistory.right_player_id.in_(player_ids),
                )
            )
        ) or 0
        player_score_count = db.scalar(
            select(func.count()).select_from(models.PlayerScore).where(models.PlayerScore.player_id.in_(player_ids))
        ) or 0

    bracket_snapshot_count = 0
    payout_summary_count = 0
    if touched_tournament_ids:
        bracket_snapshot_count = db.scalar(
            select(func.count())
            .select_from(models.BracketSnapshot)
            .where(models.BracketSnapshot.tournament_id.in_(touched_tournament_ids))
        ) or 0
        payout_summary_count = db.scalar(
            select(func.count())
            .select_from(models.TournamentPayoutSummary)
            .where(models.TournamentPayoutSummary.tournament_id.in_(touched_tournament_ids))
        ) or 0

    return {
        "users": 1,
        "owned_tournaments": db.scalar(select(func.count()).select_from(models.Tournament).where(models.Tournament.user_id == user_id)) or 0,
        "owned_tc_tournaments": db.scalar(select(func.count()).select_from(models.TournamentCentral).where(models.TournamentCentral.user_id == user_id)) or 0,
        "auth_sessions": db.scalar(select(func.count()).select_from(models.AuthSession).where(models.AuthSession.user_id == user_id)) or 0,
        "idempotency_keys": db.scalar(select(func.count()).select_from(models.IdempotencyKey).where(models.IdempotencyKey.user_id == user_id)) or 0,
        "password_reset_tokens": db.scalar(select(func.count()).select_from(models.PasswordResetToken).where(models.PasswordResetToken.user_id == user_id)) or 0,
        "email_verification_tokens": db.scalar(select(func.count()).select_from(models.EmailVerificationToken).where(models.EmailVerificationToken.user_id == user_id)) or 0,
        "admin_audit_logs_authored": db.scalar(select(func.count()).select_from(models.AdminAuditLog).where(models.AdminAuditLog.admin_user_id == user_id)) or 0,
        "admin_user_reviews": db.scalar(select(func.count()).select_from(models.AdminUserReview).where(or_(models.AdminUserReview.user_id == user_id, models.AdminUserReview.admin_user_id == user_id, models.AdminUserReview.resolved_by_user_id == user_id))) or 0,
        "user_feedback_messages": db.scalar(select(func.count()).select_from(models.UserFeedbackMessage).where(models.UserFeedbackMessage.user_id == user_id)) or 0,
        "legal_disclosure_acceptances": db.scalar(select(func.count()).select_from(models.LegalDisclosureAcceptance).where(models.LegalDisclosureAcceptance.user_id == user_id)) or 0,
        "bowler_profiles": db.scalar(select(func.count()).select_from(models.BowlerProfile).where(models.BowlerProfile.user_id == user_id)) or 0,
        "tournament_players": len(player_ids),
        "player_scores": player_score_count,
        "bracket_winners": bracket_winner_count,
        "bracket_payouts": bracket_payout_count,
        "first_round_history": first_round_history_count,
        "bracket_snapshots_invalidated": bracket_snapshot_count,
        "payout_summaries_invalidated": payout_summary_count,
        "user_squad_selections": db.scalar(select(func.count()).select_from(models.UserSquadSelection).where(models.UserSquadSelection.user_id == user_id)) or 0,
        "tournament_setup_states": db.scalar(select(func.count()).select_from(models.TournamentSetupState).where(models.TournamentSetupState.user_id == user_id)) or 0,
        "tc_tournament_setup_states": db.scalar(select(func.count()).select_from(models.TournamentCentralSetupState).where(models.TournamentCentralSetupState.user_id == user_id)) or 0,
    }


def _hard_delete_user(db: Session, user_id: int) -> dict[str, int]:
    impact = _get_user_delete_impact(db, user_id)

    player_rows = db.execute(
        select(
            models.TournamentPlayer.id,
            models.TournamentPlayer.tournament_id,
            models.TournamentPlayer.bowler_profile_id,
        ).where(models.TournamentPlayer.user_id == user_id)
    ).all()
    player_ids = [row.id for row in player_rows]
    touched_tournament_ids = sorted({row.tournament_id for row in player_rows})
    bowler_profile_ids = sorted({row.bowler_profile_id for row in player_rows if row.bowler_profile_id is not None})

    if player_ids:
        bracket_winner_ids = list(
            db.scalars(select(models.BracketWinner.id).where(models.BracketWinner.player_id.in_(player_ids)))
        )
        payout_filters = [models.BracketPayout.player_id.in_(player_ids)]
        if bracket_winner_ids:
            payout_filters.append(models.BracketPayout.bracket_winner_id.in_(bracket_winner_ids))

        db.execute(delete(models.BracketPayout).where(or_(*payout_filters)))
        db.execute(delete(models.BracketWinner).where(models.BracketWinner.player_id.in_(player_ids)))
        db.execute(
            delete(models.FirstRoundMatchupHistory).where(
                or_(
                    models.FirstRoundMatchupHistory.left_player_id.in_(player_ids),
                    models.FirstRoundMatchupHistory.right_player_id.in_(player_ids),
                )
            )
        )
        db.execute(delete(models.PlayerScore).where(models.PlayerScore.player_id.in_(player_ids)))
        db.execute(delete(models.TournamentPlayer).where(models.TournamentPlayer.id.in_(player_ids)))

    if touched_tournament_ids:
        db.execute(
            delete(models.TournamentPayoutSummary).where(
                models.TournamentPayoutSummary.tournament_id.in_(touched_tournament_ids)
            )
        )
        db.execute(
            delete(models.BracketSnapshot).where(models.BracketSnapshot.tournament_id.in_(touched_tournament_ids))
        )

    if bowler_profile_ids:
        db.execute(delete(models.BowlerProfile).where(models.BowlerProfile.id.in_(bowler_profile_ids)))

    db.execute(delete(models.UserSquadSelection).where(models.UserSquadSelection.user_id == user_id))
    db.execute(delete(models.TournamentSetupState).where(models.TournamentSetupState.user_id == user_id))
    db.execute(delete(models.TournamentCentralSetupState).where(models.TournamentCentralSetupState.user_id == user_id))
    db.execute(delete(models.AuthSession).where(models.AuthSession.user_id == user_id))
    db.execute(delete(models.IdempotencyKey).where(models.IdempotencyKey.user_id == user_id))
    db.execute(delete(models.PasswordResetToken).where(models.PasswordResetToken.user_id == user_id))
    db.execute(delete(models.EmailVerificationToken).where(models.EmailVerificationToken.user_id == user_id))
    db.execute(delete(models.UserAcknowledgment).where(models.UserAcknowledgment.user_id == user_id))
    db.execute(delete(models.LegalDisclosureAcceptance).where(models.LegalDisclosureAcceptance.user_id == user_id))
    db.execute(delete(models.AdminTournamentNote).where(or_(models.AdminTournamentNote.admin_user_id == user_id, models.AdminTournamentNote.resolved_by_user_id == user_id)))
    db.execute(delete(models.AdminAnnouncement).where(models.AdminAnnouncement.created_by_user_id == user_id))
    db.execute(models.AdminAnnouncement.__table__.update().where(models.AdminAnnouncement.audience_user_id == user_id).values(audience_user_id=None, audience_type="all"))
    db.execute(delete(models.AdminUserReview).where(or_(models.AdminUserReview.user_id == user_id, models.AdminUserReview.admin_user_id == user_id, models.AdminUserReview.resolved_by_user_id == user_id)))
    db.execute(delete(models.UserFeedbackMessage).where(models.UserFeedbackMessage.user_id == user_id))
    db.execute(models.UserFeedbackMessage.__table__.update().where(models.UserFeedbackMessage.resolved_by_user_id == user_id).values(resolved_by_user_id=None, resolved_at=None))
    db.execute(delete(models.AdminAuditLog).where(models.AdminAuditLog.admin_user_id == user_id))
    db.execute(delete(models.BowlerProfile).where(models.BowlerProfile.user_id == user_id))
    db.execute(delete(models.User).where(models.User.id == user_id))

    return impact


@router.get("/overview")
def get_admin_overview(
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_user),
):
    total_users = db.scalar(select(func.count()).select_from(models.User)) or 0
    admin_users = db.scalar(select(func.count()).select_from(models.User).where(models.User.is_admin.is_(True))) or 0
    unverified_users = db.scalar(select(func.count()).select_from(models.User).where(models.User.email_verified_at.is_(None))) or 0
    users_never_signed_in = db.scalar(select(func.count()).select_from(models.User).where(~select(models.AuthSession.id).where(models.AuthSession.user_id == models.User.id).exists())) or 0
    open_user_reviews = db.scalar(select(func.count()).select_from(models.AdminUserReview).where(models.AdminUserReview.is_resolved.is_(False))) or 0
    open_tournament_notes = db.scalar(select(func.count()).select_from(models.AdminTournamentNote).where(models.AdminTournamentNote.is_resolved.is_(False))) or 0
    active_announcements = db.scalar(select(func.count()).select_from(models.AdminAnnouncement).where(models.AdminAnnouncement.status == "active")) or 0
    recent_jobs = [job_to_dict(job) for job in job_store.list_recent(100)]
    failed_operations = sum(1 for job in recent_jobs if job["status"] == "failed")
    total_tournaments = db.scalar(select(func.count()).select_from(models.Tournament)) or 0
    total_squads = db.scalar(select(func.count()).select_from(models.TournamentSquad)) or 0
    total_entries = db.scalar(select(func.count()).select_from(models.TournamentPlayer)) or 0
    total_scores = db.scalar(select(func.count()).select_from(models.PlayerScore)) or 0
    total_snapshots = db.scalar(select(func.count()).select_from(models.BracketSnapshot)) or 0
    total_payouts = db.scalar(select(func.count()).select_from(models.BracketPayout)) or 0
    paid_payout_total = db.scalar(
        select(func.coalesce(func.sum(models.BracketPayout.payout_amount), 0.0)).where(models.BracketPayout.is_paid.is_(True))
    ) or 0.0
    unpaid_payout_total = db.scalar(
        select(func.coalesce(func.sum(models.BracketPayout.payout_amount), 0.0)).where(models.BracketPayout.is_paid.is_(False))
    ) or 0.0

    recent_tournaments = [
        {
            "id": row.id,
            "name": row.name,
            "location": row.location,
            "start_date": row.start_date,
            "owner_username": row.username,
            "owner_name": f"{row.first_name} {row.last_name}".strip(),
        }
        for row in db.execute(
            select(
                models.Tournament.id,
                models.Tournament.name,
                models.Tournament.location,
                models.Tournament.start_date,
                models.User.username,
                models.User.first_name,
                models.User.last_name,
            )
            .join(models.User, models.User.id == models.Tournament.user_id)
            .order_by(models.Tournament.id.desc())
            .limit(8)
        )
    ]

    top_operators = [
        {
            "id": row.id,
            "username": row.username,
            "name": f"{row.first_name} {row.last_name}".strip(),
            "tournament_count": row.tournament_count,
        }
        for row in db.execute(
            select(
                models.User.id,
                models.User.username,
                models.User.first_name,
                models.User.last_name,
                func.count(models.Tournament.id).label("tournament_count"),
            )
            .outerjoin(models.Tournament, models.Tournament.user_id == models.User.id)
            .group_by(models.User.id)
            .order_by(func.count(models.Tournament.id).desc(), models.User.username.asc())
            .limit(10)
        )
    ]

    recent_signups = [
        {
            "id": row.id,
            "username": row.username,
            "name": f"{row.first_name} {row.last_name}".strip(),
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in db.execute(
            select(
                models.User.id,
                models.User.username,
                models.User.first_name,
                models.User.last_name,
                models.User.created_at,
            )
            .order_by(models.User.created_at.desc())
            .limit(8)
        )
    ]

    return {
        "metrics": {
            "total_users": total_users,
            "admin_users": admin_users,
            "unverified_users": unverified_users,
            "users_never_signed_in": users_never_signed_in,
            "open_user_reviews": open_user_reviews,
            "open_tournament_notes": open_tournament_notes,
            "active_announcements": active_announcements,
            "failed_operations": failed_operations,
            "total_tournaments": total_tournaments,
            "total_squads": total_squads,
            "total_entries": total_entries,
            "total_scores": total_scores,
            "total_snapshots": total_snapshots,
            "total_payouts": total_payouts,
            "paid_payout_total": float(paid_payout_total),
            "unpaid_payout_total": float(unpaid_payout_total),
        },
        "top_operators": top_operators,
        "recent_tournaments": recent_tournaments,
        "recent_signups": recent_signups,
    }


@router.get("/users")
def get_admin_users(
    response: Response,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=5, le=200),
    search: Optional[str] = Query(default=None),
    sort: str = Query(default="id_asc"),
    verification: str = Query(default="all"),
    activity: str = Query(default="all"),
    review: str = Query(default="all"),
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_user),
):
    normalized_search = (search or "").strip()
    like = f"%{normalized_search}%"
    inactive_cutoff = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=90)
    last_login_expr = (
        select(func.max(models.AuthSession.last_seen_at))
        .where(models.AuthSession.user_id == models.User.id)
        .correlate(models.User)
        .scalar_subquery()
    )
    max_risk_expr = (
        select(func.coalesce(func.max(models.AuthSession.risk_score), 0.0))
        .where(models.AuthSession.user_id == models.User.id)
        .correlate(models.User)
        .scalar_subquery()
    )
    active_session_count_expr = (
        select(func.count())
        .select_from(models.AuthSession)
        .where(models.AuthSession.user_id == models.User.id, models.AuthSession.is_revoked.is_(False))
        .correlate(models.User)
        .scalar_subquery()
    )
    failed_login_count_expr = (
        select(func.coalesce(func.sum(models.LoginAttempt.failed_count), 0))
        .where(models.LoginAttempt.username == models.User.username)
        .correlate(models.User)
        .scalar_subquery()
    )
    open_review_count_expr = (
        select(func.count())
        .select_from(models.AdminUserReview)
        .where(models.AdminUserReview.user_id == models.User.id, models.AdminUserReview.is_resolved.is_(False))
        .correlate(models.User)
        .scalar_subquery()
    )

    total_query = select(func.count()).select_from(models.User)
    if normalized_search:
        total_query = total_query.where(
            or_(
                models.User.username.ilike(like),
                models.User.email.ilike(like),
                models.User.first_name.ilike(like),
                models.User.last_name.ilike(like),
                models.User.organization.ilike(like),
            )
        )

    if verification == "verified":
        total_query = total_query.where(models.User.email_verified_at.is_not(None))
    elif verification == "unverified":
        total_query = total_query.where(models.User.email_verified_at.is_(None))

    if activity == "active":
        total_query = total_query.where(last_login_expr >= inactive_cutoff)
    elif activity == "inactive":
        total_query = total_query.where(last_login_expr.is_not(None), last_login_expr < inactive_cutoff)
    elif activity == "never":
        total_query = total_query.where(last_login_expr.is_(None))

    if review == "flagged":
        total_query = total_query.where(open_review_count_expr > 0)
    elif review == "clear":
        total_query = total_query.where(open_review_count_expr == 0)

    total = db.scalar(total_query) or 0
    offset = (page - 1) * page_size

    tournament_count_expr = func.count(func.distinct(models.Tournament.id))
    profile_count_expr = func.count(func.distinct(models.BowlerProfile.id))
    query = (
        select(
            models.User.id,
            models.User.username,
            models.User.email,
            models.User.first_name,
            models.User.last_name,
            models.User.organization,
            models.User.is_admin,
            models.User.is_active,
            models.User.created_at,
            models.User.email_verified_at,
            last_login_expr.label("last_login_at"),
            max_risk_expr.label("max_risk_score"),
            active_session_count_expr.label("active_session_count"),
            failed_login_count_expr.label("failed_login_count"),
            open_review_count_expr.label("open_review_count"),
            models.User.dev_notice_version_accepted,
            models.User.dev_notice_accepted_at,
            tournament_count_expr.label("tournament_count"),
            profile_count_expr.label("profile_count"),
        )
        .outerjoin(models.Tournament, models.Tournament.user_id == models.User.id)
        .outerjoin(models.BowlerProfile, models.BowlerProfile.user_id == models.User.id)
        .group_by(
            models.User.id,
            models.User.username,
            models.User.email,
            models.User.first_name,
            models.User.last_name,
            models.User.organization,
            models.User.is_admin,
            models.User.is_active,
            models.User.created_at,
            models.User.email_verified_at,
            models.User.dev_notice_version_accepted,
            models.User.dev_notice_accepted_at,
        )
    )

    if normalized_search:
        query = query.where(
            or_(
                models.User.username.ilike(like),
                models.User.email.ilike(like),
                models.User.first_name.ilike(like),
                models.User.last_name.ilike(like),
                models.User.organization.ilike(like),
            )
        )

    if verification == "verified":
        query = query.where(models.User.email_verified_at.is_not(None))
    elif verification == "unverified":
        query = query.where(models.User.email_verified_at.is_(None))

    if activity == "active":
        query = query.where(last_login_expr >= inactive_cutoff)
    elif activity == "inactive":
        query = query.where(last_login_expr.is_not(None), last_login_expr < inactive_cutoff)
    elif activity == "never":
        query = query.where(last_login_expr.is_(None))

    if review == "flagged":
        query = query.where(open_review_count_expr > 0)
    elif review == "clear":
        query = query.where(open_review_count_expr == 0)

    if sort == "id_desc":
        query = query.order_by(models.User.id.desc())
    elif sort == "name_asc":
        query = query.order_by(models.User.first_name.asc(), models.User.last_name.asc(), models.User.id.asc())
    elif sort == "name_desc":
        query = query.order_by(models.User.first_name.desc(), models.User.last_name.desc(), models.User.id.desc())
    elif sort == "tournaments_desc":
        query = query.order_by(desc(tournament_count_expr), models.User.id.asc())
    elif sort == "last_login_desc":
        query = query.order_by(last_login_expr.desc().nullslast(), models.User.id.desc())
    elif sort == "created_desc":
        query = query.order_by(models.User.created_at.desc(), models.User.id.desc())
    elif sort == "reviews_desc":
        query = query.order_by(open_review_count_expr.desc(), models.User.id.asc())
    else:
        query = query.order_by(models.User.id.asc())

    rows = db.execute(query.offset(offset).limit(page_size))

    _set_admin_cache_headers(response, max_age=15, stale_while_revalidate=45)

    return {
        "users": [
            {
                "id": row.id,
                "username": row.username,
                "email": row.email,
                "first_name": row.first_name,
                "last_name": row.last_name,
                "organization": row.organization,
                "is_admin": row.is_admin,
                    "is_active": row.is_active,
                "created_at": _serialize_utc_timestamp(row.created_at),
                "email_verified": row.email_verified_at is not None,
                "email_verified_at": _serialize_utc_timestamp(row.email_verified_at),
                "last_login_at": _serialize_utc_timestamp(row.last_login_at),
                "tournament_count": row.tournament_count,
                "profile_count": row.profile_count,
                "max_risk_score": float(row.max_risk_score or 0),
                "active_session_count": row.active_session_count,
                "failed_login_count": row.failed_login_count,
                "open_review_count": row.open_review_count,
                "dev_notice_version_accepted": row.dev_notice_version_accepted,
                "dev_notice_accepted_at": _serialize_utc_timestamp(row.dev_notice_accepted_at),
            }
            for row in rows
        ],
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": _total_pages(total, page_size),
    }


@router.get("/tournaments")
def get_admin_tournaments(
    response: Response,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=5, le=200),
    search: Optional[str] = Query(default=None),
    activity: str = Query(default="all"),
    sort: str = Query(default="newest"),
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_user),
):
    normalized_search = (search or "").strip()
    like = f"%{normalized_search}%"
    entry_exists = select(models.TournamentPlayer.id).where(models.TournamentPlayer.tournament_id == models.Tournament.id)

    total_query = (
        select(func.count())
        .select_from(models.Tournament)
        .join(models.User, models.User.id == models.Tournament.user_id)
    )

    if normalized_search:
        total_query = total_query.where(
            or_(
                models.Tournament.name.ilike(like),
                models.Tournament.location.ilike(like),
                models.User.username.ilike(like),
                models.User.first_name.ilike(like),
                models.User.last_name.ilike(like),
                models.User.email.ilike(like),
            )
        )

    if activity == "has_entries":
        total_query = total_query.where(entry_exists.exists())
    elif activity == "no_entries":
        total_query = total_query.where(~entry_exists.exists())

    total = db.scalar(total_query) or 0
    offset = (page - 1) * page_size

    entry_count_expr = func.count(func.distinct(models.TournamentPlayer.id))
    open_note_count_expr = select(func.count()).select_from(models.AdminTournamentNote).where(models.AdminTournamentNote.tournament_id == models.Tournament.id, models.AdminTournamentNote.is_resolved.is_(False)).correlate(models.Tournament).scalar_subquery()
    last_bracket_activity_expr = select(func.max(models.BracketSnapshot.updated_at)).where(models.BracketSnapshot.tournament_id == models.Tournament.id).correlate(models.Tournament).scalar_subquery()
    last_admin_change_expr = select(func.max(models.AdminAuditLog.created_at)).where(models.AdminAuditLog.target_type == "tournament", models.AdminAuditLog.target_id == func.cast(models.Tournament.id, String)).correlate(models.Tournament).scalar_subquery()

    query = (
        select(
            models.Tournament.id,
            models.Tournament.name,
            models.Tournament.location,
            models.Tournament.start_date,
            models.Tournament.end_date,
            models.Tournament.archived_at,
            models.Tournament.archive_reason,
            models.User.username,
            models.User.email,
            models.User.first_name,
            models.User.last_name,
            entry_count_expr.label("entry_count"),
            func.count(func.distinct(models.TournamentSquad.id)).label("squad_count"),
            func.count(func.distinct(models.PlayerScore.id)).label("score_count"),
            func.count(func.distinct(models.BracketPayout.id)).label("payout_count"),
            func.count(func.distinct(models.BracketSnapshot.id)).label("snapshot_count"),
            open_note_count_expr.label("open_note_count"),
            last_bracket_activity_expr.label("last_activity_at"),
            last_admin_change_expr.label("last_admin_change_at"),
        )
        .join(models.User, models.User.id == models.Tournament.user_id)
        .outerjoin(models.TournamentPlayer, models.TournamentPlayer.tournament_id == models.Tournament.id)
        .outerjoin(models.TournamentSquad, models.TournamentSquad.tournament_id == models.Tournament.id)
        .outerjoin(models.PlayerScore, models.PlayerScore.tournament_id == models.Tournament.id)
        .outerjoin(models.BracketPayout, models.BracketPayout.tournament_id == models.Tournament.id)
        .outerjoin(models.BracketSnapshot, models.BracketSnapshot.tournament_id == models.Tournament.id)
        .group_by(models.Tournament.id, models.User.id)
    )

    if normalized_search:
        query = query.where(
            or_(
                models.Tournament.name.ilike(like),
                models.Tournament.location.ilike(like),
                models.User.username.ilike(like),
                models.User.first_name.ilike(like),
                models.User.last_name.ilike(like),
                models.User.email.ilike(like),
            )
        )

    if activity == "has_entries":
        query = query.where(entry_exists.exists())
    elif activity == "no_entries":
        query = query.where(~entry_exists.exists())

    if sort == "entries_desc":
        query = query.order_by(desc(entry_count_expr), desc(models.Tournament.id))
    elif sort == "owner_asc":
        query = query.order_by(asc(models.User.first_name), asc(models.User.last_name), desc(models.Tournament.id))
    elif sort == "oldest":
        query = query.order_by(models.Tournament.id.asc())
    else:
        query = query.order_by(models.Tournament.id.desc())

    rows = db.execute(query.offset(offset).limit(page_size))

    _set_admin_cache_headers(response, max_age=15, stale_while_revalidate=45)

    return {
        "tournaments": [
            {
                "id": row.id,
                "name": row.name,
                "location": row.location,
                "start_date": row.start_date,
                "end_date": row.end_date,
                "archived_at": row.archived_at.isoformat() if row.archived_at else None,
                "archive_reason": row.archive_reason,
                "owner_username": row.username,
                "owner_email": row.email,
                "owner_name": f"{row.first_name} {row.last_name}".strip(),
                "entry_count": row.entry_count,
                "squad_count": row.squad_count,
                "score_count": row.score_count,
                "payout_count": row.payout_count,
                "snapshot_count": row.snapshot_count,
                "status": _tournament_status(row.start_date, row.end_date, row.archived_at),
                "open_note_count": row.open_note_count,
                "last_activity_at": _serialize_utc_timestamp(row.last_activity_at),
                "last_admin_change_at": _serialize_utc_timestamp(row.last_admin_change_at),
            }
            for row in rows
        ],
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": _total_pages(total, page_size),
    }


@router.get("/tournaments/{tournament_id}/details")
def get_admin_tournament_details(
    tournament_id: int,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_user),
):
    tournament = db.get(models.Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    counts = _get_tournament_delete_impact(db, tournament_id)

    return {
        "tournament_id": tournament.id,
        "name": tournament.name,
        "location": tournament.location,
        "start_date": tournament.start_date,
        "end_date": tournament.end_date,
        "archived_at": tournament.archived_at.isoformat() if tournament.archived_at else None,
        "archive_reason": tournament.archive_reason,
        "counts": {
            "squads": counts["tournament_squads"],
            "entries": counts["tournament_players"],
            "scores": counts["player_scores"],
            "payouts": counts["bracket_payouts"],
            "snapshots": counts["bracket_snapshots"],
        },
    }


@router.get("/tournaments/{tournament_id}/delete-preview")
def get_admin_tournament_delete_preview(
    tournament_id: int,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_user),
):
    tournament = db.get(models.Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    impact = _get_tournament_delete_impact(db, tournament_id)
    score_count = impact.get("player_scores", 0)

    return {
        "tournament_id": tournament_id,
        "tournament_name": tournament.name,
        "impact": impact,
        "dependent_total_rows": sum(impact.values()),
        "requires_force": score_count > 0,
        "score_count": score_count,
    }


@router.patch("/tournaments/{tournament_id}")
def admin_update_tournament(
    tournament_id: int,
    payload: AdminUpdateTournamentPayload,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_user),
):
    tournament = db.get(models.Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    before = {
        "name": tournament.name,
        "location": tournament.location,
        "start_date": tournament.start_date,
        "end_date": tournament.end_date,
        "is_public": tournament.is_public,
    }

    if payload.name is not None:
        tournament.name = payload.name.strip()
    if payload.location is not None:
        tournament.location = payload.location.strip() or None
    if payload.start_date is not None:
        tournament.start_date = payload.start_date.strip() or None
    if payload.end_date is not None:
        tournament.end_date = payload.end_date.strip() or None
    if payload.is_public is not None:
        tournament.is_public = payload.is_public

    _write_admin_audit(
        db,
        admin_user_id=admin.id,
        action="tournament.update",
        target_type="tournament",
        target_id=tournament_id,
        details={
            "before": before,
            "after": {
                "name": tournament.name,
                "location": tournament.location,
                "start_date": tournament.start_date,
                "end_date": tournament.end_date,
                "is_public": tournament.is_public,
            },
        },
    )

    db.commit()
    db.refresh(tournament)

    return {
        "ok": True,
        "tournament": {
            "id": tournament.id,
            "name": tournament.name,
            "location": tournament.location,
            "start_date": tournament.start_date,
            "end_date": tournament.end_date,
            "is_public": tournament.is_public,
        },
    }


@router.post("/tournaments/{tournament_id}/reassign")
def admin_reassign_tournament(
    tournament_id: int,
    payload: AdminReassignTournamentPayload,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_user),
):
    tournament = db.get(models.Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    new_owner = db.get(models.User, payload.new_owner_user_id)
    if not new_owner:
        raise HTTPException(status_code=404, detail="Target owner not found")

    previous_owner = tournament.user_id
    tournament.user_id = new_owner.id

    _write_admin_audit(
        db,
        admin_user_id=admin.id,
        action="tournament.reassign",
        target_type="tournament",
        target_id=tournament_id,
        details={"from_owner": previous_owner, "to_owner": new_owner.id},
    )

    db.commit()

    return {
        "ok": True,
        "tournament_id": tournament_id,
        "new_owner_user_id": new_owner.id,
        "new_owner_username": new_owner.username,
    }


@router.post("/tournaments/{tournament_id}/archive")
def admin_archive_tournament(
    tournament_id: int,
    payload: AdminArchiveTournamentPayload,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_user),
):
    tournament = db.get(models.Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    tournament.archived_at = datetime.utcnow()
    tournament.archive_reason = (payload.reason or "").strip() or None

    _write_admin_audit(
        db,
        admin_user_id=admin.id,
        action="tournament.archive",
        target_type="tournament",
        target_id=tournament_id,
        reason=tournament.archive_reason,
    )

    db.commit()

    return {"ok": True, "archived_at": tournament.archived_at.isoformat()}


@router.post("/tournaments/{tournament_id}/unarchive")
def admin_unarchive_tournament(
    tournament_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_user),
):
    tournament = db.get(models.Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    tournament.archived_at = None
    tournament.archive_reason = None

    _write_admin_audit(
        db,
        admin_user_id=admin.id,
        action="tournament.unarchive",
        target_type="tournament",
        target_id=tournament_id,
    )

    db.commit()

    return {"ok": True}


@router.post("/tournaments/{tournament_id}/delete")
def admin_delete_tournament(
    tournament_id: int,
    payload: AdminDeleteTournamentPayload,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_user),
):
    tournament = db.get(models.Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    reason = (payload.reason or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Deletion reason is required")

    if (payload.confirm_text or "").strip().upper() != "DELETE":
        raise HTTPException(status_code=400, detail="confirm_text must equal DELETE")

    impact = _get_tournament_delete_impact(db, tournament_id)
    score_count = impact.get("player_scores", 0)
    if score_count > 0 and not payload.force:
        raise HTTPException(
            status_code=400,
            detail="Tournament has score data. Set force=true to permanently delete.",
        )

    _write_admin_audit(
        db,
        admin_user_id=admin.id,
        action="tournament.delete",
        target_type="tournament",
        target_id=tournament_id,
        reason=reason,
        details={"force": payload.force, "impact": impact},
    )

    _hard_delete_tournament(db, tournament_id)
    db.commit()

    return {"ok": True, "score_count": score_count, "impact": impact}


@router.get("/database/tables")
def get_database_tables(
    include_counts: bool = Query(default=False),
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_user),
):
    inspector = inspect(db.bind)
    table_names = inspector.get_table_names()

    normalized_search = (search or "").strip().lower()
    if normalized_search:
        table_names = [name for name in table_names if normalized_search in name.lower()]

    table_names = sorted(table_names)[:limit]

    tables = []
    for table_name in table_names:
        table = _get_reflected_table(db, table_name)
        if table is None:
            continue

        row_count: Optional[int] = None
        row_count_kind = "skipped"
        if include_counts:
            estimate = _get_postgres_estimated_row_count(db, table_name)
            if estimate is not None:
                row_count = estimate
                row_count_kind = "estimated"
            else:
                row_count = db.scalar(select(func.count()).select_from(table)) or 0
                row_count_kind = "exact"

        tables.append(
            {
                "name": table_name,
                "row_count": row_count,
                "row_count_kind": row_count_kind,
                "columns": [column.name for column in table.columns],
            }
        )

    return {
        "tables": tables,
        "include_counts": include_counts,
        "total_tables": len(tables),
    }


@router.get("/database/table/{table_name}")
def get_database_table_rows(
    table_name: str,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_user),
):
    table = _get_reflected_table(db, table_name)
    if not table:
        raise HTTPException(status_code=404, detail="Unknown table")

    result = db.execute(select(table).limit(limit)).mappings().all()
    rows = [{key: _serialize_value(value) for key, value in row.items()} for row in result]

    return {
        "table": table_name,
        "columns": [column.name for column in table.columns],
        "rows": rows,
        "limit": limit,
    }


@router.get("/audit-logs")
def get_admin_audit_logs(
    response: Response,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=5, le=200),
    action: Optional[str] = Query(default=None),
    target_type: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    admin_user_id: Optional[int] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_user),
):
    normalized_search = (search or "").strip()
    like = f"%{normalized_search}%"

    filters = []
    if action:
        filters.append(models.AdminAuditLog.action.ilike(f"%{action.strip()}%"))
    if target_type:
        filters.append(models.AdminAuditLog.target_type.ilike(f"%{target_type.strip()}%"))
    if admin_user_id:
        filters.append(models.AdminAuditLog.admin_user_id == admin_user_id)
    if date_from:
        filters.append(models.AdminAuditLog.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        filters.append(models.AdminAuditLog.created_at < datetime.combine(date_to + timedelta(days=1), datetime.min.time()))
    if normalized_search:
        filters.append(
            or_(
                models.AdminAuditLog.reason.ilike(like),
                models.AdminAuditLog.target_id.ilike(like),
                models.AdminAuditLog.action.ilike(like),
            )
        )

    total_query = select(func.count()).select_from(models.AdminAuditLog)
    if filters:
        total_query = total_query.where(*filters)

    total = db.scalar(total_query) or 0
    offset = (page - 1) * page_size

    rows = db.execute(
        select(
            models.AdminAuditLog.id,
            models.AdminAuditLog.admin_user_id,
            models.AdminAuditLog.action,
            models.AdminAuditLog.target_type,
            models.AdminAuditLog.target_id,
            models.AdminAuditLog.reason,
            models.AdminAuditLog.details,
            models.AdminAuditLog.created_at,
            models.User.username,
            models.User.first_name,
            models.User.last_name,
        )
        .outerjoin(models.User, models.User.id == models.AdminAuditLog.admin_user_id)
        .where(*filters)
        .order_by(models.AdminAuditLog.created_at.desc(), models.AdminAuditLog.id.desc())
        .offset(offset)
        .limit(page_size)
    )

    _set_admin_cache_headers(response, max_age=10, stale_while_revalidate=30)

    return {
        "logs": [
            {
                "id": row.id,
                "admin_user_id": row.admin_user_id,
                "admin_username": row.username,
                "admin_name": f"{row.first_name or ''} {row.last_name or ''}".strip() or row.username,
                "action": row.action,
                "target_type": row.target_type,
                "target_id": row.target_id,
                "reason": row.reason,
                "details": row.details,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in rows
        ],
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": _total_pages(total, page_size),
    }


@router.get("/users/{user_id}/review")
def admin_get_user_review(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_user),
):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    sessions = db.execute(
        select(models.AuthSession)
        .where(models.AuthSession.user_id == user_id)
        .order_by(models.AuthSession.last_seen_at.desc())
        .limit(20)
    ).scalars().all()
    login_attempts = db.execute(
        select(models.LoginAttempt)
        .where(models.LoginAttempt.username == user.username)
        .order_by(models.LoginAttempt.updated_at.desc())
        .limit(20)
    ).scalars().all()
    review_rows = db.execute(
        select(
            models.AdminUserReview,
            models.User.username.label("admin_username"),
        )
        .join(models.User, models.User.id == models.AdminUserReview.admin_user_id)
        .where(models.AdminUserReview.user_id == user_id)
        .order_by(models.AdminUserReview.created_at.desc(), models.AdminUserReview.id.desc())
    ).all()
    acknowledgments = db.execute(select(models.UserAcknowledgment).where(models.UserAcknowledgment.user_id == user_id).order_by(models.UserAcknowledgment.acknowledged_at.desc())).scalars().all()

    return {
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "name": f"{user.first_name} {user.last_name}".strip(),
            "organization": user.organization,
            "is_admin": user.is_admin,
            "created_at": _serialize_utc_timestamp(user.created_at),
            "email_verified": user.email_verified,
            "email_verified_at": _serialize_utc_timestamp(user.email_verified_at),
            "dev_notice_version_accepted": user.dev_notice_version_accepted,
            "dev_notice_accepted_at": _serialize_utc_timestamp(user.dev_notice_accepted_at),
        },
        "sessions": [
            {
                "id": session.id,
                "issued_at": _serialize_utc_timestamp(session.issued_at),
                "last_seen_at": _serialize_utc_timestamp(session.last_seen_at),
                "expires_at": _serialize_utc_timestamp(session.expires_at),
                "is_revoked": session.is_revoked,
                "revoked_at": _serialize_utc_timestamp(session.revoked_at),
                "region_hint": session.region_hint,
                "device_nickname": session.device_nickname,
                "risk_score": float(session.risk_score or 0),
            }
            for session in sessions
        ],
        "login_attempts": [
            {
                "id": attempt.id,
                "failed_count": attempt.failed_count,
                "window_start": _serialize_utc_timestamp(attempt.window_start),
                "blocked_until": _serialize_utc_timestamp(attempt.blocked_until),
                "updated_at": _serialize_utc_timestamp(attempt.updated_at),
            }
            for attempt in login_attempts
        ],
        "reviews": [
            {
                "id": review.id,
                "kind": review.kind,
                "category": review.category,
                "note": review.note,
                "is_resolved": review.is_resolved,
                "admin_username": admin_username,
                "created_at": _serialize_utc_timestamp(review.created_at),
                "resolved_at": _serialize_utc_timestamp(review.resolved_at),
            }
            for review, admin_username in review_rows
        ],
        "acknowledgments": [{"id": item.id, "content_type": item.content_type, "content_id": item.content_id, "version": item.version, "acknowledged_at": _serialize_utc_timestamp(item.acknowledged_at)} for item in acknowledgments],
    }


@router.post("/users/{user_id}/reviews")
def admin_create_user_review(
    user_id: int,
    payload: AdminUserReviewPayload,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_user),
):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    kind = payload.kind.strip().lower()
    category = payload.category.strip().lower()
    note = payload.note.strip()
    if kind not in {"flag", "note"}:
        raise HTTPException(status_code=400, detail="Review kind must be flag or note")
    if category not in {"general", "verification", "inactive", "duplicate", "suspicious", "fake"}:
        raise HTTPException(status_code=400, detail="Invalid review category")
    if not note:
        raise HTTPException(status_code=400, detail="Review note is required")
    if len(note) > 2000:
        raise HTTPException(status_code=400, detail="Review note is too long")

    review = models.AdminUserReview(
        user_id=user_id,
        admin_user_id=admin.id,
        kind=kind,
        category=category,
        note=note,
    )
    db.add(review)
    db.flush()
    _write_admin_audit(db, admin.id, f"user.review.{kind}.create", "user", user_id, details={"review_id": review.id, "category": category})
    db.commit()
    return {"ok": True, "review_id": review.id}


@router.patch("/user-reviews/{review_id}")
def admin_resolve_user_review(
    review_id: int,
    payload: AdminResolveUserReviewPayload,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_user),
):
    review = db.get(models.AdminUserReview, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review item not found")
    review.is_resolved = payload.resolved
    review.resolved_at = datetime.now(UTC).replace(tzinfo=None) if payload.resolved else None
    review.resolved_by_user_id = admin.id if payload.resolved else None
    _write_admin_audit(db, admin.id, "user.review.resolve" if payload.resolved else "user.review.reopen", "user", review.user_id, details={"review_id": review.id})
    db.commit()
    return {"ok": True}


@router.get("/tournaments/{tournament_id}/notes")
def admin_get_tournament_notes(tournament_id: int, db: Session = Depends(get_db), _admin: models.User = Depends(require_admin_user)):
    if not db.get(models.Tournament, tournament_id):
        raise HTTPException(status_code=404, detail="Tournament not found")
    rows = db.execute(select(models.AdminTournamentNote, models.User.username).join(models.User, models.User.id == models.AdminTournamentNote.admin_user_id).where(models.AdminTournamentNote.tournament_id == tournament_id).order_by(models.AdminTournamentNote.created_at.desc())).all()
    return {"notes": [{"id": note.id, "category": note.category, "note": note.note, "is_resolved": note.is_resolved, "admin_username": username, "created_at": _serialize_utc_timestamp(note.created_at), "resolved_at": _serialize_utc_timestamp(note.resolved_at)} for note, username in rows]}


@router.post("/tournaments/{tournament_id}/notes")
def admin_create_tournament_note(tournament_id: int, payload: AdminTournamentNotePayload, db: Session = Depends(get_db), admin: models.User = Depends(require_admin_user)):
    if not db.get(models.Tournament, tournament_id):
        raise HTTPException(status_code=404, detail="Tournament not found")
    category, note_text = payload.category.strip().lower(), payload.note.strip()
    if category not in {"general", "data", "ownership", "results", "support"} or not note_text:
        raise HTTPException(status_code=400, detail="A valid category and note are required")
    note = models.AdminTournamentNote(tournament_id=tournament_id, admin_user_id=admin.id, category=category, note=note_text[:2000])
    db.add(note); db.flush()
    _write_admin_audit(db, admin.id, "tournament.note.create", "tournament", tournament_id, details={"note_id": note.id, "category": category})
    db.commit()
    return {"ok": True, "note_id": note.id}


@router.patch("/tournament-notes/{note_id}")
def admin_resolve_tournament_note(note_id: int, payload: AdminResolveUserReviewPayload, db: Session = Depends(get_db), admin: models.User = Depends(require_admin_user)):
    note = db.get(models.AdminTournamentNote, note_id)
    if not note: raise HTTPException(status_code=404, detail="Tournament note not found")
    note.is_resolved = payload.resolved
    note.resolved_at = datetime.now(UTC).replace(tzinfo=None) if payload.resolved else None
    note.resolved_by_user_id = admin.id if payload.resolved else None
    _write_admin_audit(db, admin.id, "tournament.note.resolve" if payload.resolved else "tournament.note.reopen", "tournament", note.tournament_id, details={"note_id": note.id})
    db.commit()
    return {"ok": True}


def _serialize_announcement(db: Session, announcement: models.AdminAnnouncement) -> dict:
    acknowledgments = db.scalar(select(func.count()).select_from(models.UserAcknowledgment).where(models.UserAcknowledgment.content_type == "announcement", models.UserAcknowledgment.content_id == str(announcement.id))) or 0
    return {"id": announcement.id, "title": announcement.title, "message": announcement.message, "audience_type": announcement.audience_type, "audience_user_id": announcement.audience_user_id, "status": announcement.status, "requires_acknowledgment": announcement.requires_acknowledgment, "starts_at": _serialize_utc_timestamp(announcement.starts_at), "ends_at": _serialize_utc_timestamp(announcement.ends_at), "created_at": _serialize_utc_timestamp(announcement.created_at), "updated_at": _serialize_utc_timestamp(announcement.updated_at), "acknowledgment_count": acknowledgments}


@router.get("/announcements")
def admin_list_announcements(db: Session = Depends(get_db), _admin: models.User = Depends(require_admin_user)):
    entries = db.execute(select(models.AdminAnnouncement).order_by(models.AdminAnnouncement.created_at.desc())).scalars().all()
    return {"announcements": [_serialize_announcement(db, entry) for entry in entries]}


@router.post("/announcements")
def admin_create_announcement(payload: AdminAnnouncementPayload, db: Session = Depends(get_db), admin: models.User = Depends(require_admin_user)):
    if payload.audience_type not in {"all", "admins", "user"} or payload.status not in {"draft", "active", "archived"}:
        raise HTTPException(status_code=400, detail="Invalid announcement audience or status")
    if payload.audience_type == "user" and not payload.audience_user_id:
        raise HTTPException(status_code=400, detail="A user is required for this audience")
    entry = models.AdminAnnouncement(title=payload.title.strip()[:160], message=payload.message.strip(), audience_type=payload.audience_type, audience_user_id=payload.audience_user_id, status=payload.status, requires_acknowledgment=payload.requires_acknowledgment, starts_at=payload.starts_at, ends_at=payload.ends_at, created_by_user_id=admin.id)
    if not entry.title or not entry.message: raise HTTPException(status_code=400, detail="Title and message are required")
    db.add(entry); db.flush(); _write_admin_audit(db, admin.id, "announcement.create", "announcement", entry.id, details={"audience": entry.audience_type, "status": entry.status}); db.commit(); db.refresh(entry)
    return _serialize_announcement(db, entry)


@router.patch("/announcements/{announcement_id}")
def admin_update_announcement(announcement_id: int, payload: AdminAnnouncementPayload, db: Session = Depends(get_db), admin: models.User = Depends(require_admin_user)):
    entry = db.get(models.AdminAnnouncement, announcement_id)
    if not entry: raise HTTPException(status_code=404, detail="Announcement not found")
    if payload.audience_type not in {"all", "admins", "user"} or payload.status not in {"draft", "active", "archived"}: raise HTTPException(status_code=400, detail="Invalid announcement audience or status")
    entry.title, entry.message, entry.audience_type, entry.audience_user_id, entry.status, entry.requires_acknowledgment, entry.starts_at, entry.ends_at = payload.title.strip()[:160], payload.message.strip(), payload.audience_type, payload.audience_user_id, payload.status, payload.requires_acknowledgment, payload.starts_at, payload.ends_at
    _write_admin_audit(db, admin.id, "announcement.update", "announcement", entry.id, details={"audience": entry.audience_type, "status": entry.status}); db.commit(); db.refresh(entry)
    return _serialize_announcement(db, entry)


@router.delete("/announcements/{announcement_id}")
def admin_delete_announcement(announcement_id: int, db: Session = Depends(get_db), admin: models.User = Depends(require_admin_user)):
    entry = db.get(models.AdminAnnouncement, announcement_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Announcement not found")

    acknowledgment_result = db.execute(
        delete(models.UserAcknowledgment).where(
            models.UserAcknowledgment.content_type == "announcement",
            models.UserAcknowledgment.content_id == str(announcement_id),
        )
    )
    deleted_acknowledgments = acknowledgment_result.rowcount or 0
    db.delete(entry)
    _write_admin_audit(
        db,
        admin.id,
        "announcement.delete",
        "announcement",
        announcement_id,
        details={"title": entry.title, "status": entry.status, "acknowledgments_deleted": deleted_acknowledgments},
    )
    db.commit()
    return {"ok": True, "acknowledgments_deleted": deleted_acknowledgments}


def _serialize_feedback_message(message: models.UserFeedbackMessage, user: models.User) -> dict:
    return {
        "id": message.id,
        "user_id": message.user_id,
        "username": user.username,
        "user_name": f"{user.first_name} {user.last_name}".strip(),
        "email": user.email,
        "category": message.category,
        "subject": message.subject,
        "message": message.message,
        "status": message.status,
        "admin_note": message.admin_note,
        "resolved_at": _serialize_utc_timestamp(message.resolved_at),
        "created_at": _serialize_utc_timestamp(message.created_at),
        "updated_at": _serialize_utc_timestamp(message.updated_at),
    }


@router.get("/feedback")
def admin_list_feedback(db: Session = Depends(get_db), _admin: models.User = Depends(require_admin_user)):
    rows = db.execute(
        select(models.UserFeedbackMessage, models.User)
        .join(models.User, models.User.id == models.UserFeedbackMessage.user_id)
        .order_by(models.UserFeedbackMessage.created_at.desc())
    ).all()
    return {"messages": [_serialize_feedback_message(message, user) for message, user in rows]}


@router.patch("/feedback/{message_id}")
def admin_update_feedback(
    message_id: int,
    payload: AdminFeedbackUpdatePayload,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_user),
):
    message = db.get(models.UserFeedbackMessage, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Feedback message not found")
    if payload.status not in {"open", "in_progress", "resolved"}:
        raise HTTPException(status_code=400, detail="Invalid feedback status")
    message.status = payload.status
    message.admin_note = (payload.admin_note or "").strip()[:5000] or None
    message.resolved_at = datetime.now(UTC).replace(tzinfo=None) if payload.status == "resolved" else None
    message.resolved_by_user_id = admin.id if payload.status == "resolved" else None
    _write_admin_audit(db, admin.id, "feedback.update", "feedback", message_id, details={"status": message.status})
    db.commit()
    db.refresh(message)
    user = db.get(models.User, message.user_id)
    return _serialize_feedback_message(message, user)


@router.get("/operations")
def admin_operations(_admin: models.User = Depends(require_admin_user)):
    jobs = [job_to_dict(job) for job in job_store.list_recent(100)]
    return {"operations": jobs, "summary": {"failed": sum(1 for job in jobs if job["status"] == "failed"), "running": sum(1 for job in jobs if job["status"] in {"queued", "running"}), "succeeded": sum(1 for job in jobs if job["status"] == "succeeded")}, "note": "Operations are retained for the lifetime of the current backend process."}


@router.patch("/users/{user_id}")
def admin_update_user(
    user_id: int,
    payload: AdminUpdateUserPayload,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_user),
):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Use the Settings page to edit your own account")

    before = {
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "organization": user.organization,
    }

    if payload.first_name is not None:
        user.first_name = payload.first_name.strip()
    if payload.last_name is not None:
        user.last_name = payload.last_name.strip()
    if payload.email is not None:
        existing = db.scalar(select(models.User).where(models.User.email == payload.email, models.User.id != user_id))
        if existing:
            raise HTTPException(status_code=409, detail="Email already in use")
        user.email = payload.email
    if payload.organization is not None:
        user.organization = payload.organization.strip() or None

    _write_admin_audit(
        db,
        admin_user_id=admin.id,
        action="user.update",
        target_type="user",
        target_id=user_id,
        details={
            "before": before,
            "after": {
                "first_name": user.first_name,
                "last_name": user.last_name,
                "email": user.email,
                "organization": user.organization,
            },
        },
    )

    db.commit()
    db.refresh(user)
    return {
        "ok": True,
        "user": {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "organization": user.organization,
        },
    }


@router.post("/users/{user_id}/set-admin")
def admin_set_user_admin(
    user_id: int,
    payload: AdminSetUserAdminPayload,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_user),
):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot change your own admin privileges")

    if user.is_admin == payload.is_admin:
        return {
            "ok": True,
            "user": {
                "id": user.id,
                "is_admin": user.is_admin,
            },
        }

    before_is_admin = bool(user.is_admin)
    user.is_admin = payload.is_admin

    _write_admin_audit(
        db,
        admin_user_id=admin.id,
        action="user.set_admin",
        target_type="user",
        target_id=user_id,
        details={
            "username": user.username,
            "email": user.email,
            "before": {"is_admin": before_is_admin},
            "after": {"is_admin": user.is_admin},
        },
    )

    db.commit()
    db.refresh(user)
    return {
        "ok": True,
        "user": {
            "id": user.id,
            "is_admin": user.is_admin,
        },
    }


@router.post("/users/{user_id}/set-active")
def admin_set_user_active(
    user_id: int,
    payload: AdminSetUserActivePayload,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_user),
):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id and not payload.is_active:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    user.is_active = payload.is_active
    if not payload.is_active:
        db.execute(
            models.AuthSession.__table__.update()
            .where(models.AuthSession.user_id == user.id, models.AuthSession.is_revoked.is_(False))
            .values(is_revoked=True, revoked_at=datetime.now(UTC).replace(tzinfo=None))
        )
    _write_admin_audit(db, admin.id, "user.set_active", "user", user.id, details={"is_active": user.is_active})
    db.commit()
    return {"ok": True, "user": {"id": user.id, "is_active": user.is_active}}


@router.post("/users/{user_id}/reset-password")
def admin_reset_password(
    user_id: int,
    payload: AdminResetPasswordPayload,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_user),
):
    try:
        validate_password_policy(payload.new_password)
    except PasswordPolicyError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Use the Settings page to change your own password")

    now = datetime.utcnow()
    user.password = _pwd_context.hash(payload.new_password)
    active_sessions = (
        db.query(models.AuthSession)
        .filter(
            models.AuthSession.user_id == user.id,
            models.AuthSession.is_revoked.is_(False),
        )
        .all()
    )
    for session in active_sessions:
        session.is_revoked = True
        session.revoked_at = now

    _write_admin_audit(
        db,
        admin_user_id=admin.id,
        action="user.reset_password",
        target_type="user",
        target_id=user_id,
    )

    db.commit()
    return {"ok": True}


@router.get("/users/{user_id}/delete-preview")
def admin_delete_user_preview(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_user),
):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    impact = _get_user_delete_impact(db, user_id)

    return {
        "user_id": user_id,
        "username": user.username,
        "impact": impact,
        "dependent_total_rows": sum(impact.values()),
    }


@router.post("/users/{user_id}/delete")
def admin_delete_user(
    user_id: int,
    payload: AdminDeleteUserPayload,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_user),
):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    reason = payload.reason.strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Deletion reason is required")

    if payload.confirm_text.strip().upper() != "DELETE":
        raise HTTPException(status_code=400, detail="confirm_text must equal DELETE")

    impact = _get_user_delete_impact(db, user_id)
    tournament_count = impact.get("owned_tournaments", 0) + impact.get("owned_tc_tournaments", 0)
    if tournament_count > 0:
        raise HTTPException(status_code=400, detail="User owns tournaments. Reassign or delete them first.")

    _write_admin_audit(
        db,
        admin_user_id=admin.id,
        action="user.delete",
        target_type="user",
        target_id=user_id,
        reason=reason,
        details={"username": user.username, "email": user.email, "impact": impact},
    )

    _hard_delete_user(db, user_id)
    db.commit()
    return {"ok": True, "impact": impact}


@router.delete("/users/{user_id}")
def admin_delete_user_legacy(
    user_id: int,
    _db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_user),
):
    raise HTTPException(
        status_code=400,
        detail="Legacy delete route is disabled. Use POST /api/v1/admin/users/{user_id}/delete with reason and confirm_text.",
    )


@router.get("/changelog")
def admin_get_changelog(
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_user),
):
    """Get all changelog entries"""
    entries = db.query(models.Changelog).order_by(models.Changelog.version.desc()).all()
    return {
        "entries": [
            {
                "id": entry.id,
                "version": entry.version,
                "date": entry.date,
                "changes": entry.changes,
                "created_at": entry.created_at.isoformat() if entry.created_at else None,
                "updated_at": entry.updated_at.isoformat() if entry.updated_at else None,
            }
            for entry in entries
        ]
    }


@router.post("/changelog")
def admin_create_changelog(
    payload: AdminCreateChangelogPayload,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_user),
):
    """Create a new changelog entry"""
    # Check if version already exists
    existing = db.query(models.Changelog).filter(models.Changelog.version == payload.version).first()
    if existing:
        raise HTTPException(status_code=409, detail="Version already exists")

    entry = models.Changelog(
        version=payload.version.strip(),
        date=payload.date.strip(),
        changes=payload.changes,
    )
    db.add(entry)
    
    _write_admin_audit(
        db,
        admin_user_id=admin.id,
        action="changelog.create",
        target_type="changelog",
        target_id=str(entry.version),
        details={"version": entry.version, "date": entry.date, "changes": entry.changes},
    )
    
    db.commit()
    db.refresh(entry)
    return {
        "ok": True,
        "entry": {
            "id": entry.id,
            "version": entry.version,
            "date": entry.date,
            "changes": entry.changes,
            "created_at": entry.created_at.isoformat() if entry.created_at else None,
        },
    }


@router.put("/changelog/{version}")
def admin_update_changelog(
    version: str,
    payload: AdminUpdateChangelogPayload,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_user),
):
    """Update a changelog entry"""
    entry = db.query(models.Changelog).filter(models.Changelog.version == version).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Changelog entry not found")

    before = {
        "date": entry.date,
        "changes": entry.changes,
    }

    if payload.date is not None:
        entry.date = payload.date.strip()
    if payload.changes is not None:
        entry.changes = payload.changes

    _write_admin_audit(
        db,
        admin_user_id=admin.id,
        action="changelog.update",
        target_type="changelog",
        target_id=version,
        details={"before": before, "after": {"date": entry.date, "changes": entry.changes}},
    )

    db.commit()
    db.refresh(entry)
    return {
        "ok": True,
        "entry": {
            "id": entry.id,
            "version": entry.version,
            "date": entry.date,
            "changes": entry.changes,
            "updated_at": entry.updated_at.isoformat() if entry.updated_at else None,
        },
    }


@router.delete("/changelog/{version}")
def admin_delete_changelog(
    version: str,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_user),
):
    """Delete a changelog entry"""
    entry = db.query(models.Changelog).filter(models.Changelog.version == version).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Changelog entry not found")

    _write_admin_audit(
        db,
        admin_user_id=admin.id,
        action="changelog.delete",
        target_type="changelog",
        target_id=version,
        details={"version": entry.version, "date": entry.date, "changes": entry.changes},
    )

    db.delete(entry)
    db.commit()
    return {"ok": True}
