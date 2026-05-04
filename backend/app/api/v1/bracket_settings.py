from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from app.api.deps import get_db, get_current_user
from app.core import models, schemas
from app.core.bracket_programs import normalize_bowler_bracket_entries, normalize_bracket_programs
from typing import Optional
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


def _find_disabled_program_keys(
    existing_programs: list[dict] | None,
    incoming_programs: list[dict] | None,
    existing_default_entry_fee: float | None,
    incoming_default_entry_fee: float | None,
) -> set[str]:
    """Return program keys that transitioned from enabled to disabled."""
    if incoming_programs is None:
        return set()

    normalized_existing = normalize_bracket_programs(
        existing_programs,
        default_entry_fee=existing_default_entry_fee,
    )
    normalized_incoming = normalize_bracket_programs(
        incoming_programs,
        default_entry_fee=incoming_default_entry_fee,
    )

    existing_enabled = {
        program["key"] for program in normalized_existing if bool(program.get("enabled"))
    }
    incoming_enabled = {
        program["key"] for program in normalized_incoming if bool(program.get("enabled"))
    }

    return existing_enabled - incoming_enabled


def _delete_disabled_program_entries(
    db: Session,
    tournament_id: int,
    disabled_program_keys: set[str],
) -> int:
    """Remove disabled program entries from tournament players' JSON counts."""
    if not disabled_program_keys:
        return 0

    players = db.query(models.TournamentPlayer).filter(
        models.TournamentPlayer.tournament_id == tournament_id
    ).all()

    updated_players = 0
    for player in players:
        normalized_entries = normalize_bowler_bracket_entries(player.program_entry_counts)
        if not normalized_entries:
            continue

        next_entries = {
            key: value
            for key, value in normalized_entries.items()
            if key not in disabled_program_keys
        }

        if next_entries == normalized_entries:
            continue

        player.program_entry_counts = next_entries or None
        flag_modified(player, 'program_entry_counts')
        updated_players += 1

    if updated_players:
        logger.info(
            "Removed disabled bracket program entries",
            extra={
                "tournament_id": tournament_id,
                "disabled_program_keys": sorted(disabled_program_keys),
                "updated_players": updated_players,
            },
        )

    return updated_players


def validate_prize_distribution(
    bracket_size: Optional[int],
    default_entry_fee: Optional[float],
    first_place_amount: Optional[float],
    second_place_amount: Optional[float],
    house_fee_amount: Optional[float]
) -> None:
    """Validate that prize distribution matches bracket_size * default_entry_fee."""
    size = float(bracket_size or 0)
    cost = float(default_entry_fee or 0)
    first = float(first_place_amount or 0)
    second = float(second_place_amount or 0)
    house = float(house_fee_amount or 0)

    expected_total = size * cost
    actual_total = first + second + house

    if abs(actual_total - expected_total) > 0.009:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid prize distribution: first_place_amount + second_place_amount + house_fee_amount "
                f"must equal bracket_size * default_entry_fee ({expected_total:.2f}). "
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
        players = db.query(models.TournamentPlayer).filter(
            models.TournamentPlayer.tournament_id == tournament_id
        ).all()
        
        updated_count = 0
        for player in players:
            if player.average is not None:
                # Calculate handicap: (base - average) * (percentage / 100)
                new_handicap = int((handicap_base - player.average) * (handicap_percentage / 100))
                # Ensure handicap is not negative
                new_handicap = max(0, new_handicap)
                
                if player.handicap_pins != new_handicap:
                    player.handicap_pins = new_handicap
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
    bracket_settings: schemas.TournamentBracketSettingsCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Create or update bracket settings for a tournament."""
    try:
        # Serialize incoming data to plain dicts once so nested Pydantic objects
        # (e.g. BracketProgramDefinition) are plain dicts before being passed to
        # helpers that call program.get("key") — Pydantic v2 models don't support .get().
        settings_data = bracket_settings.model_dump()

        # Check if bracket settings already exist for this tournament
        existing_settings = db.query(models.BracketSettings).filter(
            models.BracketSettings.tournament_id == bracket_settings.tournament_id
        ).first()

        if existing_settings:
            disabled_program_keys = _find_disabled_program_keys(
                existing_settings.bracket_programs,
                settings_data.get('bracket_programs'),
                existing_settings.default_entry_fee,
                bracket_settings.default_entry_fee,
            )

            # Update existing settings
            for field, value in settings_data.items():
                if value is not None:
                    setattr(existing_settings, field, value)

            _delete_disabled_program_entries(
                db,
                existing_settings.tournament_id,
                disabled_program_keys,
            )

            validate_prize_distribution(
                existing_settings.bracket_size,
                existing_settings.default_entry_fee,
                existing_settings.first_place_amount,
                existing_settings.second_place_amount,
                existing_settings.house_fee_amount
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
            db_settings = models.TournamentBracketSettings(**bracket_settings.model_dump())

            validate_prize_distribution(
                db_settings.bracket_size,
                db_settings.default_entry_fee,
                db_settings.first_place_amount,
                db_settings.second_place_amount,
                db_settings.house_fee_amount
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
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        logger.exception(
            "Unhandled error in create_bracket_settings",
            extra={
                "tournament_id": bracket_settings.tournament_id,
                "user_id": getattr(current_user, "id", None),
            },
        )
        raise HTTPException(status_code=500, detail="Failed to save bracket settings")

@router.get("/{tournament_id}", response_model=Optional[schemas.BracketSettings])
def get_bracket_settings(
    tournament_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get bracket settings for a tournament."""
    settings = db.query(models.TournamentBracketSettings).filter(
        models.TournamentBracketSettings.tournament_id == tournament_id
    ).first()
    return settings

@router.put("/{settings_id}", response_model=schemas.BracketSettings)
def update_bracket_settings(
    settings_id: int,
    bracket_settings: schemas.TournamentBracketSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update existing bracket settings."""
    try:
        db_settings = db.query(models.TournamentBracketSettings).filter(
            models.TournamentBracketSettings.id == settings_id
        ).first()

        if not db_settings:
            raise HTTPException(status_code=404, detail="Bracket settings not found")

        # Track if handicap settings changed
        handicap_changed = False
        update_data = bracket_settings.model_dump(exclude_unset=True)

        disabled_program_keys = _find_disabled_program_keys(
            db_settings.bracket_programs,
            update_data.get('bracket_programs'),
            db_settings.default_entry_fee,
            update_data.get('default_entry_fee', db_settings.default_entry_fee),
        )

        if 'handicap_percentage' in update_data or 'handicap_base' in update_data:
            handicap_changed = True

        for field, value in update_data.items():
            setattr(db_settings, field, value)

        _delete_disabled_program_entries(
            db,
            db_settings.tournament_id,
            disabled_program_keys,
        )

        validate_prize_distribution(
            db_settings.bracket_size,
            db_settings.default_entry_fee,
            db_settings.first_place_amount,
            db_settings.second_place_amount,
            db_settings.house_fee_amount
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
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        logger.exception(
            "Unhandled error in update_bracket_settings",
            extra={
                "settings_id": settings_id,
                "user_id": getattr(current_user, "id", None),
            },
        )
        raise HTTPException(status_code=500, detail="Failed to update bracket settings")

@router.delete("/{settings_id}")
def delete_bracket_settings(
    settings_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Delete bracket settings."""
    db_settings = db.query(models.TournamentBracketSettings).filter(
        models.TournamentBracketSettings.id == settings_id
    ).first()
    
    if not db_settings:
        raise HTTPException(status_code=404, detail="Bracket settings not found")
    
    db.delete(db_settings)
    db.commit()
    return {"message": "Bracket settings deleted successfully"}