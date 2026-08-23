from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...api import deps
from ...core import models
from ...services.tournament_access import require_tournament_permission
from ...services.tournament_audit import record_tournament_event
from ...services.tournament_snapshots import create_restore_point
from ...services.tournament_reconciliation import build_final_reconciliation

router = APIRouter()


class LifecycleReason(BaseModel):
    reason: str | None = Field(default=None, max_length=1000)


def _payload(tournament: models.Tournament) -> dict:
    return {
        "tournament_id": tournament.id,
        "status": "archived" if tournament.archived_at else tournament.lifecycle_status,
        "scores_locked": tournament.scores_locked,
        "finalized_at": tournament.finalized_at,
        "finalized_by_user_id": tournament.finalized_by_user_id,
        "archived_at": tournament.archived_at,
        "archive_reason": tournament.archive_reason,
        "read_only": tournament.archived_at is not None or tournament.lifecycle_status == "finalized",
    }


@router.get("/{tournament_id}")
def get_lifecycle(tournament_id: int, db: Session = Depends(deps.get_db), user: models.User = Depends(deps.get_current_user)):
    tournament = require_tournament_permission(db, tournament_id, user, "view")
    return _payload(tournament)


@router.post("/{tournament_id}/archive")
def archive_tournament(payload: LifecycleReason, tournament_id: int, db: Session = Depends(deps.get_db), user: models.User = Depends(deps.get_current_user)):
    tournament = require_tournament_permission(db, tournament_id, user, "archive")
    if tournament.archived_at is not None:
        return _payload(tournament)
    create_restore_point(
        db, tournament_id=tournament_id, user=user, trigger="tournament.archive",
        summary="Before tournament archive",
    )
    previous_status = tournament.lifecycle_status
    tournament.archived_at = datetime.now(timezone.utc)
    tournament.archive_reason = (payload.reason or "").strip() or None
    tournament.lifecycle_status = "archived"
    record_tournament_event(
        db, tournament_id=tournament_id, event_type="tournament.archived", user=user,
        summary="Archived tournament", before_values={"status": previous_status},
        after_values={"status": "archived"}, reason=tournament.archive_reason,
        entity_type="tournament", entity_id=tournament_id,
    )
    db.commit()
    return _payload(tournament)


@router.post("/{tournament_id}/restore")
def restore_tournament(payload: LifecycleReason, tournament_id: int, db: Session = Depends(deps.get_db), user: models.User = Depends(deps.get_current_user)):
    tournament = require_tournament_permission(db, tournament_id, user, "archive")
    if tournament.archived_at is None:
        return _payload(tournament)
    restored_status = "finalized" if tournament.finalized_at else "payout_review" if tournament.scores_locked else "in_progress"
    tournament.archived_at = None
    tournament.archive_reason = None
    tournament.lifecycle_status = restored_status
    record_tournament_event(
        db, tournament_id=tournament_id, event_type="tournament.restored", user=user,
        summary="Restored tournament", before_values={"status": "archived"},
        after_values={"status": restored_status}, reason=(payload.reason or "").strip() or None,
        entity_type="tournament", entity_id=tournament_id,
    )
    db.commit()
    return _payload(tournament)


@router.post("/{tournament_id}/finalize")
def finalize_tournament(payload: LifecycleReason, tournament_id: int, db: Session = Depends(deps.get_db), user: models.User = Depends(deps.get_current_user)):
    tournament = require_tournament_permission(
        db, tournament_id, user, "manage_payouts", allow_read_only_mutation=True
    )
    summaries = db.query(models.TournamentPayoutSummary).filter(models.TournamentPayoutSummary.tournament_id == tournament_id).all()
    if not summaries:
        raise HTTPException(status_code=409, detail="Calculate and save payouts before finalizing the tournament")
    if tournament.finalized_at is not None:
        return _payload(tournament)
    reconciliation = build_final_reconciliation(db, tournament_id)
    if not reconciliation["ready_to_finalize"]:
        raise HTTPException(
            status_code=409,
            detail={"message": "Tournament is not ready to finalize", "warnings": reconciliation["warnings"]},
        )
    create_restore_point(
        db, tournament_id=tournament_id, user=user, trigger="payouts.finalize",
        summary="Before payout finalization",
    )
    now = datetime.now(timezone.utc)
    for summary in summaries:
        summary.is_finalized = True
        summary.finalized_date = now.isoformat()
        summary.finalized_by_user_id = user.id
    tournament.lifecycle_status = "finalized"
    tournament.scores_locked = True
    tournament.finalized_at = now
    tournament.finalized_by_user_id = user.id
    record_tournament_event(
        db, tournament_id=tournament_id, event_type="payouts.finalized", user=user,
        summary="Finalized tournament payouts", after_values={"status": "finalized", "scores_locked": True},
        reason=(payload.reason or "").strip() or None, entity_type="tournament", entity_id=tournament_id,
    )
    db.commit()
    return _payload(tournament)
