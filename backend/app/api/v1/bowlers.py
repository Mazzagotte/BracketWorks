

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import update as sa_update
from typing import List
from pydantic import BaseModel
from ..deps import get_db, get_current_user
from ...core import models, schemas
from ...core.bracket_programs import calculate_bowler_total_cost, normalize_bowler_bracket_entries, normalize_division

router = APIRouter()


# Returns players with total_cost field, calculated using default_entry_fee from TournamentBracketSettings
@router.get("")
def list_bowlers(
    db: Session = Depends(get_db),
    tournament_id: int = Query(None, description="Tournament ID to filter players and get default_entry_fee"),
    squad_id: int = Query(None, description="Squad ID to filter players by squad"),
    limit: int = Query(200, ge=1, le=500, description="Maximum number of players to return"),
    offset: int = Query(0, ge=0, description="Number of players to skip"),
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

    # Filter by current user (users can only see their own players)
    query = query.filter(models.Bowler.user_id == current_user.id)

    players = query.order_by(models.Bowler.id.desc()).limit(limit).offset(offset).all()
    default_entry_fee = 0
    bracket_programs = None
    if tournament_id:
        settings = db.query(models.BracketSettings).filter(models.BracketSettings.tournament_id == tournament_id).first()
        if settings and settings.cost_per_bracket:
            default_entry_fee = settings.cost_per_bracket
        if settings:
            bracket_programs = settings.bracket_programs
    result = []
    for player in players:
        total_cost = calculate_bowler_total_cost(
            player.bracket_entries,
            bracket_programs,
            default_entry_fee,
            handicap_entries=player.handicap_entries,
            scratch_entries=player.scratch_entries,
        )
        player_dict = {
            "id": player.id,
            "tournament_id": player.tournament_id,
            "squad_id": player.squad_id,
            "user_id": player.user_id,
            "full_name": player.full_name,
            "average": player.average,
            "handicap_pins": player.handicap_pins,
            "handicap_entry_count": player.handicap_entry_count,
            "scratch_entry_count": player.scratch_entry_count,
            "program_entry_counts": normalize_bowler_bracket_entries(
                player.program_entry_counts,
                handicap_entries=player.handicap_entry_count,
                scratch_entries=player.scratch_entry_count,
            ),
            "lane": player.lane,
            "division": normalize_division(player.division),
            "usbc_number": player.usbc_number,
            "amount_paid": player.amount_paid,
            "total_cost": total_cost
        }
        result.append(player_dict)
    return result

@router.post("")
def create_bowler(player: schemas.PlayerCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    obj = models.TournamentPlayer(
        tournament_id=player.tournament_id,
        squad_id=player.squad_id,
        user_id=current_user.id,
        full_name=player.full_name,
        average=player.average,
        handicap_entry_count=player.handicap_entry_count,
        scratch_entry_count=player.scratch_entry_count,
        program_entry_counts=normalize_bowler_bracket_entries(
            player.program_entry_counts,
            handicap_entries=player.handicap_entry_count,
            scratch_entries=player.scratch_entry_count,
        ),
        lane=player.lane,
        division=normalize_division(player.division),
        usbc_number=player.usbc_number,
        amount_paid=player.amount_paid or 0.0
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


class BulkBowlerUpdate(BaseModel):
    id: int
    full_name: str | None = None
    average: int | None = None
    handicap_entry_count: int | None = None
    scratch_entry_count: int | None = None
    program_entry_counts: dict[str, int] | None = None
    lane: str | None = None
    division: str | None = None
    usbc_number: str | None = None
    amount_paid: float | None = None


# Bulk PATCH must be registered before /{bowler_id} to avoid route shadowing
@router.patch("/bulk-update")
def bulk_update_bowlers(
    updates: List[BulkBowlerUpdate],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not updates:
        return {"updated": 0}

    count = 0
    for item in updates:
        data = {k: v for k, v in item.model_dump(exclude_unset=True).items() if k != "id" and v is not None}
        if "division" in data:
            data["division"] = normalize_division(data["division"])
        if not data:
            continue
        db.execute(
            sa_update(models.Bowler)
            .where(models.Bowler.id == item.id, models.Bowler.user_id == current_user.id)
            .values(**data)
            .execution_options(synchronize_session=False)
        )
        count += 1

    db.commit()
    return {"updated": count}


# PATCH endpoint to update bowler fields — single UPDATE statement, no extra SELECT
@router.patch("/{bowler_id}")
def update_bowler(
    bowler_id: int,
    player: schemas.PlayerUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    update_data = {k: v for k, v in player.model_dump(exclude_unset=True).items() if v is not None}
    if "division" in update_data:
        update_data["division"] = normalize_division(update_data["division"])
    if not update_data:
        return {"id": bowler_id}

    result = db.execute(
        sa_update(models.Bowler)
        .where(models.Bowler.id == bowler_id, models.Bowler.user_id == current_user.id)
        .values(**update_data)
    )
    db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Bowler not found or access denied")

    return {"id": bowler_id}

@router.delete("/{bowler_id}")
def delete_bowler(bowler_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    bowler = db.query(models.Bowler).filter(
        models.Bowler.id == bowler_id,
        models.Bowler.user_id == current_user.id
    ).first()
    if not bowler:
        raise HTTPException(status_code=404, detail="Bowler not found or access denied")

    bowler_id = bowler.id
    # Delete FK-dependent records first
    db.query(models.BracketPayout).filter(models.BracketPayout.player_id == bowler_id).delete()
    db.query(models.BracketWinner).filter(models.BracketWinner.player_id == bowler_id).delete()
    db.query(models.PlayerScore).filter(models.PlayerScore.player_id == bowler_id).delete()
    db.query(models.FirstRoundMatchupHistory).filter(
        (models.FirstRoundMatchupHistory.left_player_id == bowler_id) |
        (models.FirstRoundMatchupHistory.right_player_id == bowler_id)
    ).delete(synchronize_session=False)

    db.delete(bowler)
    db.commit()
    return {"message": "Bowler deleted successfully"}
