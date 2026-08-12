import json
import logging

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from sqlalchemy.orm import Session

from ...api import deps
from ...core import models, schemas
from ...services.tc_tournament_logo import validate_tournament_logo_upload
from ...services.tournament_access import verify_owned_tc_tournament_access

logger = logging.getLogger(__name__)
router = APIRouter()


def _tc_tournament_to_dict(tournament: models.TournamentCentral) -> dict:
    tournament_dict = tournament.__dict__.copy()
    if tournament.squad_times:
        tournament_dict["squad_times"] = json.loads(tournament.squad_times)
    else:
        tournament_dict["squad_times"] = {}

    # Keep compatibility with existing TournamentSummary consumers.
    tournament_dict["entry_count"] = 0
    tournament_dict["brackets_configured"] = False
    tournament_dict["has_logo"] = bool(tournament.logo_blob)
    tournament_dict["logo_file_name"] = tournament.logo_file_name
    tournament_dict["logo_mime_type"] = tournament.logo_mime_type
    return tournament_dict


@router.post("", response_model=schemas.Tournament)
@router.post("/", response_model=schemas.Tournament)
def create_tournament(
    tournament: schemas.TournamentCreate,
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    try:
        db_tournament = models.TournamentCentral(
            name=tournament.name,
            location=tournament.location,
            start_date=tournament.start_date,
            end_date=tournament.end_date,
            squad_times=json.dumps(tournament.squad_times),
            is_public=tournament.is_public,
            user_id=user.id,
        )
        db.add(db_tournament)
        db.commit()
        db.refresh(db_tournament)
        return _tc_tournament_to_dict(db_tournament)
    except Exception as error:
        db.rollback()
        logger.error(f"Error creating TC tournament: {error}")
        raise HTTPException(status_code=500, detail="Failed to create tournament")


@router.get("", response_model=list[schemas.Tournament])
@router.get("/", response_model=list[schemas.Tournament])
def list_tournaments(
    limit: int | None = Query(default=None, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    query = db.query(models.TournamentCentral).order_by(models.TournamentCentral.id.desc())

    if not getattr(user, "is_admin", False):
        query = query.filter(models.TournamentCentral.user_id == user.id)

    if offset:
        query = query.offset(offset)
    if limit is not None:
        query = query.limit(limit)

    tournaments = query.all()
    return [_tc_tournament_to_dict(tournament) for tournament in tournaments]


@router.get("/{tournament_id}", response_model=schemas.Tournament)
def get_tournament(
    tournament_id: int,
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    tournament = verify_owned_tc_tournament_access(db, tournament_id, user)
    return _tc_tournament_to_dict(tournament)


@router.put("/{tournament_id}", response_model=schemas.Tournament)
def update_tournament(
    tournament_id: int,
    tournament: schemas.TournamentUpdate,
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    try:
        db_tournament = verify_owned_tc_tournament_access(db, tournament_id, user)

        db_tournament.name = tournament.name
        if tournament.location is not None:
            db_tournament.location = tournament.location
        if tournament.start_date is not None:
            db_tournament.start_date = tournament.start_date
        if tournament.end_date is not None:
            db_tournament.end_date = tournament.end_date
        db_tournament.squad_times = json.dumps(tournament.squad_times)
        if tournament.is_public is not None:
            db_tournament.is_public = tournament.is_public

        db.commit()
        db.refresh(db_tournament)
        return _tc_tournament_to_dict(db_tournament)
    except HTTPException:
        raise
    except Exception as error:
        db.rollback()
        logger.error(f"Error updating TC tournament {tournament_id}: {error}")
        raise HTTPException(status_code=500, detail="Failed to update tournament")


@router.post("/{tournament_id}/logo")
async def upload_tournament_logo(
    tournament_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
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
        logger.error(f"Error uploading logo for TC tournament {tournament_id}: {error}")
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
    user=Depends(deps.get_current_user),
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
    user=Depends(deps.get_current_user),
):
    tournament = verify_owned_tc_tournament_access(db, tournament_id, user)

    try:
        tournament.logo_blob = None
        tournament.logo_mime_type = None
        tournament.logo_file_name = None
        db.commit()
    except Exception as error:
        db.rollback()
        logger.error(f"Error deleting logo for TC tournament {tournament_id}: {error}")
        raise HTTPException(status_code=500, detail="Failed to delete tournament logo")

    return {"ok": True}


@router.delete("/{tournament_id}")
def delete_tournament(
    tournament_id: int,
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    tournament = verify_owned_tc_tournament_access(db, tournament_id, user)

    try:
        db.query(models.TournamentCentralSetupState).filter(
            models.TournamentCentralSetupState.tournament_id == tournament_id
        ).delete()
        db.delete(tournament)
        db.commit()
    except Exception as error:
        db.rollback()
        logger.error(f"Error deleting TC tournament {tournament_id}: {error}")
        raise HTTPException(status_code=500, detail="Failed to delete tournament")

    return {"ok": True}
