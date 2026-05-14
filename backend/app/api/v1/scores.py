from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert
from typing import List, Optional
from pydantic import AliasChoices, BaseModel, ConfigDict, Field
import logging

from app.api.deps import get_current_user, get_db
from app.core.models import PlayerScore, TournamentBracketSettings, TournamentPlayer
from app.core.idempotency import IdempotencyReplay, begin_request, complete_request, fail_request

router = APIRouter()
logger = logging.getLogger(__name__)


def calculate_handicap(average: int, handicap_base: float, handicap_percentage: float) -> int:
    """
    Calculate handicap for a bowler.
    Formula: (handicap_base - average) * (handicap_percentage / 100)
    """
    if average is None:
        return 0
    handicap = (handicap_base - average) * (handicap_percentage / 100)
    return int(round(handicap))


def get_handicap_for_bowler(
    player: TournamentPlayer,
    tournament_id: int,
    db: Session,
    settings: Optional[TournamentBracketSettings] = None,
) -> int:
    """Get calculated handicap for a player based on tournament settings.

    Pass ``settings`` to avoid an extra DB round-trip when the caller has
    already fetched tournament settings (e.g. in a batch loop).
    """
    if settings is None:
        settings = db.query(TournamentBracketSettings).filter(
            TournamentBracketSettings.tournament_id == tournament_id
        ).first()

    handicap_base = settings.handicap_base if settings else 200.0
    handicap_percentage = settings.handicap_percentage if settings else 80.0

    return calculate_handicap(player.average, handicap_base, handicap_percentage)


def calculate_game_totals(score_data, handicap: int) -> dict:
    """Calculate game totals by adding handicap to scratch scores"""
    totals = {}
    
    if hasattr(score_data, 'game1_scratch') and score_data.game1_scratch is not None:
        totals['game1_total'] = score_data.game1_scratch + handicap
    if hasattr(score_data, 'game2_scratch') and score_data.game2_scratch is not None:
        totals['game2_total'] = score_data.game2_scratch + handicap
    if hasattr(score_data, 'game3_scratch') and score_data.game3_scratch is not None:
        totals['game3_total'] = score_data.game3_scratch + handicap
    
    return totals

class ScoreCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    player_id: int = Field(validation_alias=AliasChoices("player_id", "bowler_id"))
    tournament_id: int
    squad_id: int
    game1_scratch: Optional[int] = None
    game2_scratch: Optional[int] = None
    game3_scratch: Optional[int] = None
    # Note: game totals are calculated automatically by backend (scratch + handicap)

class ScoreUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    game1_scratch: Optional[int] = None
    game2_scratch: Optional[int] = None
    game3_scratch: Optional[int] = None
    # Note: game totals are calculated automatically by backend (scratch + handicap)

class ScoreResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    player_id: int
    tournament_id: int
    squad_id: int
    game1_scratch: Optional[int] = None
    game1_with_handicap: Optional[int] = Field(default=None, validation_alias=AliasChoices("game1_with_handicap", "game1_total"))
    game2_scratch: Optional[int] = None
    game2_with_handicap: Optional[int] = Field(default=None, validation_alias=AliasChoices("game2_with_handicap", "game2_total"))
    game3_scratch: Optional[int] = None
    game3_with_handicap: Optional[int] = Field(default=None, validation_alias=AliasChoices("game3_with_handicap", "game3_total"))

@router.get("/", response_model=List[ScoreResponse])
def get_scores(
    tournament_id: Optional[int] = None,
    squad_id: Optional[int] = None,
    player_id: Optional[int] = Query(None),
    bowler_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get scores with optional filtering"""
    query = db.query(PlayerScore)
    
    if tournament_id:
        query = query.filter(PlayerScore.tournament_id == tournament_id)
    if squad_id:
        query = query.filter(PlayerScore.squad_id == squad_id)
    target_player_id = player_id or bowler_id
    if target_player_id:
        query = query.filter(PlayerScore.player_id == target_player_id)
    
    scores = query.all()
    return scores

@router.post("/", response_model=ScoreResponse)
def create_or_update_score(
    score_data: ScoreCreate,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create or update a score for a player."""
    
    idempotency_record = None
    try:
        if idempotency_key:
            replay_or_record = begin_request(
                db,
                endpoint_scope="scores:create-or-update",
                idempotency_key=idempotency_key,
                request_payload=score_data.model_dump(exclude_unset=False),
                user_id=getattr(current_user, "id", None),
            )
            if isinstance(replay_or_record, IdempotencyReplay):
                return JSONResponse(status_code=replay_or_record.status_code, content=replay_or_record.response_body)
            idempotency_record = replay_or_record

        # Get player information
        player = db.query(TournamentPlayer).filter(TournamentPlayer.id == score_data.player_id).first()
        if not player:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Player not found"
            )

        # Calculate handicap and game totals
        handicap = get_handicap_for_bowler(player, score_data.tournament_id, db)
        logger.info(f"Calculating handicap for player {player.full_name} (avg={player.average}): {handicap}")

        # Build score dictionary with calculated totals
        score_dict = score_data.model_dump(exclude_unset=True)
        score_dict.update(calculate_game_totals(score_data, handicap))

        # Single-statement upsert — no separate SELECT needed.
        # The unique constraint on (player_id, tournament_id, squad_id) makes this safe.
        update_cols = {k: v for k, v in score_dict.items()
                       if k not in ("player_id", "tournament_id", "squad_id")}
        stmt = (
            pg_insert(PlayerScore)
            .values(**score_dict)
            .on_conflict_do_update(
                constraint="uq_player_scores_player_tournament_squad",
                set_=update_cols,
            )
            .returning(PlayerScore)
        )
        result = db.execute(stmt)
        db.commit()
        score = result.scalars().one()
        logger.info(f"Upserted score for player {player.full_name}: G1={score.game1_total}, G2={score.game2_total}, G3={score.game3_total}")

        if idempotency_record:
            response_body = {
                "id": score.id,
                "player_id": score.player_id,
                "tournament_id": score.tournament_id,
                "squad_id": score.squad_id,
                "game1_scratch": score.game1_scratch,
                "game1_with_handicap": score.game1_total,
                "game2_scratch": score.game2_scratch,
                "game2_with_handicap": score.game2_total,
                "game3_scratch": score.game3_scratch,
                "game3_with_handicap": score.game3_total,
            }
            complete_request(db, idempotency_record, status_code=200, response_body=response_body)
            db.commit()

        return score
    except HTTPException:
        if idempotency_record:
            fail_request(db, idempotency_record)
            db.commit()
        raise
    except Exception:
        if idempotency_record:
            fail_request(db, idempotency_record)
            db.commit()
        raise

@router.put("/{score_id}", response_model=ScoreResponse)
def update_score(
    score_id: int,
    score_data: ScoreUpdate,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update specific score by ID"""
    idempotency_record = None
    try:
        if idempotency_key:
            replay_or_record = begin_request(
                db,
                endpoint_scope="scores:update",
                idempotency_key=idempotency_key,
                request_payload={"score_id": score_id, **score_data.model_dump(exclude_unset=False)},
                user_id=getattr(current_user, "id", None),
            )
            if isinstance(replay_or_record, IdempotencyReplay):
                return JSONResponse(status_code=replay_or_record.status_code, content=replay_or_record.response_body)
            idempotency_record = replay_or_record

        score = db.query(PlayerScore).filter(PlayerScore.id == score_id).first()
        if not score:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Score not found"
            )
        
        # Get player information
        player = db.query(TournamentPlayer).filter(TournamentPlayer.id == score.player_id).first()
        if not player:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Player not found"
            )
        
        # Calculate handicap and game totals
        handicap = get_handicap_for_bowler(player, score.tournament_id, db)
        logger.info(f"Calculating handicap for player {player.full_name} (avg={player.average}): {handicap}")
        
        # Build score dictionary with calculated totals
        score_dict = score_data.model_dump(exclude_unset=True)
        score_dict.update(calculate_game_totals(score_data, handicap))
        
        # Update fields
        for field, value in score_dict.items():
            setattr(score, field, value)
        
        db.commit()
        db.refresh(score)
        logger.info(f"Updated score for player {player.full_name}: G1={score.game1_total}, G2={score.game2_total}, G3={score.game3_total}")

        if idempotency_record:
            response_body = {
                "id": score.id,
                "player_id": score.player_id,
                "tournament_id": score.tournament_id,
                "squad_id": score.squad_id,
                "game1_scratch": score.game1_scratch,
                "game1_with_handicap": score.game1_total,
                "game2_scratch": score.game2_scratch,
                "game2_with_handicap": score.game2_total,
                "game3_scratch": score.game3_scratch,
                "game3_with_handicap": score.game3_total,
            }
            complete_request(db, idempotency_record, status_code=200, response_body=response_body)
            db.commit()

        return score
    except HTTPException:
        if idempotency_record:
            fail_request(db, idempotency_record)
            db.commit()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating score {score_id}: {e}")
        if idempotency_record:
            fail_request(db, idempotency_record)
            db.commit()
        raise HTTPException(status_code=500, detail="Failed to update score")

@router.delete("/{score_id}")
def delete_score(
    score_id: int,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete a score"""
    idempotency_record = None
    try:
        if idempotency_key:
            replay_or_record = begin_request(
                db,
                endpoint_scope="scores:delete",
                idempotency_key=idempotency_key,
                request_payload={"score_id": score_id},
                user_id=getattr(current_user, "id", None),
            )
            if isinstance(replay_or_record, IdempotencyReplay):
                return JSONResponse(status_code=replay_or_record.status_code, content=replay_or_record.response_body)
            idempotency_record = replay_or_record

        score = db.query(PlayerScore).filter(PlayerScore.id == score_id).first()
        if not score:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Score not found"
            )
        
        db.delete(score)
        db.commit()
        response_body = {"message": "Score deleted successfully"}
        if idempotency_record:
            complete_request(db, idempotency_record, status_code=200, response_body=response_body)
            db.commit()
        return response_body
    except HTTPException:
        if idempotency_record:
            fail_request(db, idempotency_record)
            db.commit()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting score {score_id}: {e}")
        if idempotency_record:
            fail_request(db, idempotency_record)
            db.commit()
        raise HTTPException(status_code=500, detail="Failed to delete score")


@router.delete("/dev/clear-game/{game_number}")
def dev_clear_game_scores(
    game_number: int,
    tournament_id: int = Query(...),
    squad_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """
    DEV ONLY — Null out all scores for a specific game number (2 or 3)
    across all players in the given tournament/squad.
    """
    if game_number not in (2, 3):
        raise HTTPException(status_code=400, detail="Only game 2 or game 3 can be cleared with this endpoint")

    query = db.query(PlayerScore).filter(PlayerScore.tournament_id == tournament_id)
    if squad_id is not None:
        query = query.filter(PlayerScore.squad_id == squad_id)

    scores = query.all()
    scratch_field = f"game{game_number}_scratch"
    total_field = f"game{game_number}_total"

    for score in scores:
        setattr(score, scratch_field, None)
        setattr(score, total_field, None)

    db.commit()
    logger.info(f"[DEV] Cleared game {game_number} scores for tournament {tournament_id}, squad {squad_id} ({len(scores)} records)")
    return {"message": f"Cleared game {game_number} scores for {len(scores)} player(s)"}