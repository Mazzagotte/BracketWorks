from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ...api import deps
from ...core import models
from ...services.tournament_access import require_tc_tournament_permission

router = APIRouter()


class TcBowlerCheckInPayload(BaseModel):
    checked_in: bool


def _isoformat(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


@router.put("/{tournament_id}/bowlers/{bowler_id}/check-in")
def set_bowler_check_in(
    tournament_id: int,
    bowler_id: int,
    payload: TcBowlerCheckInPayload,
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    tournament = require_tc_tournament_permission(db, tournament_id, user, "manage_entries")
    bowler = db.query(models.TcRegistrationBowler).filter(
        models.TcRegistrationBowler.id == bowler_id,
        models.TcRegistrationBowler.tournament_id == tournament.id,
    ).first()
    if not bowler:
        raise HTTPException(status_code=404, detail="Bowler not found")

    if payload.checked_in:
        if bowler.checked_in_at is None:
            bowler.checked_in_at = datetime.now(timezone.utc)
            bowler.checked_in_by_user_id = user.id
    else:
        bowler.checked_in_at = None
        bowler.checked_in_by_user_id = None

    db.commit()
    db.refresh(bowler)
    return {"bowler_id": bowler.id, "checked_in_at": _isoformat(bowler.checked_in_at)}
