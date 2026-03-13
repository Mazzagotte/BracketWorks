"""
Payout calculation and winner tracking service for tournament brackets.
Handles prize distribution based on bracket results and tournament settings.
"""

from typing import Dict, Any, Optional
import logging
from decimal import Decimal, ROUND_HALF_UP

logger = logging.getLogger(__name__)

# Default payout percentages based on bracket size
DEFAULT_PRESETS = {
    8:  {"1st": 60, "2nd": 40},
    16: {"1st": 50, "2nd": 30, "3rd": 20},
    32: {"1st": 40, "2nd": 25, "3rd": 20, "4th": 15},
    64: {"1st": 35, "2nd": 25, "3rd": 20, "4th": 12, "5th": 8}
}

DEFAULT_ENTRY_FEES = {
    "scratch":  25.00,
    "handicap": 20.00
}


def count_bracket_entries(bracket: Dict[str, Any]) -> int:
    """Count actual players (non-BYE) in round 1 of a bracket."""
    if not bracket.get('rounds'):
        return 0
    first_round_matches = bracket['rounds'][0].get('matches', [])
    count = 0
    for match in first_round_matches:
        if match.get('playerA') and match.get('playerA') != 'BYE':
            count += 1
        if match.get('playerB') and match.get('playerB') != 'BYE':
            count += 1
    return count if count > 0 else bracket.get('size', 8)


def extract_bracket_winners(bracket: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract winner information from a completed bracket.
    Handles normal completion and finals tie (split_pot=True).
    """
    if not bracket.get('rounds') or len(bracket['rounds']) == 0:
        return {"status": "no_rounds", "winners": []}

    winners = []
    bracket_size = bracket.get('size', 8)

    try:
        # Championship match → 1st and 2nd place
        championship_round = bracket['rounds'][-1]
        if len(championship_round['matches']) == 1:
            championship_match = championship_round['matches'][0]

            if championship_match.get('status') == 'completed':
                if championship_match.get('split_pot'):
                    # Finals tie — both players share 1st place (50/50 split)
                    for name_key, id_key, score_key in [
                        ('playerA', 'playerA_id', 'scoreA'),
                        ('playerB', 'playerB_id', 'scoreB'),
                    ]:
                        winners.append({
                            "place": 1,
                            "position": "1st",
                            "player_name": championship_match.get(name_key, ''),
                            "player_id": championship_match.get(id_key),
                            "score": championship_match.get(score_key),
                            "bracket_type": bracket.get('bracket_type', 'Unknown'),
                            "split_pot": True,
                        })
                elif championship_match.get('winner'):
                    if championship_match['winner'] == 'A':
                        first_place = {
                            "place": 1, "position": "1st",
                            "player_name": championship_match['playerA'],
                            "player_id": championship_match.get('playerA_id'),
                            "score": championship_match.get('scoreA'),
                            "bracket_type": bracket.get('bracket_type', 'Unknown'),
                        }
                        runner_up = {
                            "place": 2, "position": "2nd",
                            "player_name": championship_match['playerB'],
                            "player_id": championship_match.get('playerB_id'),
                            "score": championship_match.get('scoreB'),
                            "bracket_type": bracket.get('bracket_type', 'Unknown'),
                        }
                    else:
                        first_place = {
                            "place": 1, "position": "1st",
                            "player_name": championship_match['playerB'],
                            "player_id": championship_match.get('playerB_id'),
                            "score": championship_match.get('scoreB'),
                            "bracket_type": bracket.get('bracket_type', 'Unknown'),
                        }
                        runner_up = {
                            "place": 2, "position": "2nd",
                            "player_name": championship_match['playerA'],
                            "player_id": championship_match.get('playerA_id'),
                            "score": championship_match.get('scoreA'),
                            "bracket_type": bracket.get('bracket_type', 'Unknown'),
                        }
                    winners.append(first_place)
                    winners.append(runner_up)

        # Semi-finals → 3rd and 4th place (16+ bracket only)
        if len(bracket['rounds']) >= 3 and bracket_size >= 16:
            semifinal_round = bracket['rounds'][-2]
            semifinal_losers = []

            for match in semifinal_round['matches']:
                if match.get('status') == 'completed' and match.get('winner'):
                    if match['winner'] == 'A':
                        loser = {
                            "place": None,
                            "player_name": match['playerB'],
                            "player_id": match.get('playerB_id'),
                            "score": match.get('scoreB'),
                            "bracket_type": bracket.get('bracket_type', 'Unknown'),
                        }
                    else:
                        loser = {
                            "place": None,
                            "player_name": match['playerA'],
                            "player_id": match.get('playerA_id'),
                            "score": match.get('scoreA'),
                            "bracket_type": bracket.get('bracket_type', 'Unknown'),
                        }
                    semifinal_losers.append(loser)

            if len(semifinal_losers) == 2:
                semifinal_losers.sort(key=lambda x: x.get('score') or 0, reverse=True)
                semifinal_losers[0]['place'] = 3
                semifinal_losers[0]['position'] = '3rd'
                semifinal_losers[1]['place'] = 4
                semifinal_losers[1]['position'] = '4th'
                winners.extend(semifinal_losers)

        return {
            "status": "completed" if winners else "incomplete",
            "bracket_size": bracket_size,
            "bracket_type": bracket.get('bracket_type', 'Unknown'),
            "winners": winners,
        }

    except Exception as e:
        logger.error(f"Error extracting bracket winners: {e}")
        return {"status": "error", "error": str(e), "winners": []}


def calculate_bracket_prize_pool(
    bracket_info: Dict[str, Any],
    entry_fees: Dict[str, float],
    house_percentage: float = 0.0,
    entry_count: Optional[int] = None,
) -> Decimal:
    """Calculate total prize pool for a single bracket."""
    bracket_type = bracket_info.get('bracket_type', '').lower()
    bracket_size = bracket_info.get('size', 8)

    fee_per_entry  = Decimal(str(entry_fees.get(bracket_type, entry_fees.get('scratch', 25.00))))
    actual_entries = entry_count if entry_count is not None else bracket_size
    total_collected = Decimal(str(actual_entries)) * fee_per_entry

    if house_percentage and house_percentage > 0:
        house_take = total_collected * Decimal(str(house_percentage)) / Decimal('100')
        total_pool = total_collected - house_take
    else:
        total_pool = total_collected

    return total_pool.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def calculate_tournament_payouts(
    brackets_data: Dict[str, Any],
    entry_fees: Dict[str, float] = None,
    house_percentage: float = 0.0,
) -> Dict[str, Any]:
    """
    Calculate payouts for all brackets in a tournament.
    All monetary accumulation uses Decimal internally; values are converted
    to float for JSON serialisation only at the very end.
    """
    if entry_fees is None:
        entry_fees = DEFAULT_ENTRY_FEES

    if house_percentage < 0 or house_percentage > 100:
        logger.warning(f"Invalid house_percentage {house_percentage}, using 0")
        house_percentage = 0.0

    scratch_pool    = Decimal('0')
    handicap_pool   = Decimal('0')
    total_collected = Decimal('0')
    house_take      = Decimal('0')

    scratch_brackets_out  = []
    handicap_brackets_out = []
    winners_by_bracket    = []

    try:
        for i, bracket in enumerate(brackets_data.get('scratch_brackets', [])):
            bp = _calculate_single_bracket_payout(
                bracket, f"Scratch Bracket {i+1}", entry_fees, house_percentage
            )
            scratch_brackets_out.append(bp)
            scratch_pool    += bp.pop("_prize_pool_d")
            total_collected += bp.pop("_collected_d")
            house_take      += bp.pop("_house_d")
            winners_by_bracket.extend(bp["winners"])

        for i, bracket in enumerate(brackets_data.get('handicap_brackets', [])):
            bp = _calculate_single_bracket_payout(
                bracket, f"Handicap Bracket {i+1}", entry_fees, house_percentage
            )
            handicap_brackets_out.append(bp)
            handicap_pool   += bp.pop("_prize_pool_d")
            total_collected += bp.pop("_collected_d")
            house_take      += bp.pop("_house_d")
            winners_by_bracket.extend(bp["winners"])

        def _q(d: Decimal) -> float:
            return float(d.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))

        return {
            "scratch_brackets":    scratch_brackets_out,
            "handicap_brackets":   handicap_brackets_out,
            "total_prize_pool":    _q(scratch_pool + handicap_pool),
            "total_scratch_pool":  _q(scratch_pool),
            "total_handicap_pool": _q(handicap_pool),
            "total_collected":     _q(total_collected),
            "house_take":          _q(house_take),
            "house_percentage":    house_percentage,
            "winners_by_bracket":  winners_by_bracket,
        }

    except Exception as e:
        logger.error(f"Error calculating tournament payouts: {e}", exc_info=True)
        return {
            "error": str(e),
            "scratch_brackets":   [],
            "handicap_brackets":  [],
            "total_prize_pool":   0.0,
            "winners_by_bracket": [],
        }


def _calculate_single_bracket_payout(
    bracket: Dict[str, Any],
    bracket_name: str,
    entry_fees: Dict[str, float],
    house_percentage: float = 0.0,
) -> Dict[str, Any]:
    """
    Calculate payout for one bracket.
    Returns internal Decimal fields prefixed '_' for the caller to accumulate;
    caller pops them so they are never serialised.
    """
    bracket_size   = bracket.get('size', 8)
    bracket_type   = bracket.get('bracket_type', 'Unknown').lower()
    actual_entries = count_bracket_entries(bracket)

    fee_per_entry   = Decimal(str(entry_fees.get(bracket_type, entry_fees.get('scratch', 25.00))))
    total_collected = Decimal(str(actual_entries)) * fee_per_entry

    if house_percentage and house_percentage > 0:
        house_take = (total_collected * Decimal(str(house_percentage)) / Decimal('100')).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        prize_pool = total_collected - house_take
    else:
        house_take = Decimal('0')
        prize_pool = total_collected

    prize_pool = prize_pool.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    winners_info = extract_bracket_winners(bracket)
    winners      = winners_info.get('winners', [])

    payout_percentages = DEFAULT_PRESETS.get(bracket_size, DEFAULT_PRESETS[8])

    # Detect split-pot finals tie: two place=1 entries both flagged split_pot
    split_pot_winners = [w for w in winners if w.get('place') == 1 and w.get('split_pot')]
    is_split_pot = len(split_pot_winners) == 2

    calculated_winners = []
    for winner in winners:
        position = winner.get('position', '')
        if is_split_pot and winner.get('split_pot'):
            percentage    = 50
            payout_amount = (prize_pool * Decimal('50') / Decimal('100')).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            )
        else:
            percentage = payout_percentages.get(position.lower(), 0)
            if percentage <= 0:
                continue
            payout_amount = (prize_pool * Decimal(str(percentage)) / Decimal('100')).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            )
        calculated_winners.append({
            **winner,
            "bracket_name":      bracket_name,
            "payout_percentage": percentage,
            "payout_amount":     float(payout_amount),
            "prize_pool_total":  float(prize_pool),
        })

    return {
        "bracket_name":     bracket_name,
        "bracket_type":     bracket_type,
        "bracket_size":     bracket_size,
        "actual_entries":   actual_entries,
        "prize_pool":       float(prize_pool),
        "total_collected":  float(total_collected),
        "house_take":       float(house_take),
        "house_percentage": house_percentage,
        "winners":          calculated_winners,
        "payout_percentages": payout_percentages,
        "status":           winners_info.get('status', 'unknown'),
        # Internal Decimal fields — popped by caller, never serialised
        "_prize_pool_d": prize_pool,
        "_collected_d":  total_collected,
        "_house_d":      house_take,
    }


def get_tournament_winners_summary(brackets_data: Dict[str, Any]) -> Dict[str, Any]:
    """Get a summary of all tournament winners across all brackets."""
    all_winners = []

    for i, bracket in enumerate(brackets_data.get('scratch_brackets', [])):
        winners_info = extract_bracket_winners(bracket)
        for winner in winners_info.get('winners', []):
            winner['bracket_name'] = f"Scratch Bracket {i+1}"
            all_winners.append(winner)

    for i, bracket in enumerate(brackets_data.get('handicap_brackets', [])):
        winners_info = extract_bracket_winners(bracket)
        for winner in winners_info.get('winners', []):
            winner['bracket_name'] = f"Handicap Bracket {i+1}"
            all_winners.append(winner)

    winners_by_place: Dict[int, list] = {}
    for winner in all_winners:
        place = winner.get('place')
        if place:
            winners_by_place.setdefault(place, []).append(winner)

    return {
        "total_winners":      len(all_winners),
        "winners_by_place":   winners_by_place,
        "all_winners":        all_winners,
        "scratch_champions":  [w for w in all_winners if w.get('bracket_type') == 'Scratch'  and w.get('place') == 1],
        "handicap_champions": [w for w in all_winners if w.get('bracket_type') == 'Handicap' and w.get('place') == 1],
    }


def validate_payout_integrity(payout_data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate that payout percentages balance within each bracket."""
    errors   = []
    warnings = []
    total_distributed = Decimal('0')
    total_pool        = Decimal('0')

    try:
        all_brackets = payout_data.get('scratch_brackets', []) + payout_data.get('handicap_brackets', [])
        for bp in all_brackets:
            pool = Decimal(str(bp.get('prize_pool', 0)))
            total_pool += pool
            distributed = Decimal('0')
            for winner in bp.get('winners', []):
                # payout_amount is always float here — wrap in str() for safety
                amt = Decimal(str(winner.get('payout_amount', 0)))
                distributed += amt
                total_distributed += amt
            diff = abs(pool - distributed)
            if diff > Decimal('0.05'):
                warnings.append(
                    f"{bp['bracket_name']}: pool ${pool} vs distributed ${distributed} (diff ${diff})"
                )

        return {
            "is_valid":          len(errors) == 0,
            "errors":            errors,
            "warnings":          warnings,
            "total_distributed": float(total_distributed),
            "total_collected":   float(total_pool),
        }

    except Exception as e:
        return {
            "is_valid":          False,
            "errors":            [f"Validation error: {e}"],
            "warnings":          [],
            "total_distributed": 0.0,
            "total_collected":   0.0,
        }
