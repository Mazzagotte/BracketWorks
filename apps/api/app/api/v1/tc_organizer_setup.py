import logging

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from sqlalchemy.orm import Session

from ...api import deps
from ...core import models, schemas
from ...services.tc_tournament_logo import validate_tournament_logo_upload
from ...services.tournament_access import verify_owned_tc_tournament_access

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/mine", response_model=list[schemas.TournamentSetupStateSummary])
def list_my_tournament_setup_states(
    db: Session = Depends(deps.get_db),
    user: models.User = Depends(deps.get_current_user),
):
    rows = (
        db.query(models.TournamentCentralSetupState, models.TournamentCentral)
        .join(
            models.TournamentCentral,
            models.TournamentCentral.id == models.TournamentCentralSetupState.tournament_id,
        )
        .filter(models.TournamentCentralSetupState.user_id == user.id)
        .order_by(models.TournamentCentralSetupState.updated_at.desc())
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
    tournament = verify_owned_tc_tournament_access(db, tournament_id, user)

    state = db.query(models.TournamentCentralSetupState).filter(
        models.TournamentCentralSetupState.tournament_id == tournament_id,
        models.TournamentCentralSetupState.user_id == tournament.user_id,
    ).first()

    return state


@router.put("/{tournament_id}", response_model=schemas.TournamentSetupState)
def upsert_tournament_setup_state(
    tournament_id: int,
    payload: schemas.TournamentSetupStateUpsert,
    db: Session = Depends(deps.get_db),
    user: models.User = Depends(deps.get_current_user),
):
    tournament = verify_owned_tc_tournament_access(db, tournament_id, user)

    try:
        state = db.query(models.TournamentCentralSetupState).filter(
            models.TournamentCentralSetupState.tournament_id == tournament_id,
            models.TournamentCentralSetupState.user_id == tournament.user_id,
        ).first()

        if state is None:
            state = models.TournamentCentralSetupState(
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
            "Error saving TC tournament setup state",
            extra={
                "tournament_id": tournament_id,
                "user_id": getattr(user, "id", None),
                "error": str(error),
            },
        )
        raise HTTPException(status_code=500, detail="Failed to save organizer setup")


@router.post("/{tournament_id}/logo")
async def upload_tournament_logo(
    tournament_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    user: models.User = Depends(deps.get_current_user),
):
    tournament = verify_owned_tc_tournament_access(db, tournament_id, user)

    content = await file.read()
    validate_tournament_logo_upload(file.content_type, content)

    try:
        tournament.logo_blob = content
        tournament.logo_mime_type = file.content_type or "application/octet-stream"
        tournament.logo_file_name = file.filename or "logo"
        db.commit()
        db.refresh(tournament)
    except Exception as error:
        db.rollback()
        logger.error(
            "Error uploading TC tournament logo",
            extra={
                "tournament_id": tournament_id,
                "user_id": getattr(user, "id", None),
                "error": str(error),
            },
        )
        raise HTTPException(status_code=500, detail="Failed to upload tournament logo")

    return {
        "ok": True,
        "tournament_id": tournament.id,
        "logo_file_name": tournament.logo_file_name,
        "logo_mime_type": tournament.logo_mime_type,
    }


@router.get("/{tournament_id}/logo")
def get_tournament_logo(
    tournament_id: int,
    db: Session = Depends(deps.get_db),
    user: models.User = Depends(deps.get_current_user),
):
    tournament = verify_owned_tc_tournament_access(db, tournament_id, user)
    if not tournament.logo_blob:
        raise HTTPException(status_code=404, detail="Tournament logo not found")

    headers = {}
    if tournament.logo_file_name:
        headers["Content-Disposition"] = f'inline; filename="{tournament.logo_file_name}"'

    return Response(
        content=tournament.logo_blob,
        media_type=tournament.logo_mime_type or "application/octet-stream",
        headers=headers,
    )


@router.delete("/{tournament_id}/logo")
def delete_tournament_logo(
    tournament_id: int,
    db: Session = Depends(deps.get_db),
    user: models.User = Depends(deps.get_current_user),
):
    tournament = verify_owned_tc_tournament_access(db, tournament_id, user)

    try:
        tournament.logo_blob = None
        tournament.logo_mime_type = None
        tournament.logo_file_name = None
        db.commit()
    except Exception as error:
        db.rollback()
        logger.error(
            "Error deleting TC tournament logo",
            extra={
                "tournament_id": tournament_id,
                "user_id": getattr(user, "id", None),
                "error": str(error),
            },
        )
        raise HTTPException(status_code=500, detail="Failed to delete tournament logo")

    return {"ok": True}
