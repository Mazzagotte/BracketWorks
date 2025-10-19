
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import logging

from ..deps import get_db
from ...core import models, schemas
from ...core.cache import bracket_cache
from ...core.validators import BracketValidation
from ...core.errors import handle_error, NotFoundError, ValidationError
from ...services.brackets_simple import (
    generate_bracket_preview, 
    generate_tournament_brackets, 
    update_match_score
)
from ...services.bracket_persistence_simple import (
    save_brackets_simple, 
    load_brackets_simple, 
    delete_brackets_simple,
    brackets_exist_simple,
    update_match_score_simple
)

logger = logging.getLogger(__name__)

router = APIRouter()

class MatchScoreUpdate(BaseModel):
    bracket_id: str  # Format: "scratch_1" or "handicap_2" 
    round_index: int
    match_index: int
    score_a: int
    score_b: int
    
    def __init__(self, **data):
        # Validate scores
        if 'score_a' in data:
            data['score_a'] = BracketValidation.validate_score(data['score_a'])
        if 'score_b' in data:
            data['score_b'] = BracketValidation.validate_score(data['score_b'])
        super().__init__(**data)

@router.get("")
def list_brackets(db: Session = Depends(get_db)):
    return db.query(models.Bracket).order_by(models.Bracket.id.desc()).all()

@router.post("")
def create_bracket(bracket: schemas.BracketCreate, db: Session = Depends(get_db)):
    obj = models.Bracket(name=bracket.name, squad=bracket.squad, game_count=bracket.game_count)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

@router.get("/preview")
def preview(bracket_size: int = 8):
    """Generate a single bracket preview"""
    try:
        return generate_bracket_preview(bracket_size)
    except ValueError as e:
        raise handle_error(ValidationError(str(e)))
    except Exception as e:
        raise handle_error(e)

@router.post("/update-match-score")
def update_match_score_endpoint(
    score_update: MatchScoreUpdate,
    tournament_id: int,
    squad_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Update match score and auto-advance winner to next round"""
    try:
        # Get the current tournament brackets
        brackets_data = load_brackets_simple(db, tournament_id, squad_id)
        if not brackets_data:
            raise HTTPException(status_code=404, detail="No brackets found for this tournament")
        
        # Update the specific match and auto-advance
        updated_result = update_match_score(
            brackets_data, 
            score_update.bracket_id,
            score_update.round_index,
            score_update.match_index,
            score_update.score_a,
            score_update.score_b
        )
        
        # Save the updated bracket state back to database
        try:
            save_brackets_simple(db, tournament_id, squad_id, updated_result)
            logger.info(f"Updated match score and saved brackets for tournament {tournament_id}")
        except Exception as save_error:
            logger.error(f"Failed to save updated brackets: {save_error}")
            raise HTTPException(status_code=500, detail="Failed to save bracket updates")
        
        return updated_result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating match score: {e}")
        raise HTTPException(status_code=500, detail=f"Error updating match score: {str(e)}")

@router.get("/generate-multiple")
def generate_tournament_brackets(
    tournament_id: int,
    squad_id: Optional[int] = None,
    force_regenerate: bool = Query(False, description="Force regeneration even if brackets exist"),
    db: Session = Depends(get_db)
):
    """Generate multiple brackets for a tournament based on player entries and scores"""
    try:
        # Validate tournament_id
        tournament_id = BracketValidation.validate_tournament_id(tournament_id)
        
        # Check cache first (if not forcing regeneration)
        cache_key = f"brackets_{tournament_id}_{squad_id}"
        if not force_regenerate:
            cached_data = bracket_cache.get(cache_key)
            if cached_data:
                logger.info(f"Returning cached brackets for tournament {tournament_id}")
                return cached_data
            
            # Check database
            if brackets_exist_simple(db, tournament_id, squad_id):
                existing_brackets = load_brackets_simple(db, tournament_id, squad_id)
                if existing_brackets:
                    tournament = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
                    if tournament:
                        result = {
                            "tournament_id": tournament_id,
                            "tournament_name": tournament.name,
                            "bracket_size": existing_brackets.get('bracket_size', 8),
                            "squad_id": squad_id,
                            "loaded_from_database": True,
                            **existing_brackets
                        }
                        # Cache the result
                        bracket_cache.set(cache_key, result)
                        return result
        
        # Generate new brackets (either no existing brackets or forced regeneration)
        tournament = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
        if not tournament:
            raise HTTPException(status_code=404, detail="Tournament not found")
        
        # Get bracket settings for the tournament
        bracket_settings = db.query(models.BracketSettings).filter(
            models.BracketSettings.tournament_id == tournament_id
        ).first()
        
        if not bracket_settings or not bracket_settings.bracket_size:
            raise HTTPException(
                status_code=400, 
                detail="Tournament bracket size not configured. Please set bracket size in tournament settings."
            )
        
        # Get bowlers for this tournament/squad
        bowlers_query = db.query(models.Bowler).filter(models.Bowler.tournament_id == tournament_id)
        if squad_id:
            bowlers_query = bowlers_query.filter(models.Bowler.squad_id == squad_id)
        
        bowlers = bowlers_query.all()
        
        if not bowlers:
            raise HTTPException(status_code=404, detail="No players found for this tournament/squad")
        
        # Get scores for these bowlers
        players_data = []
        for bowler in bowlers:
            # Get scores for this bowler
            scores = db.query(models.Score).filter(
                models.Score.bowler_id == bowler.id,
                models.Score.tournament_id == tournament_id
            )
            if squad_id:
                scores = scores.filter(models.Score.squad_id == squad_id)
            
            score_record = scores.first()
            
            # Split name into first and last name
            name_parts = bowler.name.split(' ', 1)
            first_name = name_parts[0] if len(name_parts) > 0 else ''
            last_name = name_parts[1] if len(name_parts) > 1 else ''
            
            player_data = {
                'id': bowler.id,
                'firstName': first_name,
                'lastName': last_name,
                'average': bowler.average or 0,
                'handicap': bowler.handicap or 0,  # Number of handicap brackets
                'scratch': bowler.scratch or 0,    # Number of scratch brackets
                'scores': {
                    'game1_scratch': score_record.game1_scratch if score_record else None,
                    'game1_total': score_record.game1_total if score_record else None,
                    'game2_scratch': score_record.game2_scratch if score_record else None,
                    'game2_total': score_record.game2_total if score_record else None,
                    'game3_scratch': score_record.game3_scratch if score_record else None,
                    'game3_total': score_record.game3_total if score_record else None,
                } if score_record else {}
            }
            players_data.append(player_data)
        
        # Generate brackets
        brackets_result = generate_tournament_brackets(players_data, bracket_settings.bracket_size)
        
        # Save the generated brackets to database
        try:
            save_brackets_simple(db, tournament_id, squad_id, brackets_result)
        except Exception as save_error:
            # Log the save error but don't fail the generation
            logger.warning(f"Failed to save brackets to database: {save_error}")
        
        # Prepare result
        result = {
            "tournament_id": tournament_id,
            "tournament_name": tournament.name,
            "bracket_size": bracket_settings.bracket_size,
            "squad_id": squad_id,
            "generated_new": True,
            **brackets_result
        }
        
        # Cache the result after successful generation and save
        bracket_cache.set(cache_key, result)
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating brackets: {str(e)}")

@router.get("/load/{tournament_id}")
def load_tournament_brackets(
    tournament_id: int,
    squad_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Load existing brackets for a tournament/squad from database"""
    try:
        tournament = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
        if not tournament:
            raise HTTPException(status_code=404, detail="Tournament not found")
        
        brackets_data = load_brackets_simple(db, tournament_id, squad_id)
        if not brackets_data:
            raise HTTPException(status_code=404, detail="No brackets found for this tournament/squad")
        
        return {
            "tournament_id": tournament_id,
            "tournament_name": tournament.name,
            "squad_id": squad_id,
            "bracket_size": brackets_data.get('bracket_size', 8),
            **brackets_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading brackets: {str(e)}")

@router.delete("/delete/{tournament_id}")
def delete_tournament_brackets(
    tournament_id: int,
    squad_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Delete existing brackets for a tournament/squad"""
    try:
        tournament = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
        if not tournament:
            raise HTTPException(status_code=404, detail="Tournament not found")
        
        if not brackets_exist_simple(db, tournament_id, squad_id):
            raise HTTPException(status_code=404, detail="No brackets found to delete")
        
        delete_brackets_simple(db, tournament_id, squad_id)
        
        return {"message": "Brackets deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting brackets: {str(e)}")

@router.get("/exists/{tournament_id}")
def check_brackets_exist(
    tournament_id: int,
    squad_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Check if brackets exist for a tournament/squad"""
    try:
        exists = brackets_exist_simple(db, tournament_id, squad_id)
        return {"exists": exists}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking brackets: {str(e)}")
