"""
Payout calculation and winner tracking service for tournament brackets.
Handles prize distribution based on bracket results and tournament settings.
"""

from __future__ import annotations

from typing import Any
import logging
from decimal import Decimal, ROUND_HALF_UP

from ..core.money import CENT, money_decimal, money_float

logger = logging.getLogger(__name__)

# Default payout percentages based on bracket size
DEFAULT_PRESETS = {
    8: {"1st": 60, "2nd": 40},
    16: {"1st": 50, "2nd": 30, "3rd": 20},
    32: {"1st": 40, "2nd": 25, "3rd": 20, "4th": 15},
    64: {"1st": 35, "2nd": 25, "3rd": 20, "4th": 12, "5th": 8},
}

DEFAULT_ENTRY_FEES = {"scratch": 25.00, "handicap": 20.00}


def _get_bracket_groups(brackets_data: dict[str, Any]) -> list[dict[str, Any]]:
    groups = brackets_data.get("bracket_groups")
    if groups:
        return groups
    return [
        {
            "key": "scratch",
            "name": "Scratch",
            "display_order": 1,
            "scoring_mode": "scratch",
            "brackets": brackets_data.get("scratch_brackets", []),
        },
        {
            "key": "handicap",
            "name": "Handicap",
            "display_order": 2,
            "scoring_mode": "handicap",
            "brackets": brackets_data.get("handicap_brackets", []),
        },
    ]


def count_bracket_entries(bracket: dict[str, Any]) -> int:
    """Count actual players (non-BYE) in round 1 of a bracket."""
    if not bracket.get("rounds"):
        return 0
    first_round_matches = bracket["rounds"][0].get("matches", [])
    count = 0
    for match in first_round_matches:
        if match.get("playerA") and match.get("playerA") != "BYE":
            count += 1
        if match.get("playerB") and match.get("playerB") != "BYE":
            count += 1
    return count if count > 0 else bracket.get("size", 8)


def bracket_has_bye_slot(bracket: dict[str, Any]) -> bool:
    """Return True when any first-round slot is a BYE."""
    if not bracket.get("rounds"):
        return False
    first_round_matches = bracket["rounds"][0].get("matches", [])
    for match in first_round_matches:
        if str(match.get("playerA") or "").strip().upper() == "BYE":
            return True
        if str(match.get("playerB") or "").strip().upper() == "BYE":
            return True
    return False


def extract_bracket_winners(bracket: dict[str, Any]) -> dict[str, Any]:
    """
    Extract winner information from a completed bracket.
    Handles normal completion and finals tie (split_pot=True).
    """
    if not bracket.get("rounds") or len(bracket["rounds"]) == 0:
        return {"status": "no_rounds", "winners": []}

    winners = []
    bracket_size = bracket.get("size", 8)

    try:
        # Championship match → 1st and 2nd place
        championship_round = bracket["rounds"][-1]
        if len(championship_round["matches"]) == 1:
            championship_match = championship_round["matches"][0]

            if championship_match.get("status") == "completed":
                if championship_match.get("split_pot"):
                    # Finals tie — both players share 1st place (50/50 split)
                    for name_key, id_key, score_key in [
                        ("playerA", "playerA_id", "scoreA"),
                        ("playerB", "playerB_id", "scoreB"),
                    ]:
                        winners.append(
                            {
                                "place": 1,
                                "position": "1st",
                                "player_name": championship_match.get(name_key, ""),
                                "player_id": championship_match.get(id_key),
                                "score": championship_match.get(score_key),
                                "bracket_type": bracket.get("bracket_type", "Unknown"),
                                "split_pot": True,
                            }
                        )
                elif championship_match.get("winner"):
                    if championship_match["winner"] == "A":
                        first_place = {
                            "place": 1,
                            "position": "1st",
                            "player_name": championship_match["playerA"],
                            "player_id": championship_match.get("playerA_id"),
                            "score": championship_match.get("scoreA"),
                            "bracket_type": bracket.get("bracket_type", "Unknown"),
                        }
                        runner_up = {
                            "place": 2,
                            "position": "2nd",
                            "player_name": championship_match["playerB"],
                            "player_id": championship_match.get("playerB_id"),
                            "score": championship_match.get("scoreB"),
                            "bracket_type": bracket.get("bracket_type", "Unknown"),
                        }
                    else:
                        first_place = {
                            "place": 1,
                            "position": "1st",
                            "player_name": championship_match["playerB"],
                            "player_id": championship_match.get("playerB_id"),
                            "score": championship_match.get("scoreB"),
                            "bracket_type": bracket.get("bracket_type", "Unknown"),
                        }
                        runner_up = {
                            "place": 2,
                            "position": "2nd",
                            "player_name": championship_match["playerA"],
                            "player_id": championship_match.get("playerA_id"),
                            "score": championship_match.get("scoreA"),
                            "bracket_type": bracket.get("bracket_type", "Unknown"),
                        }
                    winners.append(first_place)
                    winners.append(runner_up)

        # Semi-finals → 3rd and 4th place (16+ bracket only)
        if len(bracket["rounds"]) >= 3 and bracket_size >= 16:
            semifinal_round = bracket["rounds"][-2]
            semifinal_losers = []

            for match in semifinal_round["matches"]:
                if match.get("status") == "completed" and match.get("winner"):
                    if match["winner"] == "A":
                        loser = {
                            "place": None,
                            "player_name": match["playerB"],
                            "player_id": match.get("playerB_id"),
                            "score": match.get("scoreB"),
                            "bracket_type": bracket.get("bracket_type", "Unknown"),
                        }
                    else:
                        loser = {
                            "place": None,
                            "player_name": match["playerA"],
                            "player_id": match.get("playerA_id"),
                            "score": match.get("scoreA"),
                            "bracket_type": bracket.get("bracket_type", "Unknown"),
                        }
                    semifinal_losers.append(loser)

            if len(semifinal_losers) == 2:
                semifinal_losers.sort(key=lambda x: x.get("score") or 0, reverse=True)
                semifinal_losers[0]["place"] = 3
                semifinal_losers[0]["position"] = "3rd"
                semifinal_losers[1]["place"] = 4
                semifinal_losers[1]["position"] = "4th"
                winners.extend(semifinal_losers)

        return {
            "status": "completed" if winners else "incomplete",
            "bracket_size": bracket_size,
            "bracket_type": bracket.get("bracket_type", "Unknown"),
            "winners": winners,
        }

    except Exception as e:
        logger.error(f"Error extracting bracket winners: {e}")
        return {"status": "error", "error": str(e), "winners": []}


def calculate_bracket_prize_pool(
    bracket_info: dict[str, Any],
    entry_fees: dict[str, float],
    house_percentage: float = 0.0,
    entry_count: int | None = None,
) -> Decimal:
    """Calculate total prize pool for a single bracket."""
    bracket_type = bracket_info.get("bracket_type", "").lower()
    bracket_size = bracket_info.get("size", 8)

    fee_per_entry = Decimal(
        str(entry_fees.get(bracket_type, entry_fees.get("scratch", 25.00)))
    )
    actual_entries = entry_count if entry_count is not None else bracket_size
    total_collected = Decimal(str(actual_entries)) * fee_per_entry

    has_bye_slot = bracket_has_bye_slot(bracket_info)
    if house_percentage and house_percentage > 0 and not has_bye_slot:
        house_take = total_collected * Decimal(str(house_percentage)) / Decimal("100")
        total_pool = total_collected - house_take
    else:
        total_pool = total_collected

    return money_decimal(total_pool)


def reset_payouts_if_needed(db, tournament_id: int, squad_id) -> None:
    """
    If payouts have been calculated for this tournament/squad, reset them to
    an unfinalized/unpaid state. Called whenever entries or scores are mutated.
    Does nothing if no payout summary exists (payouts were never calculated).
    """
    from ..core.models import TournamentPayoutSummary, BracketPayout

    squad_filter = (
        TournamentPayoutSummary.squad_id == squad_id
        if squad_id is not None
        else TournamentPayoutSummary.squad_id.is_(None)
    )
    summary = (
        db.query(TournamentPayoutSummary)
        .filter(
            TournamentPayoutSummary.tournament_id == tournament_id,
            squad_filter,
        )
        .first()
    )

    if not summary:
        return

    summary.is_finalized = False
    summary.finalized_date = None

    payout_squad_filter = (
        BracketPayout.squad_id == squad_id
        if squad_id is not None
        else BracketPayout.squad_id.is_(None)
    )
    db.query(BracketPayout).filter(
        BracketPayout.tournament_id == tournament_id,
        payout_squad_filter,
    ).update(
        {"is_paid": False, "paid_date": None, "payment_method": None},
        synchronize_session=False,
    )


def calculate_tournament_payouts(
    brackets_data: dict[str, Any],
    entry_fees: dict[str, float] | None = None,
    house_percentage: float = 0.0,
) -> dict[str, Any]:
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

    total_pool = Decimal("0")
    scratch_pool = Decimal("0")
    handicap_pool = Decimal("0")
    total_collected = Decimal("0")
    house_take = Decimal("0")

    scratch_brackets_out = []
    handicap_brackets_out = []
    winners_by_bracket = []
    program_summaries = []

    try:
        for group in sorted(
            _get_bracket_groups(brackets_data),
            key=lambda item: item.get("display_order", 0),
        ):
            group_key = str(group.get("key") or "unknown").lower()
            group_name = str(group.get("name") or group_key.replace("_", " ").title())
            group_brackets = group.get("brackets", []) or []
            group_pool = Decimal("0")
            group_brackets_out = []

            for i, bracket in enumerate(group_brackets):
                bracket_with_type = {**bracket, "bracket_type": group_key}
                bp = _calculate_single_bracket_payout(
                    bracket_with_type,
                    f"{group_name} Bracket {i+1}",
                    entry_fees,
                    house_percentage,
                )
                group_brackets_out.append(bp)
                group_pool += bp.pop("_prize_pool_d")
                total_collected += bp.pop("_collected_d")
                house_take += bp.pop("_house_d")
                winners_by_bracket.extend(bp["winners"])

            total_pool += group_pool

            if group_key == "scratch":
                scratch_brackets_out = group_brackets_out
                scratch_pool = group_pool
            elif group_key == "handicap":
                handicap_brackets_out = group_brackets_out
                handicap_pool = group_pool

            program_summaries.append(
                {
                    "key": group_key,
                    "name": group_name,
                    "display_order": group.get("display_order", 0),
                    "scoring_mode": group.get("scoring_mode", group_key),
                    "total_brackets": len(group_brackets_out),
                    "total_winners": sum(
                        len(bracket.get("winners", []))
                        for bracket in group_brackets_out
                    ),
                    "total_prize_pool": money_float(group_pool),
                }
            )

        return {
            "scratch_brackets": scratch_brackets_out,
            "handicap_brackets": handicap_brackets_out,
            "total_prize_pool": money_float(total_pool),
            "total_scratch_pool": money_float(scratch_pool),
            "total_handicap_pool": money_float(handicap_pool),
            "total_collected": money_float(total_collected),
            "house_take": money_float(house_take),
            "house_percentage": house_percentage,
            "program_summaries": program_summaries,
            "winners_by_bracket": winners_by_bracket,
        }

    except Exception as e:
        logger.error(f"Error calculating tournament payouts: {e}", exc_info=True)
        return {
            "error": str(e),
            "scratch_brackets": [],
            "handicap_brackets": [],
            "total_prize_pool": 0.0,
            "program_summaries": [],
            "winners_by_bracket": [],
        }


def _calculate_single_bracket_payout(
    bracket: dict[str, Any],
    bracket_name: str,
    entry_fees: dict[str, float],
    house_percentage: float = 0.0,
) -> dict[str, Any]:
    """
    Calculate payout for one bracket.
    Returns internal Decimal fields prefixed '_' for the caller to accumulate;
    caller pops them so they are never serialised.
    """
    bracket_size = bracket.get("size", 8)
    bracket_type = bracket.get("bracket_type", "Unknown").lower()
    actual_entries = count_bracket_entries(bracket)
    has_bye_slot = bracket_has_bye_slot(bracket)

    fee_per_entry = Decimal(
        str(entry_fees.get(bracket_type, entry_fees.get("scratch", 25.00)))
    )
    total_collected = Decimal(str(actual_entries)) * fee_per_entry

    if house_percentage and house_percentage > 0 and not has_bye_slot:
        house_take = (
            total_collected * Decimal(str(house_percentage)) / Decimal("100")
        ).quantize(CENT, rounding=ROUND_HALF_UP)
        prize_pool = total_collected - house_take
    else:
        house_take = Decimal("0")
        prize_pool = total_collected

    prize_pool = money_decimal(prize_pool)

    winners_info = extract_bracket_winners(bracket)
    winners = winners_info.get("winners", [])

    payout_percentages = DEFAULT_PRESETS.get(bracket_size, DEFAULT_PRESETS[8])

    # Detect split-pot finals tie: two place=1 entries both flagged split_pot
    split_pot_winners = [
        w for w in winners if w.get("place") == 1 and w.get("split_pot")
    ]
    is_split_pot = len(split_pot_winners) == 2

    calculated_winners = []
    for winner in winners:
        position = winner.get("position", "")
        if is_split_pot and winner.get("split_pot"):
            payout_1st = (
                prize_pool
                * Decimal(str(payout_percentages.get("1st", 0)))
                / Decimal("100")
            ).quantize(CENT, rounding=ROUND_HALF_UP)
            payout_2nd = (
                prize_pool
                * Decimal(str(payout_percentages.get("2nd", 0)))
                / Decimal("100")
            ).quantize(CENT, rounding=ROUND_HALF_UP)
            payout_amount = money_decimal((payout_1st + payout_2nd) / Decimal("2"))
            percentage = float(
                (payout_amount / prize_pool * Decimal("100")).quantize(
                    CENT, rounding=ROUND_HALF_UP
                )
            )
        else:
            percentage = payout_percentages.get(position.lower(), 0)
            if percentage <= 0:
                continue
            payout_amount = (
                prize_pool * Decimal(str(percentage)) / Decimal("100")
            ).quantize(CENT, rounding=ROUND_HALF_UP)
        calculated_winners.append(
            {
                **winner,
                "bracket_name": bracket_name,
                "payout_percentage": percentage,
                "payout_amount": money_float(payout_amount),
                "prize_pool_total": money_float(prize_pool),
            }
        )

    return {
        "bracket_name": bracket_name,
        "bracket_type": bracket_type,
        "bracket_size": bracket_size,
        "actual_entries": actual_entries,
        "prize_pool": money_float(prize_pool),
        "total_collected": money_float(total_collected),
        "house_take": money_float(house_take),
        "house_percentage": 0.0 if has_bye_slot else house_percentage,
        "has_bye_slot": has_bye_slot,
        "winners": calculated_winners,
        "payout_percentages": payout_percentages,
        "status": winners_info.get("status", "unknown"),
        # Internal Decimal fields — popped by caller, never serialised
        "_prize_pool_d": prize_pool,
        "_collected_d": total_collected,
        "_house_d": house_take,
    }


def get_tournament_winners_summary(brackets_data: dict[str, Any]) -> dict[str, Any]:
    """Get a summary of all tournament winners across all brackets."""
    all_winners = []

    for i, bracket in enumerate(brackets_data.get("scratch_brackets", [])):
        winners_info = extract_bracket_winners(bracket)
        for winner in winners_info.get("winners", []):
            winner["bracket_name"] = f"Scratch Bracket {i+1}"
            all_winners.append(winner)

    for i, bracket in enumerate(brackets_data.get("handicap_brackets", [])):
        winners_info = extract_bracket_winners(bracket)
        for winner in winners_info.get("winners", []):
            winner["bracket_name"] = f"Handicap Bracket {i+1}"
            all_winners.append(winner)

    winners_by_place: dict[int, list] = {}
    for winner in all_winners:
        place = winner.get("place")
        if place:
            winners_by_place.setdefault(place, []).append(winner)

    return {
        "total_winners": len(all_winners),
        "winners_by_place": winners_by_place,
        "all_winners": all_winners,
        "scratch_champions": [
            w
            for w in all_winners
            if w.get("bracket_type") == "Scratch" and w.get("place") == 1
        ],
        "handicap_champions": [
            w
            for w in all_winners
            if w.get("bracket_type") == "Handicap" and w.get("place") == 1
        ],
    }


def validate_payout_integrity(payout_data: dict[str, Any]) -> dict[str, Any]:
    """Validate that payout percentages balance within each bracket."""
    errors: list[str] = []
    warnings = []
    total_distributed = Decimal("0")
    total_pool = Decimal("0")

    try:
        all_brackets = payout_data.get("scratch_brackets", []) + payout_data.get(
            "handicap_brackets", []
        )
        for bp in all_brackets:
            pool = Decimal(str(bp.get("prize_pool", 0)))
            total_pool += pool
            distributed = Decimal("0")
            for winner in bp.get("winners", []):
                # payout_amount is always float here — wrap in str() for safety
                amt = Decimal(str(winner.get("payout_amount", 0)))
                distributed += amt
                total_distributed += amt
            diff = abs(pool - distributed)
            if diff > Decimal("0.05"):
                warnings.append(
                    f"{bp['bracket_name']}: pool ${pool} vs distributed ${distributed} (diff ${diff})"
                )

        return {
            "is_valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "total_distributed": money_float(total_distributed),
            "total_collected": money_float(total_pool),
        }

    except Exception as e:
        return {
            "is_valid": False,
            "errors": [f"Validation error: {e}"],
            "warnings": [],
            "total_distributed": 0.0,
            "total_collected": 0.0,
        }
