import logging
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from ...core import models, schemas
from ...api import deps
import json
from time import perf_counter

logger = logging.getLogger(__name__)
router = APIRouter()


def _tournament_to_dict(tournament: models.Tournament) -> dict:
    tournament_dict = tournament.__dict__.copy()
    if tournament.squad_times:
        tournament_dict['squad_times'] = json.loads(tournament.squad_times)
    else:
        tournament_dict['squad_times'] = {}
    return tournament_dict


def _bracket_settings_to_dict(settings: models.TournamentBracketSettings | None) -> dict | None:
    if not settings:
        return None

    return {
        'id': settings.id,
        'tournament_id': settings.tournament_id,
        'bracket_size': settings.bracket_size,
        'first_place_amount': settings.first_place_amount,
        'second_place_amount': settings.second_place_amount,
        'house_fee_amount': settings.house_fee_amount,
        'default_entry_fee': settings.default_entry_fee,
        'bracket_programs': settings.bracket_programs,
        'handicap_percentage': settings.handicap_percentage,
        'handicap_base': settings.handicap_base,
        'allow_byes': settings.allow_byes,
    }

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
    limit: int | None = Query(default=None, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(deps.get_db),
    user = Depends(deps.get_current_user)
):
    show_all = request.query_params.get('all') == '1'
    query = db.query(models.Tournament).order_by(models.Tournament.id.desc())

    if not (show_all and getattr(user, 'is_admin', False)):
        query = query.filter(models.Tournament.user_id == user.id)

    if offset:
        query = query.offset(offset)
    if limit is not None:
        query = query.limit(limit)

    tournaments = query.all()

    if not tournaments:
        return []

    tournament_ids = [t.id for t in tournaments]

    # Batch: entry count per tournament (one query, no N+1)
    entry_counts: dict[int, int] = dict(
        db.query(models.TournamentPlayer.tournament_id, func.count(models.TournamentPlayer.id))
        .filter(models.TournamentPlayer.tournament_id.in_(tournament_ids))
        .group_by(models.TournamentPlayer.tournament_id)
        .all()
    )

    # Batch: which tournaments have bracket settings with bracket_size configured
    brackets_configured_ids: set[int] = set(
        row[0] for row in
        db.query(models.TournamentBracketSettings.tournament_id)
        .filter(
            models.TournamentBracketSettings.tournament_id.in_(tournament_ids),
            models.TournamentBracketSettings.bracket_size.isnot(None),
        )
        .all()
    )

    result = []
    for t in tournaments:
        d = _tournament_to_dict(t)
        d['entry_count'] = entry_counts.get(t.id, 0)
        d['brackets_configured'] = t.id in brackets_configured_ids
        result.append(d)
    return result


@router.get("/bootstrap")
def get_tournament_bootstrap(
    tournament_id: int,
    db: Session = Depends(deps.get_db),
    user = Depends(deps.get_current_user),
):
    started = perf_counter()
    tournament_query = db.query(models.Tournament).filter(models.Tournament.id == tournament_id)
    if not getattr(user, 'is_admin', False):
        tournament_query = tournament_query.filter(models.Tournament.user_id == user.id)

    tournament = tournament_query.first()
    if not tournament:
        logger.info(
            "Bootstrap load completed",
            extra={
                "tournament_id": tournament_id,
                "user_id": getattr(user, 'id', None),
                "found": False,
                "duration_ms": round((perf_counter() - started) * 1000, 2),
            },
        )
        return {
            'tournament': None,
            'squads': [],
            'selected_squad': None,
            'bracket_settings': None,
        }

    squads = db.query(models.Squad).filter(
        models.Squad.tournament_id == tournament_id
    ).order_by(models.Squad.date.asc(), models.Squad.time.asc(), models.Squad.id.asc()).all()

    squad_payload = [
        {
            'id': squad.id,
            'tournament_id': squad.tournament_id,
            'date': str(squad.date),
            'time': squad.time,
        }
        for squad in squads
    ]

    selected = db.query(models.SelectedSquad).filter(models.SelectedSquad.user_id == user.id).first()
    allowed_squad_ids = {squad.id for squad in squads}
    selected_payload = None
    if selected and selected.squad_id in allowed_squad_ids:
        selected_payload = {
            'id': selected.id,
            'user_id': selected.user_id,
            'squad_id': selected.squad_id,
        }

    settings = db.query(models.TournamentBracketSettings).filter(
        models.TournamentBracketSettings.tournament_id == tournament_id
    ).first()

    result = {
        'tournament': _tournament_to_dict(tournament),
        'squads': squad_payload,
        'selected_squad': selected_payload,
        'bracket_settings': _bracket_settings_to_dict(settings),
    }

    logger.info(
        "Bootstrap load completed",
        extra={
            "tournament_id": tournament_id,
            "user_id": getattr(user, 'id', None),
            "found": True,
            "squads_count": len(squad_payload),
            "has_selected_squad": selected_payload is not None,
            "has_bracket_settings": settings is not None,
            "duration_ms": round((perf_counter() - started) * 1000, 2),
        },
    )

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
    return _tournament_to_dict(t)

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
