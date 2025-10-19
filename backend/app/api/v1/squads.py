from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ...core import models, schemas
from ...api import deps

router = APIRouter()

@router.post("/select/", response_model=schemas.SelectedSquadOut)
def select_squad(data: schemas.SelectedSquadCreate, db: Session = Depends(deps.get_db)):
    # Remove any previous selection for this user
    db.query(models.SelectedSquad).filter(models.SelectedSquad.user_id == data.user_id).delete()
    obj = models.SelectedSquad(user_id=data.user_id, squad_id=data.squad_id)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

@router.get("/selected/", response_model=schemas.SelectedSquadOut)
def get_selected_squad(user_id: int, db: Session = Depends(deps.get_db)):
    obj = db.query(models.SelectedSquad).filter(models.SelectedSquad.user_id == user_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="No selected squad for user")
    return obj

@router.delete("/select/")
def clear_selected_squad(data: schemas.SelectedSquadDelete, db: Session = Depends(deps.get_db)):
    """Clear the selected squad for a user"""
    deleted_count = db.query(models.SelectedSquad).filter(models.SelectedSquad.user_id == data.user_id).delete()
    db.commit()
    return {"message": f"Cleared selected squad for user {data.user_id}", "cleared": deleted_count > 0}

@router.post("/", response_model=schemas.Squad)
def create_squad(squad: schemas.SquadCreate, db: Session = Depends(deps.get_db)):
    # Check for existing squad with same tournament_id, date, and time
    existing = db.query(models.Squad).filter(
        models.Squad.tournament_id == squad.tournament_id,
        models.Squad.date == squad.date,
        models.Squad.time == squad.time
    ).first()
    if existing:
        # Return existing squad instead of creating duplicate
        return {
            'id': existing.id,
            'tournament_id': existing.tournament_id,
            'date': str(existing.date),
            'time': existing.time
        }
    obj = models.Squad(
        tournament_id=squad.tournament_id,
        date=squad.date,
        time=squad.time
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    # Serialize date as string
    return {
        'id': obj.id,
        'tournament_id': obj.tournament_id,
        'date': str(obj.date),
        'time': obj.time
    }

@router.get("/", response_model=list[schemas.Squad])
def list_squads(tournament_id: int, db: Session = Depends(deps.get_db)):
    squads = db.query(models.Squad).filter(models.Squad.tournament_id == tournament_id).all()
    return [
        {
            'id': s.id,
            'tournament_id': s.tournament_id,
            'date': str(s.date),
            'time': s.time
        }
        for s in squads
    ]

@router.get("/{squad_id}", response_model=schemas.Squad)
def get_squad(squad_id: int, db: Session = Depends(deps.get_db)):
    obj = db.query(models.Squad).filter(models.Squad.id == squad_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Squad not found")
    return {
        'id': obj.id,
        'tournament_id': obj.tournament_id,
        'date': str(obj.date),
        'time': obj.time
    }

@router.delete("/tournament/{tournament_id}")
def delete_tournament_squads(tournament_id: int, db: Session = Depends(deps.get_db)):
    """Delete all squad times for a specific tournament"""
    # Check if tournament exists (optional validation)
    tournament = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    # Get all squad IDs for this tournament before deleting them
    squad_ids = db.query(models.Squad.id).filter(models.Squad.tournament_id == tournament_id).all()
    squad_ids = [squad_id[0] for squad_id in squad_ids]
    
    # Delete any selected squad records that point to squads we're about to delete
    selected_squad_cleanup_count = 0
    if squad_ids:
        selected_squad_cleanup_count = db.query(models.SelectedSquad).filter(
            models.SelectedSquad.squad_id.in_(squad_ids)
        ).delete(synchronize_session=False)
    
    # Delete all squads for this tournament
    deleted_count = db.query(models.Squad).filter(models.Squad.tournament_id == tournament_id).delete()
    db.commit()
    
    return {
        "message": f"Deleted {deleted_count} squad(s) for tournament {tournament_id}",
        "deleted_count": deleted_count,
        "selected_squad_cleanup_count": selected_squad_cleanup_count
    }

@router.delete("/{squad_id}")
def delete_squad(squad_id: int, db: Session = Depends(deps.get_db)):
    """Delete a specific squad by ID"""
    obj = db.query(models.Squad).filter(models.Squad.id == squad_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Squad not found")
    
    # Clean up any selected squad records that point to this squad
    selected_squad_cleanup_count = db.query(models.SelectedSquad).filter(
        models.SelectedSquad.squad_id == squad_id
    ).delete()
    
    db.delete(obj)
    db.commit()
    
    return {
        "message": f"Squad {squad_id} deleted successfully",
        "selected_squad_cleanup_count": selected_squad_cleanup_count
    }


@router.post("/sync/{tournament_id}")
def sync_tournament_squads(tournament_id: int, db: Session = Depends(deps.get_db)):
    """Sync squad records to match the tournament's squad_times data exactly"""
    import json
    from typing import Set, Tuple
    
    # Validate tournament_id
    if tournament_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid tournament ID")
    
    # Get tournament and validate it exists
    tournament = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    # Parse tournament squad_times JSON
    if not tournament.squad_times:
        expected_squads = set()
    else:
        try:
            squad_times_data = json.loads(tournament.squad_times)
            expected_squads: Set[Tuple[str, str]] = set()
            
            # Validate the structure and content
            if not isinstance(squad_times_data, dict):
                raise ValueError("squad_times must be a dictionary")
                
            for date, times in squad_times_data.items():
                if not isinstance(date, str):
                    raise ValueError(f"Date key must be string, got {type(date)}")
                if not isinstance(times, list):
                    raise ValueError(f"Times for date {date} must be a list, got {type(times)}")
                    
                for time in times:
                    if isinstance(time, str) and time.strip():  # Only include non-empty string times
                        expected_squads.add((date, time.strip()))
                        
        except (json.JSONDecodeError, ValueError) as e:
            raise HTTPException(status_code=400, detail=f"Invalid squad_times format: {str(e)}")
    
    # Get current squad records from database
    try:
        current_squads = db.query(models.Squad).filter(models.Squad.tournament_id == tournament_id).all()
        current_squads_set: Set[Tuple[str, str]] = {(squad.date, squad.time) for squad in current_squads}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error retrieving squads: {str(e)}")
    
    # Find squads to create and delete
    squads_to_create = expected_squads - current_squads_set
    squads_to_delete = current_squads_set - expected_squads
    
    created_count = 0
    deleted_count = 0
    selected_squad_cleanup_count = 0
    errors = []
    
    try:
        # Delete orphaned squads
        if squads_to_delete:
            for squad in current_squads:
                if (squad.date, squad.time) in squads_to_delete:
                    try:
                        # Clean up any selected squad records that point to this squad
                        selected_cleanup = db.query(models.SelectedSquad).filter(
                            models.SelectedSquad.squad_id == squad.id
                        ).delete()
                        selected_squad_cleanup_count += selected_cleanup
                        
                        db.delete(squad)
                        deleted_count += 1
                    except Exception as e:
                        errors.append(f"Failed to delete squad ({squad.date}, {squad.time}): {str(e)}")
        
        # Create missing squads
        for date, time in squads_to_create:
            try:
                new_squad = models.Squad(
                    tournament_id=tournament_id,
                    date=date,
                    time=time
                )
                db.add(new_squad)
                created_count += 1
            except Exception as e:
                errors.append(f"Failed to create squad ({date}, {time}): {str(e)}")
        
        db.commit()
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction failed: {str(e)}")
    
    response_data = {
        "message": f"Squad sync completed for tournament {tournament_id}",
        "tournament_id": tournament_id,
        "created_count": created_count,
        "deleted_count": deleted_count,
        "selected_squad_cleanup_count": selected_squad_cleanup_count,
        "expected_squads": list(expected_squads),
        "current_squads_before": list(current_squads_set)
    }
    
    if errors:
        response_data["errors"] = errors
        response_data["message"] += f" (with {len(errors)} errors)"
    
    return response_data
