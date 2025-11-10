from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import logging

from app.api.deps import get_current_user, get_db
from app.core.models import Score, Bowler, Tournament, Squad, BracketSettings

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

class ScoreCreate(BaseModel):
    bowler_id: int
    tournament_id: int
    squad_id: int
    game1_scratch: Optional[int] = None
    game2_scratch: Optional[int] = None
    game3_scratch: Optional[int] = None
    # Note: game totals are calculated automatically by backend (scratch + handicap)

class ScoreUpdate(BaseModel):
    game1_scratch: Optional[int] = None
    game2_scratch: Optional[int] = None
    game3_scratch: Optional[int] = None
    # Note: game totals are calculated automatically by backend (scratch + handicap)

class ScoreResponse(BaseModel):
    id: int
    bowler_id: int
    tournament_id: int
    squad_id: int
    game1_scratch: Optional[int] = None
    game1_total: Optional[int] = None
    game2_scratch: Optional[int] = None
    game2_total: Optional[int] = None
    game3_scratch: Optional[int] = None
    game3_total: Optional[int] = None

    class Config:
        from_attributes = True

@router.get("/", response_model=List[ScoreResponse])
def get_scores(
    tournament_id: Optional[int] = None,
    squad_id: Optional[int] = None,
    bowler_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get scores with optional filtering"""
    query = db.query(Score)
    
    if tournament_id:
        query = query.filter(Score.tournament_id == tournament_id)
    if squad_id:
        query = query.filter(Score.squad_id == squad_id)
    if bowler_id:
        query = query.filter(Score.bowler_id == bowler_id)
    
    scores = query.all()
    return scores

@router.post("/", response_model=ScoreResponse)
def create_or_update_score(
    score_data: ScoreCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create or update a score for a bowler"""
    
    # Get bowler information
    bowler = db.query(Bowler).filter(Bowler.id == score_data.bowler_id).first()
    if not bowler:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bowler not found"
        )
    
    # Get bracket settings for tournament
    settings = db.query(BracketSettings).filter(
        BracketSettings.tournament_id == score_data.tournament_id
    ).first()
    
    # Use default values if settings not found
    handicap_base = settings.handicap_base if settings else 200.0
    handicap_percentage = settings.handicap_percentage if settings else 80.0
    
    # Calculate handicap
    handicap = calculate_handicap(bowler.average, handicap_base, handicap_percentage)
    logger.info(f"Calculating handicap for bowler {bowler.name} (avg={bowler.average}): {handicap}")
    
    # Calculate totals from scratch scores + handicap
    score_dict = score_data.model_dump(exclude_unset=True)
    
    if score_data.game1_scratch is not None:
        score_dict['game1_total'] = score_data.game1_scratch + handicap
    if score_data.game2_scratch is not None:
        score_dict['game2_total'] = score_data.game2_scratch + handicap
    if score_data.game3_scratch is not None:
        score_dict['game3_total'] = score_data.game3_scratch + handicap
    
    # Check if score already exists for this bowler/tournament/squad
    existing_score = db.query(Score).filter(
        Score.bowler_id == score_data.bowler_id,
        Score.tournament_id == score_data.tournament_id,
        Score.squad_id == score_data.squad_id
    ).first()
    
    if existing_score:
        # Update existing score
        for field, value in score_dict.items():
            setattr(existing_score, field, value)
        db.commit()
        db.refresh(existing_score)
        logger.info(f"Updated score for bowler {bowler.name}: G1={existing_score.game1_total}, G2={existing_score.game2_total}, G3={existing_score.game3_total}")
        return existing_score
    else:
        # Create new score
        new_score = Score(**score_dict)
        db.add(new_score)
        db.commit()
        db.refresh(new_score)
        logger.info(f"Created new score for bowler {bowler.name}: G1={new_score.game1_total}, G2={new_score.game2_total}, G3={new_score.game3_total}")
        return new_score

@router.put("/{score_id}", response_model=ScoreResponse)
def update_score(
    score_id: int,
    score_data: ScoreUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update specific score by ID"""
    
    score = db.query(Score).filter(Score.id == score_id).first()
    if not score:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Score not found"
        )
    
    # Get bowler information
    bowler = db.query(Bowler).filter(Bowler.id == score.bowler_id).first()
    if not bowler:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bowler not found"
        )
    
    # Get bracket settings for tournament
    settings = db.query(BracketSettings).filter(
        BracketSettings.tournament_id == score.tournament_id
    ).first()
    
    # Use default values if settings not found
    handicap_base = settings.handicap_base if settings else 200.0
    handicap_percentage = settings.handicap_percentage if settings else 80.0
    
    # Calculate handicap
    handicap = calculate_handicap(bowler.average, handicap_base, handicap_percentage)
    logger.info(f"Calculating handicap for bowler {bowler.name} (avg={bowler.average}): {handicap}")
    
    # Calculate totals from scratch scores + handicap
    score_dict = score_data.model_dump(exclude_unset=True)
    
    if score_data.game1_scratch is not None:
        score_dict['game1_total'] = score_data.game1_scratch + handicap
    if score_data.game2_scratch is not None:
        score_dict['game2_total'] = score_data.game2_scratch + handicap
    if score_data.game3_scratch is not None:
        score_dict['game3_total'] = score_data.game3_scratch + handicap
    
    # Update only provided fields
    for field, value in score_dict.items():
        setattr(score, field, value)
    
    db.commit()
    db.refresh(score)
    logger.info(f"Updated score for bowler {bowler.name}: G1={score.game1_total}, G2={score.game2_total}, G3={score.game3_total}")
    return score

@router.delete("/{score_id}")
def delete_score(
    score_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete a score"""
    
    score = db.query(Score).filter(Score.id == score_id).first()
    if not score:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Score not found"
        )
    
    db.delete(score)
    db.commit()
    return {"message": "Score deleted successfully"}