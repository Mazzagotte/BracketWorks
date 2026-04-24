
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
    update_match_score,
    validate_all_brackets
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
def generate_tournament_brackets_endpoint(
    tournament_id: int,
    squad_id: Optional[int] = None,
    force_regenerate: bool = Query(False, description="Force regeneration even if brackets exist"),
    db: Session = Depends(get_db)
):
    """Generate multiple brackets for a tournament based on player entries and scores"""
    try:
        # Validate tournament_id
        tournament_id = BracketValidation.validate_tournament_id(tournament_id)
        
        # Check database for existing brackets (skip cache to always get fresh scores)
        cache_key = f"brackets_{tournament_id}_{squad_id}"
        if not force_regenerate:
            # Check database - always refresh scores from score table
            if brackets_exist_simple(db, tournament_id, squad_id):
                # Load with refresh_scores=True to get current scores
                existing_brackets = load_brackets_simple(db, tournament_id, squad_id, refresh_scores=True)
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
                        # DON'T cache - we want fresh scores every time
                        logger.info(f"Loaded brackets with refreshed scores for tournament {tournament_id}")
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

        # Enforce supported bracket sizes for three-game sets
        try:
            BracketValidation.validate_bracket_size(bracket_settings.bracket_size)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        # Get bowlers for this tournament/squad
        bowlers_query = db.query(models.Bowler).filter(models.Bowler.tournament_id == tournament_id)
        if squad_id:
            bowlers_query = bowlers_query.filter(models.Bowler.squad_id == squad_id)
        
        bowlers = bowlers_query.all()
        
        if not bowlers:
            raise HTTPException(status_code=404, detail="No players found for this tournament/squad")
        
        # Get scores for these bowlers — single query, build lookup map
        players_data = []

        logger.info(f"Fetching scores for {len(bowlers)} bowlers")

        scores_query = db.query(models.Score).filter(
            models.Score.tournament_id == tournament_id
        )
        if squad_id:
            scores_query = scores_query.filter(models.Score.squad_id == squad_id)
        scores_map = {s.bowler_id: s for s in scores_query.all()}

        for bowler in bowlers:
            score_record = scores_map.get(bowler.id)

            logger.debug(f"Player: {bowler.name} (ID: {bowler.id})")
            if score_record:
                logger.debug(f"  Scores found: G1={score_record.game1_total}, G2={score_record.game2_total}, G3={score_record.game3_total}")
            else:
                logger.debug(f"  No scores found")
            
            # Split name into first and last name
            name_parts = bowler.name.split(' ', 1)
            first_name = name_parts[0] if len(name_parts) > 0 else ''
            last_name = name_parts[1] if len(name_parts) > 1 else ''
            
            # Create scores dictionary - matches Score table field names
            scores_dict = {
                'game1_scratch': score_record.game1_scratch if score_record else None,
                'game1_total': score_record.game1_total if score_record else None,
                'game2_scratch': score_record.game2_scratch if score_record else None,
                'game2_total': score_record.game2_total if score_record else None,
                'game3_scratch': score_record.game3_scratch if score_record else None,
                'game3_total': score_record.game3_total if score_record else None,
            } if score_record else {}
            
            logger.debug(f"  Scores dictionary: {scores_dict}")
            
            player_data = {
                'id': bowler.id,
                'firstName': first_name,
                'lastName': last_name,
                'average': bowler.average or 0,
                'handicap': bowler.handicap_entries or 0,
                'scratch': bowler.scratch_entries or 0,
                'scores': scores_dict
            }
            players_data.append(player_data)
        
        # Generate brackets with validation
        brackets_result = generate_tournament_brackets(
            players=players_data,
            bracket_size=bracket_settings.bracket_size,
            db=db,
            tournament_id=tournament_id,
            use_history=True,  # Enable advanced algorithm with history
            seed=None  # Can be configurable later
        )
        
        # Validate bracket structure before saving
        validation_result = validate_all_brackets(brackets_result)
        
        # Log validation warnings if any
        if validation_result['warnings']:
            for warning in validation_result['warnings']:
                logger.warning(f"Bracket validation warning: {warning}")
        
        # If validation errors exist, raise an exception
        if not validation_result['is_valid']:
            error_message = "Bracket validation failed: " + "; ".join(validation_result['errors'])
            logger.error(error_message)
            raise HTTPException(status_code=500, detail=error_message)
        
        # Save the generated brackets to database
        try:
            save_brackets_simple(db, tournament_id, squad_id, brackets_result)
            logger.info(f"Successfully saved brackets for tournament {tournament_id}, squad {squad_id}")
        except Exception as save_error:
            # Log the save error but don't fail the generation
            logger.error(f"Failed to save brackets to database: {save_error}")
            raise HTTPException(status_code=500, detail=f"Failed to save brackets: {str(save_error)}")
        
        # Prepare result with validation info
        result = {
            "tournament_id": tournament_id,
            "tournament_name": tournament.name,
            "bracket_size": bracket_settings.bracket_size,
            "squad_id": squad_id,
            "generated_new": True,
            **brackets_result,
            "validation_result": validation_result  # Include validation info in response
        }
        
        # Cache the result after successful generation and save
        bracket_cache.set(cache_key, result)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating brackets: {str(e)}")

@router.get("/load/{tournament_id}")
def load_tournament_brackets(
    tournament_id: int,
    squad_id: Optional[int] = None,
    refresh_scores: bool = Query(True, description="Refresh scores from database"),
    db: Session = Depends(get_db)
):
    """Load existing brackets for a tournament/squad from database with fresh scores"""
    try:
        tournament = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
        if not tournament:
            raise HTTPException(status_code=404, detail="Tournament not found")
        
        # Load brackets with score refresh enabled by default
        brackets_data = load_brackets_simple(db, tournament_id, squad_id, refresh_scores=refresh_scores)
        if not brackets_data:
            raise HTTPException(status_code=404, detail="No brackets found for this tournament/squad")
        
        logger.info(f"Loaded brackets for tournament {tournament_id} with refresh_scores={refresh_scores}")
        
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
