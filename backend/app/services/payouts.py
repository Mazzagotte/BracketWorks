
"""
Payout calculation and winner tracking service for tournament brackets.
Handles prize distribution based on bracket results and tournament settings.
"""

from typing import Dict, List, Optional, Any
import logging
from decimal import Decimal, ROUND_HALF_UP

logger = logging.getLogger(__name__)

# Default payout percentages based on bracket size
DEFAULT_PRESETS = {
    8: {"1st": 60, "2nd": 40},
    16: {"1st": 50, "2nd": 30, "3rd": 20},
    32: {"1st": 40, "2nd": 25, "3rd": 20, "4th": 15},
    64: {"1st": 35, "2nd": 25, "3rd": 20, "4th": 12, "5th": 8}
}

# Entry fee structure (can be customized per tournament)
DEFAULT_ENTRY_FEES = {
    "scratch": 25.00,  # $25 for scratch brackets
    "handicap": 20.00  # $20 for handicap brackets
}


def extract_bracket_winners(bracket: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract winner information from a completed bracket.
    Returns winner details including placement (1st, 2nd, etc.)
    """
    if not bracket.get('rounds') or len(bracket['rounds']) == 0:
        return {"status": "no_rounds", "winners": []}
    
    winners = []
    bracket_size = bracket.get('size', 8)
    
    try:
        # Championship match (1st and 2nd place)
        championship_round = bracket['rounds'][-1]
        if len(championship_round['matches']) == 1:
            championship_match = championship_round['matches'][0]
            
            if championship_match.get('status') == 'completed' and championship_match.get('winner'):
                # 1st Place Winner
                if championship_match['winner'] == 'A':
                    winner = {
                        "place": 1,
                        "position": "1st",
                        "player_name": championship_match['playerA'],
                        "player_id": championship_match.get('player_id_A'),
                        "score": championship_match.get('scoreA'),
                        "bracket_type": bracket.get('bracket_type', 'Unknown')
                    }
                else:
                    winner = {
                        "place": 1,
                        "position": "1st", 
                        "player_name": championship_match['playerB'],
                        "player_id": championship_match.get('player_id_B'),
                        "score": championship_match.get('scoreB'),
                        "bracket_type": bracket.get('bracket_type', 'Unknown')
                    }
                winners.append(winner)
                
                # 2nd Place (the loser of championship)
                if championship_match['winner'] == 'A':
                    runner_up = {
                        "place": 2,
                        "position": "2nd",
                        "player_name": championship_match['playerB'],
                        "player_id": championship_match.get('player_id_B'),
                        "score": championship_match.get('scoreB'),
                        "bracket_type": bracket.get('bracket_type', 'Unknown')
                    }
                else:
                    runner_up = {
                        "place": 2,
                        "position": "2nd",
                        "player_name": championship_match['playerA'],
                        "player_id": championship_match.get('player_id_A'),
                        "score": championship_match.get('scoreA'),
                        "bracket_type": bracket.get('bracket_type', 'Unknown')
                    }
                winners.append(runner_up)
        
        # Semi-finals (3rd and 4th place for larger brackets)
        if len(bracket['rounds']) >= 3 and bracket_size >= 16:
            semifinal_round = bracket['rounds'][-2]
            semifinal_losers = []
            
            for match in semifinal_round['matches']:
                if match.get('status') == 'completed' and match.get('winner'):
                    # Add the loser of each semifinal
                    if match['winner'] == 'A':
                        loser = {
                            "place": None,  # Will be determined by score comparison
                            "player_name": match['playerB'],
                            "player_id": match.get('player_id_B'),
                            "score": match.get('scoreB'),
                            "bracket_type": bracket.get('bracket_type', 'Unknown')
                        }
                    else:
                        loser = {
                            "place": None,
                            "player_name": match['playerA'],
                            "player_id": match.get('player_id_A'),
                            "score": match.get('scoreA'),
                            "bracket_type": bracket.get('bracket_type', 'Unknown')
                        }
                    semifinal_losers.append(loser)
            
            # Sort semifinal losers by score to determine 3rd/4th place
            if len(semifinal_losers) == 2:
                semifinal_losers.sort(key=lambda x: x.get('score', 0), reverse=True)
                semifinal_losers[0]['place'] = 3
                semifinal_losers[0]['position'] = '3rd'
                semifinal_losers[1]['place'] = 4
                semifinal_losers[1]['position'] = '4th'
                winners.extend(semifinal_losers)
        
        return {
            "status": "completed" if winners else "incomplete",
            "bracket_size": bracket_size,
            "bracket_type": bracket.get('bracket_type', 'Unknown'),
            "winners": winners
        }
        
    except Exception as e:
        logger.error(f"Error extracting bracket winners: {e}")
        return {"status": "error", "error": str(e), "winners": []}


def calculate_bracket_prize_pool(bracket_info: Dict[str, Any], entry_fees: Dict[str, float] = None) -> Decimal:
    """
    Calculate total prize pool for a single bracket based on entry count and fees.
    """
    if entry_fees is None:
        entry_fees = DEFAULT_ENTRY_FEES
    
    bracket_type = bracket_info.get('bracket_type', '').lower()
    bracket_size = bracket_info.get('size', 8)
    
    # Get entry fee for this bracket type
    fee_per_entry = entry_fees.get(bracket_type, entry_fees.get('scratch', 25.00))
    
    # Total prize pool = entries * fee per entry
    total_pool = Decimal(str(bracket_size * fee_per_entry))
    
    return total_pool


def calculate_tournament_payouts(brackets_data: Dict[str, Any], entry_fees: Dict[str, float] = None) -> Dict[str, Any]:
    """
    Calculate payouts for all brackets in a tournament.
    Returns comprehensive payout breakdown by bracket type and overall totals.
    """
    if entry_fees is None:
        entry_fees = DEFAULT_ENTRY_FEES
    
    payout_summary = {
        "scratch_brackets": [],
        "handicap_brackets": [],
        "total_prize_pool": Decimal('0'),
        "total_scratch_pool": Decimal('0'),
        "total_handicap_pool": Decimal('0'),
        "winners_by_bracket": []
    }
    
    try:
        # Process Scratch Brackets
        scratch_brackets = brackets_data.get('scratch_brackets', [])
        for i, bracket in enumerate(scratch_brackets):
            bracket_payouts = _calculate_single_bracket_payout(
                bracket, f"Scratch Bracket {i+1}", entry_fees
            )
            payout_summary["scratch_brackets"].append(bracket_payouts)
            payout_summary["total_scratch_pool"] += bracket_payouts["prize_pool"]
            payout_summary["winners_by_bracket"].extend(bracket_payouts["winners"])
        
        # Process Handicap Brackets
        handicap_brackets = brackets_data.get('handicap_brackets', [])
        for i, bracket in enumerate(handicap_brackets):
            bracket_payouts = _calculate_single_bracket_payout(
                bracket, f"Handicap Bracket {i+1}", entry_fees
            )
            payout_summary["handicap_brackets"].append(bracket_payouts)
            payout_summary["total_handicap_pool"] += bracket_payouts["prize_pool"]
            payout_summary["winners_by_bracket"].extend(bracket_payouts["winners"])
        
        # Calculate totals
        payout_summary["total_prize_pool"] = (
            payout_summary["total_scratch_pool"] + 
            payout_summary["total_handicap_pool"]
        )
        
        # Round monetary values for display
        payout_summary["total_prize_pool"] = payout_summary["total_prize_pool"].quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        payout_summary["total_scratch_pool"] = payout_summary["total_scratch_pool"].quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        payout_summary["total_handicap_pool"] = payout_summary["total_handicap_pool"].quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        
        return payout_summary
        
    except Exception as e:
        logger.error(f"Error calculating tournament payouts: {e}")
        return {
            "error": str(e),
            "scratch_brackets": [],
            "handicap_brackets": [],
            "total_prize_pool": Decimal('0'),
            "winners_by_bracket": []
        }


def _calculate_single_bracket_payout(bracket: Dict[str, Any], bracket_name: str, entry_fees: Dict[str, float]) -> Dict[str, Any]:
    """
    Calculate payout for a single bracket including winner extraction and prize distribution.
    """
    bracket_size = bracket.get('size', 8)
    bracket_type = bracket.get('bracket_type', 'Unknown').lower()
    
    # Calculate prize pool
    prize_pool = calculate_bracket_prize_pool({
        'bracket_type': bracket_type,
        'size': bracket_size
    }, entry_fees)
    
    # Extract winners
    winners_info = extract_bracket_winners(bracket)
    winners = winners_info.get('winners', [])
    
    # Get payout percentages for this bracket size
    payout_percentages = DEFAULT_PRESETS.get(bracket_size, DEFAULT_PRESETS[8])
    
    # Calculate individual payouts
    calculated_winners = []
    for winner in winners:
        position = winner.get('position', '')
        percentage = payout_percentages.get(position.lower(), 0)
        
        if percentage > 0:
            payout = (prize_pool * Decimal(str(percentage)) / Decimal('100')).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            )
            
            calculated_winner = {
                **winner,
                "bracket_name": bracket_name,
                "payout_percentage": percentage,
                "payout_amount": payout,
                "prize_pool_total": prize_pool
            }
            calculated_winners.append(calculated_winner)
    
    return {
        "bracket_name": bracket_name,
        "bracket_type": bracket_type,
        "bracket_size": bracket_size,
        "prize_pool": prize_pool,
        "winners": calculated_winners,
        "payout_percentages": payout_percentages,
        "status": winners_info.get('status', 'unknown')
    }


def get_tournament_winners_summary(brackets_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get a summary of all tournament winners across all brackets.
    Useful for displaying overall tournament results.
    """
    all_winners = []
    
    # Extract winners from all scratch brackets
    for i, bracket in enumerate(brackets_data.get('scratch_brackets', [])):
        winners_info = extract_bracket_winners(bracket)
        for winner in winners_info.get('winners', []):
            winner['bracket_name'] = f"Scratch Bracket {i+1}"
            all_winners.append(winner)
    
    # Extract winners from all handicap brackets  
    for i, bracket in enumerate(brackets_data.get('handicap_brackets', [])):
        winners_info = extract_bracket_winners(bracket)
        for winner in winners_info.get('winners', []):
            winner['bracket_name'] = f"Handicap Bracket {i+1}"
            all_winners.append(winner)
    
    # Group winners by placement
    winners_by_place = {}
    for winner in all_winners:
        place = winner.get('place')
        if place:
            if place not in winners_by_place:
                winners_by_place[place] = []
            winners_by_place[place].append(winner)
    
    return {
        "total_winners": len(all_winners),
        "winners_by_place": winners_by_place,
        "all_winners": all_winners,
        "scratch_champions": [w for w in all_winners if w.get('bracket_type') == 'Scratch' and w.get('place') == 1],
        "handicap_champions": [w for w in all_winners if w.get('bracket_type') == 'Handicap' and w.get('place') == 1]
    }


def validate_payout_integrity(payout_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate that payout calculations are correct and prize pools balance.
    """
    validation_results = {
        "is_valid": True,
        "errors": [],
        "warnings": [],
        "total_distributed": Decimal('0'),
        "total_collected": Decimal('0')
    }
    
    try:
        # Sum all distributed payouts
        total_distributed = Decimal('0')
        for bracket_payouts in payout_data.get('scratch_brackets', []) + payout_data.get('handicap_brackets', []):
            for winner in bracket_payouts.get('winners', []):
                total_distributed += winner.get('payout_amount', Decimal('0'))
        
        validation_results["total_distributed"] = total_distributed
        validation_results["total_collected"] = payout_data.get('total_prize_pool', Decimal('0'))
        
        # Check if distributed matches collected (within penny tolerance)
        difference = abs(validation_results["total_collected"] - validation_results["total_distributed"])
        if difference > Decimal('0.02'):  # Allow 2 cent difference for rounding
            validation_results["errors"].append(
                f"Prize pool mismatch: Collected ${validation_results['total_collected']}, "
                f"Distributed ${validation_results['total_distributed']}, "
                f"Difference ${difference}"
            )
            validation_results["is_valid"] = False
        
        return validation_results
        
    except Exception as e:
        validation_results["errors"].append(f"Validation error: {e}")
        validation_results["is_valid"] = False
        return validation_results
