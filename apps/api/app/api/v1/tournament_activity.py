from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ...api import deps
from ...core import models, schemas
from ...services.tournament_access import verify_owned_tournament_access

router = APIRouter()


@router.get("/{tournament_id}", response_model=list[schemas.TournamentAuditEntry])
def list_tournament_activity(
    tournament_id: int,
    limit: int = Query(default=8, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(deps.get_db),
    user: models.User = Depends(deps.get_current_user),
):
    verify_owned_tournament_access(db, tournament_id, user, permission="view")
    return (
        db.query(models.TournamentAuditLog)
        .filter(models.TournamentAuditLog.tournament_id == tournament_id)
        .order_by(models.TournamentAuditLog.created_at.desc(), models.TournamentAuditLog.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
