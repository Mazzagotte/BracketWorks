import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...api import deps
from ...core import models, schemas

logger = logging.getLogger(__name__)
router = APIRouter()


def _verify_tournament_access(db: Session, tournament_id: int, user: models.User) -> models.Tournament:
    tournament = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    if tournament.user_id != user.id and not getattr(user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Not authorized to access this tournament")

    return tournament


@router.get("/mine", response_model=list[schemas.TournamentSetupStateSummary])
def list_my_tournament_setup_states(
    db: Session = Depends(deps.get_db),
    user: models.User = Depends(deps.get_current_user),
):
    rows = (
        db.query(models.TournamentSetupState, models.Tournament)
        .join(
            models.Tournament,
            models.Tournament.id == models.TournamentSetupState.tournament_id,
        )
        .filter(models.TournamentSetupState.user_id == user.id)
        .order_by(models.TournamentSetupState.updated_at.desc())
        .all()
    )

    return [
        schemas.TournamentSetupStateSummary(
            tournament_id=state.tournament_id,
            tournament_name=tournament.name,
            tournament_location=tournament.location,
            tournament_start_date=tournament.start_date,
            tournament_end_date=tournament.end_date,
            is_published=state.is_published,
            created_at=state.created_at,
            updated_at=state.updated_at,
        )
        for state, tournament in rows
    ]


@router.get("/{tournament_id}", response_model=schemas.TournamentSetupState | None)
def get_tournament_setup_state(
    tournament_id: int,
    db: Session = Depends(deps.get_db),
    user: models.User = Depends(deps.get_current_user),
):
    tournament = _verify_tournament_access(db, tournament_id, user)

    state = db.query(models.TournamentSetupState).filter(
        models.TournamentSetupState.tournament_id == tournament_id,
        models.TournamentSetupState.user_id == tournament.user_id,
    ).first()

    return state


@router.put("/{tournament_id}", response_model=schemas.TournamentSetupState)
def upsert_tournament_setup_state(
    tournament_id: int,
    payload: schemas.TournamentSetupStateUpsert,
    db: Session = Depends(deps.get_db),
    user: models.User = Depends(deps.get_current_user),
):
    tournament = _verify_tournament_access(db, tournament_id, user)

    try:
        state = db.query(models.TournamentSetupState).filter(
            models.TournamentSetupState.tournament_id == tournament_id,
            models.TournamentSetupState.user_id == tournament.user_id,
        ).first()

        if state is None:
            state = models.TournamentSetupState(
                tournament_id=tournament_id,
                user_id=tournament.user_id,
                payload=payload.payload,
                is_published=payload.is_published,
            )
            db.add(state)
        else:
            state.payload = payload.payload
            state.is_published = payload.is_published
            if state.user_id != tournament.user_id:
                state.user_id = tournament.user_id

        db.commit()
        db.refresh(state)
        return state
    except Exception as error:
        db.rollback()
        logger.error(
            "Error saving tournament setup state",
            extra={
                "tournament_id": tournament_id,
                "user_id": getattr(user, "id", None),
                "error": str(error),
            },
        )
        raise HTTPException(status_code=500, detail="Failed to save organizer setup")
