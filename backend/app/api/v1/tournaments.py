import logging
from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from ...core import models, schemas
from ...api import deps
import json

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/", response_model=schemas.Tournament)
def create_tournament(
    tournament: schemas.TournamentCreate,
    db: Session = Depends(deps.get_db),
    user = Depends(deps.get_current_user)
):
    try:
        db_tournament = models.Tournament(
            name=tournament.name,
            location=tournament.location,
            start_date=tournament.start_date,
            end_date=tournament.end_date,
            squad_times=json.dumps(tournament.squad_times),
            user_id=user.id
        )
        db.add(db_tournament)
        db.commit()
        db.refresh(db_tournament)
        # squad_times is already stored as JSON string in the DB; no need to assign the dict here
        # Parse squad_times before returning for API response
        result = db_tournament.__dict__.copy()
        result['squad_times'] = tournament.squad_times
        return result
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating tournament: {e}")
        raise HTTPException(status_code=500, detail="Failed to create tournament")

@router.get("/", response_model=list[schemas.Tournament])
def list_tournaments(
    request: Request,
    db: Session = Depends(deps.get_db),
    user = Depends(deps.get_current_user)
):
    show_all = request.query_params.get('all') == '1'
    if show_all and getattr(user, 'is_admin', False):
        tournaments = db.query(models.Tournament).all()
    else:
        tournaments = db.query(models.Tournament).filter(models.Tournament.user_id == user.id).all()
    # Build response with squad_times parsed as dict
    result = []
    for t in tournaments:
        t_dict = t.__dict__.copy()
        if t.squad_times:
            t_dict['squad_times'] = json.loads(t.squad_times)
        else:
            t_dict['squad_times'] = {}
        result.append(t_dict)
    return result

@router.get("/{tournament_id}", response_model=schemas.Tournament)
def get_tournament(
    tournament_id: int,
    db: Session = Depends(deps.get_db),
    user = Depends(deps.get_current_user)
):
    t = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    t_dict = t.__dict__.copy()
    if t.squad_times:
        t_dict['squad_times'] = json.loads(t.squad_times)
    else:
        t_dict['squad_times'] = {}
    return t_dict

@router.put("/{tournament_id}", response_model=schemas.Tournament)
def update_tournament(
    tournament_id: int,
    tournament: schemas.TournamentUpdate,
    db: Session = Depends(deps.get_db),
    user = Depends(deps.get_current_user)
):
    try:
        db_t = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
        if not db_t:
            raise HTTPException(status_code=404, detail="Tournament not found")
        if db_t.user_id != user.id and not getattr(user, 'is_admin', False):
            raise HTTPException(status_code=403, detail="Not authorized to update this tournament")
        db_t.name = tournament.name
        if tournament.location is not None:
            db_t.location = tournament.location
        if tournament.start_date is not None:
            db_t.start_date = tournament.start_date
        if tournament.end_date is not None:
            db_t.end_date = tournament.end_date
        db_t.squad_times = json.dumps(tournament.squad_times)
        db.commit()
        db.refresh(db_t)
        # Parse squad_times before returning for API response
        result = db_t.__dict__.copy()
        result['squad_times'] = tournament.squad_times
        return result
    except HTTPException:
        # re-raise 404 or other explicit HTTPExceptions
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating tournament {tournament_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update tournament")

@router.delete("/{tournament_id}")
def delete_tournament(
    tournament_id: int,
    db: Session = Depends(deps.get_db),
    user = Depends(deps.get_current_user)
):
    db_t = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
    if not db_t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if db_t.user_id != user.id and not getattr(user, 'is_admin', False):
        raise HTTPException(status_code=403, detail="Not authorized to delete this tournament")

    try:
        # Delete in FK dependency order
        # 1. Payouts depend on winners/brackets
        db.query(models.BracketPayout).filter(models.BracketPayout.tournament_id == tournament_id).delete()
        db.query(models.BracketWinner).filter(models.BracketWinner.tournament_id == tournament_id).delete()
        db.query(models.TournamentPayoutSummary).filter(models.TournamentPayoutSummary.tournament_id == tournament_id).delete()

        # 2. Active bracket snapshots, scores, history, players, settings
        db.query(models.BracketSnapshot).filter(models.BracketSnapshot.tournament_id == tournament_id).delete()
        db.query(models.FirstRoundMatchupHistory).filter(models.FirstRoundMatchupHistory.tournament_id == tournament_id).delete()
        db.query(models.PlayerScore).filter(models.PlayerScore.tournament_id == tournament_id).delete()
        db.query(models.TournamentPlayer).filter(models.TournamentPlayer.tournament_id == tournament_id).delete()
        db.query(models.TournamentBracketSettings).filter(models.TournamentBracketSettings.tournament_id == tournament_id).delete()

        # 3. User squad selections depend on squads
        squad_ids = [s.id for s in db.query(models.TournamentSquad.id).filter(
            models.TournamentSquad.tournament_id == tournament_id).all()]
        if squad_ids:
            db.query(models.UserSquadSelection).filter(models.UserSquadSelection.tournament_squad_id.in_(squad_ids)).delete()
        db.query(models.TournamentSquad).filter(models.TournamentSquad.tournament_id == tournament_id).delete()

        # 4. Finally delete the tournament
        db.delete(db_t)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting tournament {tournament_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete tournament")

    return {"ok": True}
