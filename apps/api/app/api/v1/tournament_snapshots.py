from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ...api import deps
from ...core import models
from ...services.tournament_access import require_tournament_permission
from ...services.tournament_audit import record_tournament_event
from ...services.tournament_snapshots import later_activity_count, restore_snapshot_state

router = APIRouter()


class RestoreRequest(BaseModel):
    confirmation: str
    acknowledge_later_activity: bool = False
    reason: str | None = None


def _summary(db: Session, row: models.TournamentRestorePoint) -> dict:
    later_count = later_activity_count(db, row)
    return {
        "id": row.id, "tournament_id": row.tournament_id, "trigger": row.trigger,
        "summary": row.summary, "created_by_user_id": row.created_by_user_id,
        "created_at": row.created_at, "restored_at": row.restored_at,
        "later_activity_count": later_count, "safe_to_restore": later_count <= 1,
    }


@router.get("/{tournament_id}")
def list_restore_points(tournament_id: int, db: Session = Depends(deps.get_db), user: models.User = Depends(deps.get_current_user)):
    require_tournament_permission(db, tournament_id, user, "view")
    rows = db.query(models.TournamentRestorePoint).filter(
        models.TournamentRestorePoint.tournament_id == tournament_id
    ).order_by(models.TournamentRestorePoint.created_at.desc(), models.TournamentRestorePoint.id.desc()).limit(100).all()
    return [_summary(db, row) for row in rows]


@router.get("/{tournament_id}/{restore_point_id}")
def inspect_restore_point(tournament_id: int, restore_point_id: int, db: Session = Depends(deps.get_db), user: models.User = Depends(deps.get_current_user)):
    require_tournament_permission(db, tournament_id, user, "view")
    row = db.query(models.TournamentRestorePoint).filter_by(id=restore_point_id, tournament_id=tournament_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Restore point not found")
    result = _summary(db, row)
    result["state_summary"] = {table: len(values) for table, values in row.payload.get("tables", {}).items()}
    result["tournament_state"] = row.payload.get("tournament", {})
    return result


@router.post("/{tournament_id}/{restore_point_id}/restore")
def restore_tournament(payload: RestoreRequest, tournament_id: int, restore_point_id: int, db: Session = Depends(deps.get_db), user: models.User = Depends(deps.get_current_user)):
    tournament = require_tournament_permission(
        db, tournament_id, user, "manage_tournament", allow_read_only_mutation=True
    )
    row = db.query(models.TournamentRestorePoint).filter_by(id=restore_point_id, tournament_id=tournament_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Restore point not found")
    if payload.confirmation.strip() != tournament.name:
        raise HTTPException(status_code=400, detail="Confirmation must exactly match the tournament name")
    later_count = later_activity_count(db, row)
    if later_count > 1 and not payload.acknowledge_later_activity:
        raise HTTPException(status_code=409, detail="Later tournament activity makes automatic restoration ambiguous; inspect the restore point and explicitly acknowledge later activity")
    restore_snapshot_state(db, row)
    row.restored_at = datetime.now(timezone.utc)
    row.restored_by_user_id = user.id
    record_tournament_event(
        db, tournament_id=tournament_id, event_type="tournament.snapshot_restored", user=user,
        summary=f"Restored tournament from {row.summary}", reason=(payload.reason or "").strip() or None,
        after_values={"restore_point_id": row.id, "later_activity_count": later_count},
        entity_type="restore_point", entity_id=row.id,
    )
    db.commit()
    return {"ok": True, "restore_point_id": row.id}
