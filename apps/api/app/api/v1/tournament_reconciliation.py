from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...api import deps
from ...core import models
from ...services.tournament_access import require_tournament_permission
from ...services.tournament_reconciliation import build_final_reconciliation

router = APIRouter()


@router.get("/{tournament_id}")
def get_final_reconciliation(tournament_id: int, db: Session = Depends(deps.get_db), user: models.User = Depends(deps.get_current_user)):
    require_tournament_permission(db, tournament_id, user, "view")
    return build_final_reconciliation(db, tournament_id)
