"""
Payout management API endpoints for tournament winner tracking and prize distribution.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
import logging
from datetime import datetime

from ..deps import get_db, get_current_user
from ...core import models
from ...core.schemas import UserOut
from ...services.payouts import (
    calculate_tournament_payouts,
    get_tournament_winners_summary,
    validate_payout_integrity,
    DEFAULT_ENTRY_FEES
)
from ...services.bracket_persistence import load_generated_brackets

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/calculate/{tournament_id}")
def calculate_tournament_payouts_endpoint(
    tournament_id: int,
    squad_id: Optional[int] = None,
    scratch_fee: float = Query(None, description="Entry fee for scratch brackets (overrides tournament settings)"),
    handicap_fee: float = Query(None, description="Entry fee for handicap brackets (overrides tournament settings)"),
    db: Session = Depends(get_db),
    current_user: UserOut = Depends(get_current_user)
):
    """Calculate payouts for all brackets in a tournament"""
    
    try:
        # Verify tournament exists and user has access
        tournament = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
        if not tournament:
            raise HTTPException(status_code=404, detail="Tournament not found")
        
        if tournament.user_id != current_user.id and not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get tournament bracket settings for entry fees
        bracket_settings = db.query(models.BracketSettings).filter(
            models.BracketSettings.tournament_id == tournament_id
        ).first()
        
        # Determine entry fees - use tournament settings or provided values
        if scratch_fee is not None and handicap_fee is not None:
            # Use provided fees (override)
            entry_fees = {"scratch": scratch_fee, "handicap": handicap_fee}
        elif bracket_settings and bracket_settings.cost_per_bracket is not None:
            # Use tournament settings - same cost for both bracket types
            cost_per_bracket = float(bracket_settings.cost_per_bracket)
            entry_fees = {"scratch": cost_per_bracket, "handicap": cost_per_bracket}
        else:
            # Fallback to defaults if no settings found
            entry_fees = {"scratch": scratch_fee or DEFAULT_ENTRY_FEES["scratch"], 
                         "handicap": handicap_fee or DEFAULT_ENTRY_FEES["handicap"]}
        
        # Load bracket data from database
        brackets_data = load_generated_brackets(db, tournament_id, squad_id)
        if not brackets_data:
            raise HTTPException(status_code=404, detail="No brackets found for this tournament")
        
        # Calculate payouts
        payout_data = calculate_tournament_payouts(brackets_data, entry_fees)
        
        # Add tournament info
        payout_data["tournament_info"] = {
            "id": tournament_id,
            "name": tournament.name,
            "squad_id": squad_id,
            "entry_fees": entry_fees
        }
        
        # Validate calculations
        validation = validate_payout_integrity(payout_data)
        payout_data["validation"] = validation
        
        return payout_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error calculating tournament payouts: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/winners/{tournament_id}")
def get_tournament_winners_endpoint(
    tournament_id: int,
    squad_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: UserOut = Depends(get_current_user)
):
    """Get summary of all winners for a tournament"""
    
    try:
        # Verify tournament exists and user has access
        tournament = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
        if not tournament:
            raise HTTPException(status_code=404, detail="Tournament not found")
        
        if tournament.user_id != current_user.id and not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Load bracket data
        brackets_data = load_generated_brackets(db, tournament_id, squad_id)
        if not brackets_data:
            raise HTTPException(status_code=404, detail="No brackets found for this tournament")
        
        # Get winners summary
        winners_summary = get_tournament_winners_summary(brackets_data)
        
        # Add tournament info
        winners_summary["tournament_info"] = {
            "id": tournament_id,
            "name": tournament.name,
            "squad_id": squad_id
        }
        
        return winners_summary
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting tournament winners: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/save/{tournament_id}")
def save_tournament_payouts_endpoint(
    tournament_id: int,
    squad_id: Optional[int] = None,
    scratch_fee: float = Query(None, description="Entry fee for scratch brackets (overrides tournament settings)"),
    handicap_fee: float = Query(None, description="Entry fee for handicap brackets (overrides tournament settings)"),
    house_percentage: float = Query(0.0, description="House percentage (0-100)"),
    db: Session = Depends(get_db),
    current_user: UserOut = Depends(get_current_user)
):
    """Save calculated payouts and winners to database for tracking"""
    
    try:
        # Verify tournament exists and user has access
        tournament = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
        if not tournament:
            raise HTTPException(status_code=404, detail="Tournament not found")
        
        if tournament.user_id != current_user.id and not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get tournament bracket settings for entry fees
        bracket_settings = db.query(models.BracketSettings).filter(
            models.BracketSettings.tournament_id == tournament_id
        ).first()
        
        # Determine entry fees - use tournament settings or provided values
        if scratch_fee is not None and handicap_fee is not None:
            # Use provided fees (override)
            entry_fees = {"scratch": scratch_fee, "handicap": handicap_fee}
        elif bracket_settings and bracket_settings.cost_per_bracket is not None:
            # Use tournament settings - same cost for both bracket types
            cost_per_bracket = float(bracket_settings.cost_per_bracket)
            entry_fees = {"scratch": cost_per_bracket, "handicap": cost_per_bracket}
        else:
            # Fallback to defaults if no settings found
            entry_fees = {"scratch": scratch_fee or DEFAULT_ENTRY_FEES["scratch"], 
                         "handicap": handicap_fee or DEFAULT_ENTRY_FEES["handicap"]}
        
        # Load bracket data and calculate payouts
        brackets_data = load_generated_brackets(db, tournament_id, squad_id)
        if not brackets_data:
            raise HTTPException(status_code=404, detail="No brackets found for this tournament")
        
        payout_data = calculate_tournament_payouts(brackets_data, entry_fees)
        
        # Check if payouts already exist for this tournament/squad
        existing_summary = db.query(models.PayoutSummary).filter(
            models.PayoutSummary.tournament_id == tournament_id,
            models.PayoutSummary.squad_id == squad_id
        ).first()
        
        if existing_summary and existing_summary.is_finalized:
            raise HTTPException(status_code=400, detail="Payouts already finalized for this tournament")
        
        current_time = datetime.utcnow().isoformat()
        
        # Create or update payout summary
        if existing_summary:
            payout_summary = existing_summary
            payout_summary.updated_at = current_time
        else:
            payout_summary = models.PayoutSummary(
                tournament_id=tournament_id,
                squad_id=squad_id,
                created_at=current_time,
                updated_at=current_time
            )
        
        # Update summary fields
        payout_summary.total_prize_pool = float(payout_data["total_prize_pool"])
        payout_summary.total_scratch_pool = float(payout_data["total_scratch_pool"]) 
        payout_summary.total_handicap_pool = float(payout_data["total_handicap_pool"])
        payout_summary.scratch_brackets_count = len(payout_data["scratch_brackets"])
        payout_summary.handicap_brackets_count = len(payout_data["handicap_brackets"])
        payout_summary.scratch_entry_fee = entry_fees["scratch"]
        payout_summary.handicap_entry_fee = entry_fees["handicap"]
        payout_summary.house_percentage = house_percentage
        payout_summary.house_amount = float(payout_summary.total_prize_pool) * (house_percentage / 100)
        payout_summary.total_unpaid = float(payout_data["total_prize_pool"]) - payout_summary.house_amount
        
        # Count total winners
        total_winners = sum(len(bracket["winners"]) for bracket in 
                          payout_data["scratch_brackets"] + payout_data["handicap_brackets"])
        payout_summary.total_winners = total_winners
        
        if not existing_summary:
            db.add(payout_summary)
            db.flush()  # Get the ID
        
        # Save individual winners and payouts
        _save_winners_and_payouts(db, payout_data, payout_summary.id, tournament_id, squad_id, current_time)
        
        db.commit()
        
        return {
            "message": "Payouts saved successfully",
            "summary_id": payout_summary.id,
            "total_winners": total_winners,
            "total_prize_pool": payout_summary.total_prize_pool,
            "house_amount": payout_summary.house_amount
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving tournament payouts: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/history/{tournament_id}")
def get_payout_history_endpoint(
    tournament_id: int,
    squad_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: UserOut = Depends(get_current_user)
):
    """Get saved payout history for a tournament"""
    
    try:
        # Verify tournament exists and user has access
        tournament = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
        if not tournament:
            raise HTTPException(status_code=404, detail="Tournament not found")
        
        if tournament.user_id != current_user.id and not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get payout summary
        payout_summary = db.query(models.PayoutSummary).filter(
            models.PayoutSummary.tournament_id == tournament_id,
            models.PayoutSummary.squad_id == squad_id
        ).first()
        
        if not payout_summary:
            raise HTTPException(status_code=404, detail="No payout history found")
        
        # Get all winners for this tournament
        winners = db.query(models.TournamentWinner).filter(
            models.TournamentWinner.tournament_id == tournament_id,
            models.TournamentWinner.squad_id == squad_id
        ).order_by(models.TournamentWinner.bracket_type, models.TournamentWinner.placement).all()
        
        # Get all payouts for this tournament
        payouts = db.query(models.TournamentPayout).filter(
            models.TournamentPayout.tournament_id == tournament_id,
            models.TournamentPayout.squad_id == squad_id
        ).order_by(models.TournamentPayout.bracket_type, models.TournamentPayout.placement).all()
        
        return {
            "tournament_info": {
                "id": tournament_id,
                "name": tournament.name,
                "squad_id": squad_id
            },
            "summary": {
                "total_prize_pool": payout_summary.total_prize_pool,
                "total_scratch_pool": payout_summary.total_scratch_pool,
                "total_handicap_pool": payout_summary.total_handicap_pool,
                "total_paid_out": payout_summary.total_paid_out,
                "total_unpaid": payout_summary.total_unpaid,
                "house_amount": payout_summary.house_amount,
                "is_finalized": payout_summary.is_finalized,
                "created_at": payout_summary.created_at
            },
            "winners": [
                {
                    "id": winner.id,
                    "bracket_type": winner.bracket_type,
                    "bracket_name": winner.bracket_name,
                    "placement": winner.placement,
                    "placement_text": winner.placement_text,
                    "player_name": winner.player_name,
                    "winning_score": winner.winning_score,
                    "bowler_id": winner.bowler_id
                }
                for winner in winners
            ],
            "payouts": [
                {
                    "id": payout.id,
                    "bracket_type": payout.bracket_type,
                    "bracket_name": payout.bracket_name,
                    "placement": payout.placement,
                    "player_name": payout.player_name,
                    "payout_amount": payout.payout_amount,
                    "payout_percentage": payout.payout_percentage,
                    "is_paid": payout.is_paid,
                    "paid_date": payout.paid_date,
                    "payment_method": payout.payment_method,
                    "notes": payout.notes
                }
                for payout in payouts
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting payout history: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


def _save_winners_and_payouts(
    db: Session, 
    payout_data: Dict[str, Any], 
    summary_id: int,
    tournament_id: int, 
    squad_id: Optional[int], 
    current_time: str
):
    """Helper function to save winners and payout details to database"""
    
    try:
        # Clear existing records for this tournament/squad to avoid duplicates
        db.query(models.TournamentWinner).filter(
            models.TournamentWinner.tournament_id == tournament_id,
            models.TournamentWinner.squad_id == squad_id
        ).delete()
    
        db.query(models.TournamentPayout).filter(
            models.TournamentPayout.tournament_id == tournament_id,
            models.TournamentPayout.squad_id == squad_id
        ).delete()
    
        # Save winners and payouts from all brackets
        all_bracket_data = payout_data["scratch_brackets"] + payout_data["handicap_brackets"]
        total_winners = 0
    
        for bracket_data in all_bracket_data:
            bracket_name = bracket_data["bracket_name"]
            bracket_type = bracket_data["bracket_type"]
            bracket_size = bracket_data["bracket_size"]
            prize_pool = float(bracket_data["prize_pool"])
        
            for winner_data in bracket_data["winners"]:
                total_winners += 1
            
                # Create winner record
                winner = models.TournamentWinner(
                    tournament_id=tournament_id,
                    squad_id=squad_id,
                    bracket_id=1,  # TODO: Link to actual bracket_id when available
                    bowler_id=winner_data["player_id"] or 0,
                    bracket_type=bracket_type,
                    bracket_name=bracket_name,
                    placement=winner_data["place"],
                    placement_text=winner_data["position"],
                    player_name=winner_data["player_name"],
                    winning_score=winner_data.get("score"),
                    created_at=current_time
                )
                db.add(winner)
                db.flush()  # Get the winner ID
            
                # Create payout record
                payout = models.TournamentPayout(
                    tournament_id=tournament_id,
                    squad_id=squad_id,
                    bracket_id=1,  # TODO: Link to actual bracket_id when available
                    winner_id=winner.id,
                    bowler_id=winner_data["player_id"] or 0,
                    bracket_type=bracket_type,
                    bracket_name=bracket_name,
                    placement=winner_data["place"],
                    player_name=winner_data["player_name"],
                    prize_pool_total=prize_pool,
                    payout_percentage=winner_data["payout_percentage"],
                    payout_amount=float(winner_data["payout_amount"]),
                    entry_fee=winner_data.get("entry_fee", 0.0),
                    bracket_size=bracket_size,
                    is_paid=False,
                    created_at=current_time,
                    updated_at=current_time
                )
                db.add(payout)
        
        db.commit()
        logger.info(f"Saved {total_winners} winners and payouts for tournament {tournament_id}")
        return total_winners
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving winners and payouts: {e}")
        raise


@router.get("/entries/{tournament_id}")
def get_entry_analysis(
    tournament_id: int,
    squad_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: UserOut = Depends(get_current_user)
):
    """Get comprehensive entry analysis for a tournament showing all player entries, wins, and amounts"""
    
    try:
        # Verify tournament exists and user has access
        tournament = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
        if not tournament:
            raise HTTPException(status_code=404, detail="Tournament not found")
        
        if tournament.user_id != current_user.id and not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get all bowlers for this tournament
        bowlers_query = db.query(models.Bowler).filter(models.Bowler.tournament_id == tournament_id)
        if squad_id:
            bowlers_query = bowlers_query.filter(models.Bowler.squad_id == squad_id)
        
        bowlers = bowlers_query.all()
        
        # Get all winners and payouts for this tournament
        winners_query = db.query(models.TournamentWinner).filter(
            models.TournamentWinner.tournament_id == tournament_id
        )
        if squad_id:
            winners_query = winners_query.filter(models.TournamentWinner.squad_id == squad_id)
        
        winners = winners_query.all()
        
        # Get all payouts for this tournament
        payouts_query = db.query(models.TournamentPayout).filter(
            models.TournamentPayout.tournament_id == tournament_id
        )
        if squad_id:
            payouts_query = payouts_query.filter(models.TournamentPayout.squad_id == squad_id)
        
        payouts = payouts_query.all()
        
        # Process data to create entry analysis
        entries_data = {}
        
        # Initialize entries from bowler data
        for bowler in bowlers:
            entries_data[bowler.id] = {
                "id": bowler.id,
                "name": bowler.name,
                "scratch_brackets_entered": 0,
                "handicap_brackets_entered": 0,
                "total_brackets_entered": 0,
                "scratch_brackets_won": 0,
                "handicap_brackets_won": 0,
                "total_brackets_won": 0,
                "total_amount_won": 0.0,
                "scratch_amount_won": 0.0,
                "handicap_amount_won": 0.0,
                "placement_details": []
            }
        
        # Process payouts to populate bracket entries and winnings
        bracket_entries = {}  # Track unique bracket entries per player
        
        for payout in payouts:
            player_id = payout.bowler_id
            if player_id not in entries_data:
                continue  # Skip if player not found
                
            entry = entries_data[player_id]
            
            # Track bracket entries (use bracket_name + bracket_type as unique key)
            bracket_key = f"{payout.bracket_name}_{payout.bracket_type}_{player_id}"
            if bracket_key not in bracket_entries:
                bracket_entries[bracket_key] = True
                if payout.bracket_type.lower() == 'scratch':
                    entry["scratch_brackets_entered"] += 1
                else:
                    entry["handicap_brackets_entered"] += 1
            
            # Count wins and amounts (only for podium finishes)
            if payout.placement <= 4:  # Top 4 positions are considered "wins"
                if payout.bracket_type.lower() == 'scratch':
                    entry["scratch_brackets_won"] += 1
                    entry["scratch_amount_won"] += float(payout.payout_amount or 0)
                else:
                    entry["handicap_brackets_won"] += 1
                    entry["handicap_amount_won"] += float(payout.payout_amount or 0)
                
                entry["placement_details"].append({
                    "bracket_name": payout.bracket_name,
                    "bracket_type": payout.bracket_type,
                    "placement": payout.placement,
                    "placement_text": f"{payout.placement}{['st', 'nd', 'rd', 'th'][min(payout.placement-1, 3) if payout.placement <= 4 else 3]}",
                    "amount_won": float(payout.payout_amount or 0)
                })
        
        # Calculate totals for each entry
        entries_list = []
        for entry in entries_data.values():
            entry["total_brackets_entered"] = entry["scratch_brackets_entered"] + entry["handicap_brackets_entered"]
            entry["total_brackets_won"] = entry["scratch_brackets_won"] + entry["handicap_brackets_won"]
            entry["total_amount_won"] = entry["scratch_amount_won"] + entry["handicap_amount_won"]
            entries_list.append(entry)
        
        # Sort by total amount won (descending)
        entries_list.sort(key=lambda x: x["total_amount_won"], reverse=True)
        
        # Calculate summary statistics
        summary = {
            "total_players": len(entries_list),
            "total_scratch_entries": sum(e["scratch_brackets_entered"] for e in entries_list),
            "total_handicap_entries": sum(e["handicap_brackets_entered"] for e in entries_list),
            "total_amount_distributed": sum(e["total_amount_won"] for e in entries_list),
            "average_per_player": sum(e["total_amount_won"] for e in entries_list) / len(entries_list) if entries_list else 0
        }
        
        return {
            "tournament_info": {
                "id": tournament.id,
                "name": tournament.name,
                "squad_id": squad_id
            },
            "entries": entries_list,
            "summary": summary
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting entry analysis: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")