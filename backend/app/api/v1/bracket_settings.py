from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.core import models, schemas
from typing import Optional
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


def validate_prize_distribution(
    bracket_size: Optional[int],
    cost_per_bracket: Optional[float],
    first_place: Optional[float],
    second_place: Optional[float],
    house_amount: Optional[float]
) -> None:
    """Validate that 1st + 2nd + house equals bracket_size * cost_per_bracket."""
    size = float(bracket_size or 0)
    cost = float(cost_per_bracket or 0)
    first = float(first_place or 0)
    second = float(second_place or 0)
    house = float(house_amount or 0)

    expected_total = size * cost
    actual_total = first + second + house

    if abs(actual_total - expected_total) > 0.009:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid prize distribution: first_place + second_place + house_amount "
                f"must equal bracket_size * cost_per_bracket ({expected_total:.2f}). "
                f"Current total: {actual_total:.2f}."
            )
        )

def recalculate_player_handicaps(
    db: Session, 
    tournament_id: int, 
    handicap_percentage: float, 
    handicap_base: float
):
    """Recalculate handicaps for all players in a tournament based on new settings."""
    try:
        # Get all bowlers for this tournament
        bowlers = db.query(models.Bowler).filter(
            models.Bowler.tournament_id == tournament_id
        ).all()
        
        updated_count = 0
        for bowler in bowlers:
            if bowler.average is not None:
                # Calculate handicap: (base - average) * (percentage / 100)
                new_handicap = int((handicap_base - bowler.average) * (handicap_percentage / 100))
                # Ensure handicap is not negative
                new_handicap = max(0, new_handicap)
                
                if bowler.handicap != new_handicap:
                    bowler.handicap = new_handicap
                    updated_count += 1
        
        if updated_count > 0:
            db.commit()
            logger.info(f"Recalculated handicaps for {updated_count} players in tournament {tournament_id}")
        
        return updated_count
    except Exception as e:
        logger.error(f"Error recalculating handicaps: {e}")
        db.rollback()
        raise

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

        validate_prize_distribution(
            existing_settings.bracket_size,
            existing_settings.cost_per_bracket,
            existing_settings.first_place,
            existing_settings.second_place,
            existing_settings.house_amount
        )

        db.commit()
        db.refresh(existing_settings)
        
        # Recalculate player handicaps if handicap settings changed
        if bracket_settings.handicap_percentage is not None or bracket_settings.handicap_base is not None:
            try:
                updated_count = recalculate_player_handicaps(
                    db, 
                    existing_settings.tournament_id,
                    existing_settings.handicap_percentage or 80.0,
                    existing_settings.handicap_base or 200.0
                )
                logger.info(f"Updated {updated_count} player handicaps for tournament {existing_settings.tournament_id}")
            except Exception as e:
                logger.error(f"Failed to recalculate handicaps: {e}")
        
        return existing_settings
    else:
        # Create new settings
        db_settings = models.BracketSettings(**bracket_settings.model_dump())

        validate_prize_distribution(
            db_settings.bracket_size,
            db_settings.cost_per_bracket,
            db_settings.first_place,
            db_settings.second_place,
            db_settings.house_amount
        )

        db.add(db_settings)
        db.commit()
        db.refresh(db_settings)
        
        # Recalculate player handicaps for new settings
        try:
            updated_count = recalculate_player_handicaps(
                db,
                db_settings.tournament_id,
                db_settings.handicap_percentage or 80.0,
                db_settings.handicap_base or 200.0
            )
            logger.info(f"Calculated handicaps for {updated_count} players in tournament {db_settings.tournament_id}")
        except Exception as e:
            logger.error(f"Failed to calculate handicaps: {e}")
        
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
    
    # Track if handicap settings changed
    handicap_changed = False
    update_data = bracket_settings.model_dump(exclude_unset=True)
    
    if 'handicap_percentage' in update_data or 'handicap_base' in update_data:
        handicap_changed = True
    
    for field, value in update_data.items():
        setattr(db_settings, field, value)

    validate_prize_distribution(
        db_settings.bracket_size,
        db_settings.cost_per_bracket,
        db_settings.first_place,
        db_settings.second_place,
        db_settings.house_amount
    )
    
    db.commit()
    db.refresh(db_settings)
    
    # Recalculate player handicaps if handicap settings changed
    if handicap_changed:
        try:
            updated_count = recalculate_player_handicaps(
                db,
                db_settings.tournament_id,
                db_settings.handicap_percentage or 80.0,
                db_settings.handicap_base or 200.0
            )
            logger.info(f"Updated {updated_count} player handicaps for tournament {db_settings.tournament_id}")
        except Exception as e:
            logger.error(f"Failed to recalculate handicaps: {e}")
    
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