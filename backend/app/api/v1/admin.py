from datetime import date, datetime
from decimal import Decimal
import math
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import MetaData, Table, asc, delete, desc, func, inspect, or_, select, text
from sqlalchemy.orm import Session

from ..deps import get_db, require_admin_user
from ...core import models

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__default_rounds=10)


class AdminUpdateUserPayload(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    organization: Optional[str] = None


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


class AdminReassignTournamentPayload(BaseModel):
    new_owner_user_id: int


class AdminArchiveTournamentPayload(BaseModel):
    reason: Optional[str] = None


class AdminDeleteTournamentPayload(BaseModel):
    reason: Optional[str] = None
    force: bool = False
    confirm_text: Optional[str] = None


router = APIRouter()


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


def _get_reflected_table(db: Session, table_name: str):
    metadata = MetaData()
    try:
        return Table(table_name, metadata, autoload_with=db.bind)
    except Exception:
        return None


def _total_pages(total: int, page_size: int) -> int:
    return max(1, math.ceil(total / page_size)) if total > 0 else 1


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
    }


def _hard_delete_tournament(db: Session, tournament_id: int) -> None:
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


@router.get("/overview")
def get_admin_overview(
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_user),
):
    total_users = db.scalar(select(func.count()).select_from(models.User)) or 0
    admin_users = db.scalar(select(func.count()).select_from(models.User).where(models.User.is_admin.is_(True))) or 0
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
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=5, le=200),
    search: Optional[str] = Query(default=None),
    sort: str = Query(default="id_asc"),
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_user),
):
    normalized_search = (search or "").strip()
    like = f"%{normalized_search}%"

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
            tournament_count_expr.label("tournament_count"),
            profile_count_expr.label("profile_count"),
        )
        .outerjoin(models.Tournament, models.Tournament.user_id == models.User.id)
        .outerjoin(models.BowlerProfile, models.BowlerProfile.user_id == models.User.id)
        .group_by(models.User.id)
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

    if sort == "id_desc":
        query = query.order_by(models.User.id.desc())
    elif sort == "name_asc":
        query = query.order_by(models.User.first_name.asc(), models.User.last_name.asc(), models.User.id.asc())
    elif sort == "name_desc":
        query = query.order_by(models.User.first_name.desc(), models.User.last_name.desc(), models.User.id.desc())
    elif sort == "tournaments_desc":
        query = query.order_by(desc(tournament_count_expr), models.User.id.asc())
    else:
        query = query.order_by(models.User.id.asc())

    rows = db.execute(query.offset(offset).limit(page_size))

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
                "tournament_count": row.tournament_count,
                "profile_count": row.profile_count,
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
    }

    if payload.name is not None:
        tournament.name = payload.name.strip()
    if payload.location is not None:
        tournament.location = payload.location.strip() or None
    if payload.start_date is not None:
        tournament.start_date = payload.start_date.strip() or None
    if payload.end_date is not None:
        tournament.end_date = payload.end_date.strip() or None

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
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=5, le=200),
    action: Optional[str] = Query(default=None),
    target_type: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_user),
):
    normalized_search = (search or "").strip()
    like = f"%{normalized_search}%"

    filters = []
    if action:
        filters.append(models.AdminAuditLog.action == action)
    if target_type:
        filters.append(models.AdminAuditLog.target_type == target_type)
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


@router.post("/users/{user_id}/reset-password")
def admin_reset_password(
    user_id: int,
    payload: AdminResetPasswordPayload,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin_user),
):
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Use the Settings page to change your own password")

    user.password = _pwd_context.hash(payload.new_password)

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

    impact = {
        "users": 1,
        "owned_tournaments": db.scalar(select(func.count()).select_from(models.Tournament).where(models.Tournament.user_id == user_id)) or 0,
        "bowler_profiles": db.scalar(select(func.count()).select_from(models.BowlerProfile).where(models.BowlerProfile.user_id == user_id)) or 0,
        "tournament_players": db.scalar(select(func.count()).select_from(models.TournamentPlayer).where(models.TournamentPlayer.user_id == user_id)) or 0,
        "user_squad_selections": db.scalar(select(func.count()).select_from(models.UserSquadSelection).where(models.UserSquadSelection.user_id == user_id)) or 0,
    }

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

    tournament_count = db.scalar(select(func.count()).select_from(models.Tournament).where(models.Tournament.user_id == user_id)) or 0
    if tournament_count > 0:
        raise HTTPException(status_code=400, detail="User owns tournaments. Reassign or delete them first.")

    _write_admin_audit(
        db,
        admin_user_id=admin.id,
        action="user.delete",
        target_type="user",
        target_id=user_id,
        reason=reason,
        details={"username": user.username, "email": user.email},
    )

    db.delete(user)
    db.commit()
    return {"ok": True}


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
