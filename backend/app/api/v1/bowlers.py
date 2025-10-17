

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..deps import get_db, get_current_user
from ...core import models, schemas

router = APIRouter()


# Returns bowlers with total_cost field, calculated using cost_per_bracket from BracketSettings
@router.get("")
def list_bowlers(
    db: Session = Depends(get_db),
    tournament_id: int = Query(None, description="Tournament ID to filter bowlers and get cost_per_bracket"),
    squad_id: int = Query(None, description="Squad ID to filter bowlers by squad"),
    current_user: models.User = Depends(get_current_user)
):
    # Start with base query
    query = db.query(models.Bowler)
    
    # Filter by tournament if provided
    if tournament_id:
        query = query.filter(models.Bowler.tournament_id == tournament_id)
    
    # Filter by squad if provided
    if squad_id:
        query = query.filter(models.Bowler.squad_id == squad_id)
    
    # Filter by current user (users can only see their own bowlers)
    query = query.filter(models.Bowler.user_id == current_user.id)
    
    bowlers = query.order_by(models.Bowler.id.desc()).all()
    cost_per_bracket = 0
    if tournament_id:
        settings = db.query(models.BracketSettings).filter(models.BracketSettings.tournament_id == tournament_id).first()
        if settings and settings.cost_per_bracket:
            cost_per_bracket = settings.cost_per_bracket
    result = []
    for b in bowlers:
        total_cost = ((b.handicap or 0) + (b.scratch or 0)) * cost_per_bracket
        b_dict = {
            "id": b.id,
            "tournament_id": b.tournament_id,
            "squad_id": b.squad_id,
            "user_id": b.user_id,
            "name": b.name,
            "average": b.average,
            "handicap": b.handicap,
            "scratch": b.scratch,
            "lane": b.lane,
            "division": b.division,
            "usbc": b.usbc,
            "amount_paid": b.amount_paid,
            "total_cost": total_cost
        }
        result.append(b_dict)
    return result

@router.post("")
def create_bowler(bowler: schemas.BowlerCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    obj = models.Bowler(
        tournament_id=bowler.tournament_id,
        squad_id=bowler.squad_id,
        user_id=bowler.user_id,
        name=bowler.name, 
        average=bowler.average,
        handicap=bowler.handicap,
        scratch=bowler.scratch,
        lane=bowler.lane,
        division=bowler.division or 'Open',
        usbc=bowler.usbc,
        amount_paid=bowler.amount_paid or 0.0
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


# PATCH endpoint to update bowler fields
@router.patch("/{bowler_id}")
def update_bowler(
    bowler_id: int, 
    bowler: schemas.BowlerUpdate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_bowler = db.query(models.Bowler).filter(
        models.Bowler.id == bowler_id, 
        models.Bowler.user_id == current_user.id
    ).first()
    if not db_bowler:
        raise HTTPException(status_code=404, detail="Bowler not found or access denied")
    
    # Update fields if provided (only update if not None)
    update_data = bowler.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(db_bowler, field, value)
    
    db.commit()
    db.refresh(db_bowler)
    return db_bowler

@router.delete("/{bowler_id}")
def delete_bowler(bowler_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    bowler = db.query(models.Bowler).filter(
        models.Bowler.id == bowler_id,
        models.Bowler.user_id == current_user.id
    ).first()
    if not bowler:
        raise HTTPException(status_code=404, detail="Bowler not found or access denied")
    
    db.delete(bowler)
    db.commit()
    return {"message": "Bowler deleted successfully"}
