from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.api.deps import get_current_user, get_db
from app.core.models import Score, Bowler, Tournament, Squad

router = APIRouter()

class ScoreCreate(BaseModel):
    bowler_id: int
    tournament_id: int
    squad_id: int
    game1_scratch: Optional[int] = None
    game1_total: Optional[int] = None
    game2_scratch: Optional[int] = None
    game2_total: Optional[int] = None
    game3_scratch: Optional[int] = None
    game3_total: Optional[int] = None

class ScoreUpdate(BaseModel):
    game1_scratch: Optional[int] = None
    game1_total: Optional[int] = None
    game2_scratch: Optional[int] = None
    game2_total: Optional[int] = None
    game3_scratch: Optional[int] = None
    game3_total: Optional[int] = None

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
    
    # Check if score already exists for this bowler/tournament/squad
    existing_score = db.query(Score).filter(
        Score.bowler_id == score_data.bowler_id,
        Score.tournament_id == score_data.tournament_id,
        Score.squad_id == score_data.squad_id
    ).first()
    
    if existing_score:
        # Update existing score
        for field, value in score_data.model_dump(exclude_unset=True).items():
            setattr(existing_score, field, value)
        db.commit()
        db.refresh(existing_score)
        return existing_score
    else:
        # Create new score
        new_score = Score(**score_data.model_dump())
        db.add(new_score)
        db.commit()
        db.refresh(new_score)
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
    
    # Update only provided fields
    for field, value in score_data.model_dump(exclude_unset=True).items():
        setattr(score, field, value)
    
    db.commit()
    db.refresh(score)
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