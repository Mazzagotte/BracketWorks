from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.core import models, schemas
from typing import Optional

router = APIRouter()

@router.post("/", response_model=schemas.BracketSettings)
def create_bracket_settings(
    bracket_settings: schemas.BracketSettingsCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Create or update bracket settings for a tournament."""
    # Check if bracket settings already exist for this tournament
    existing_settings = db.query(models.BracketSettings).filter(
        models.BracketSettings.tournament_id == bracket_settings.tournament_id
    ).first()
    
    if existing_settings:
        # Update existing settings
        for field, value in bracket_settings.model_dump().items():
            if value is not None:
                setattr(existing_settings, field, value)
        db.commit()
        db.refresh(existing_settings)
        return existing_settings
    else:
        # Create new settings
        db_settings = models.BracketSettings(**bracket_settings.model_dump())
        db.add(db_settings)
        db.commit()
        db.refresh(db_settings)
        return db_settings

@router.get("/{tournament_id}", response_model=Optional[schemas.BracketSettings])
def get_bracket_settings(
    tournament_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get bracket settings for a tournament."""
    settings = db.query(models.BracketSettings).filter(
        models.BracketSettings.tournament_id == tournament_id
    ).first()
    return settings

@router.put("/{settings_id}", response_model=schemas.BracketSettings)
def update_bracket_settings(
    settings_id: int,
    bracket_settings: schemas.BracketSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update existing bracket settings."""
    db_settings = db.query(models.BracketSettings).filter(
        models.BracketSettings.id == settings_id
    ).first()
    
    if not db_settings:
        raise HTTPException(status_code=404, detail="Bracket settings not found")
    
    for field, value in bracket_settings.model_dump(exclude_unset=True).items():
        setattr(db_settings, field, value)
    
    db.commit()
    db.refresh(db_settings)
    return db_settings

@router.delete("/{settings_id}")
def delete_bracket_settings(
    settings_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Delete bracket settings."""
    db_settings = db.query(models.BracketSettings).filter(
        models.BracketSettings.id == settings_id
    ).first()
    
    if not db_settings:
        raise HTTPException(status_code=404, detail="Bracket settings not found")
    
    db.delete(db_settings)
    db.commit()
    return {"message": "Bracket settings deleted successfully"}