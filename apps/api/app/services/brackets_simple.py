"""Simplified bracket generation service used by API orchestration."""

import time
import logging
from typing import List, Dict, Any, Set, Tuple, Optional
from sqlalchemy.orm import Session

# Import advanced bracket generation
from .brackets_advanced import create_brackets_with_history, get_round_name
from .brackets_experimental import ExperimentalConfig, generate_brackets_experimental
from ..core.bracket_programs import (
    is_program_allowed_for_division,
    normalize_bowler_bracket_entries,
    normalize_bracket_programs,
)

logger = logging.getLogger(__name__)


def generate_bracket_preview(size: int = 8) -> Dict[str, Any]:
    """Generate a simple bracket preview with placeholder players"""
    if size != 8:
        raise ValueError("Bracket size must be 8 for three-game sets")

    rounds = []
    current_size = size
    round_num = 1

    while current_size > 1:
        matches = []

        # Create matches for this round
        for i in range(0, current_size, 2):
            if round_num == 1:
                # First round - use seed numbers and placeholder names
                matches.append(
                    {
                        "seedA": i + 1,
                        "seedB": i + 2,
                        "playerA": f"Player {i + 1}",
                        "playerB": f"Player {i + 2}",
                        "qualifying_score_a": None,
                        "qualifying_score_b": None,
                        "match_score_a": None,
                        "match_score_b": None,
                        "winner": None,
                        "status": "pending",
                    }
                )
            else:
                # Later rounds - TBD placeholders
                matches.append(
                    {
                        "seedA": None,
                        "seedB": None,
                        "playerA": "TBD",
                        "playerB": "TBD",
                        "qualifying_score_a": None,
                        "qualifying_score_b": None,
                        "match_score_a": None,
                        "match_score_b": None,
                        "winner": None,
                        "status": "pending",
                    }
                )

        round_name = get_round_name(round_num, size)
        rounds.append({"name": round_name, "matches": matches})

        current_size = current_size // 2
        round_num += 1

    return {"size": size, "rounds": rounds}


def fetch_match_history(
    db: Session,
    bracket_type: str,
    tournament_id: Optional[int] = None,
    exclude_tournament_id: Optional[int] = None,
) -> Set[Tuple[int, int]]:
    """
    Fetch historical first-round matchups from database.

    Args:
        db: Database session
        bracket_type: 'scratch' or 'handicap'
        tournament_id: If provided, only get history from this tournament
        exclude_tournament_id: If provided, exclude this tournament's history

    Returns:
        Set of (player_a_id, player_b_id) tuples (normalized to min, max)
    """
    from ..core.models import MatchHistory

    # Build query
    query = db.query(MatchHistory).filter(
        MatchHistory.bracket_type == bracket_type,
        MatchHistory.round_number == 1,  # Only first-round matches
    )

    if tournament_id is not None:
        query = query.filter(MatchHistory.tournament_id == tournament_id)

    if exclude_tournament_id is not None:
        query = query.filter(MatchHistory.tournament_id != exclude_tournament_id)

    # Fetch all matches
    matches = query.all()

    # Build history set with normalized pairs
    history_set = set()
    for match in matches:
        pair = (
            min(match.player_a_id, match.player_b_id),
            max(match.player_a_id, match.player_b_id),
        )
        history_set.add(pair)

    return history_set


def generate_tournament_brackets(
    players: List[Dict[str, Any]],
    bracket_size: int = 8,
    db: Optional[Session] = None,
    tournament_id: Optional[int] = None,
    bracket_programs: Optional[List[Dict[str, Any]]] = None,
    use_history: bool = True,
    seed: Optional[int] = None,
    use_experimental_optimizer: bool = False,
    experimental_attempts: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Generate tournament brackets from actual player data with validation.

    Args:
        players: List of player dictionaries with scores
        bracket_size: Number of players per bracket (4, 8, 16, 32, 64, or 128)
        db: Database session (optional, for match history)
        tournament_id: Current tournament ID (optional, for excluding from history)
        use_history: Whether to use match history for constraint-based pairing
        seed: Optional RNG seed for reproducible brackets

    Returns:
        Dictionary containing:
        - scratch_brackets: List of generated scratch brackets
        - handicap_brackets: List of generated handicap brackets
        - summary: Statistics about bracket generation
        - validation_warnings: Information about skipped players (if any)
    """
    if not players:
        return {
            "bracket_groups": [],
            "scratch_brackets": [],
            "handicap_brackets": [],
            "summary": create_empty_summary(),
            "validation_warnings": {
                "skipped_scratch_players": [],
                "skipped_handicap_players": [],
                "by_program": {},
            },
        }

    programs = normalize_bracket_programs(bracket_programs)

    logger.info("Bracket generation started")
    logger.info(f"  Total players: {len(players)}")
    logger.info(f"  Bracket size: {bracket_size}")

    start_time = time.time()

    bracket_groups: List[Dict[str, Any]] = []
    validation_by_program: Dict[str, List[Dict[str, Any]]] = {}
    experimental_debug: Dict[str, Any] = {}

    for program in programs:
        if not program.get("enabled", True):
            continue

        entries, skipped_players = create_entries_for_program(players, program)
        history_key = program["key"][:20]
        history_set: Set[Tuple[int, int]] = set()

        if use_history and db is not None:
            try:
                history_set = fetch_match_history(
                    db,
                    history_key,
                    exclude_tournament_id=tournament_id,
                )
            except Exception as error:
                logger.warning(
                    f"Could not load match history for {program['key']}: {error}"
                )

        group_start = time.time()
        group_debug: Dict[str, Any] = {
            "mode": "standard",
            "attempts": 1,
        }

        if use_experimental_optimizer:
            try:
                cfg = ExperimentalConfig(
                    attempts=max(1, int(experimental_attempts or 4)),
                )
                exp_result = generate_brackets_experimental(
                    entries=entries,
                    bracket_size=bracket_size,
                    bracket_type=program["name"],
                    history_set=history_set,
                    seed=seed,
                    allow_single_bye_per_bracket=bool(program.get("allow_byes", False)),
                    config=cfg,
                )
                brackets = exp_result.brackets
                leftover_players = exp_result.leftovers
                group_debug = {
                    "mode": "experimental",
                    "attempts": exp_result.attempts_evaluated,
                    "selected_seed": exp_result.selected_seed,
                    "placed_entries": exp_result.selected.placed_entries,
                    "refunded_entries": exp_result.selected.refunded_entries,
                    "unique_pairs": exp_result.selected.unique_pairs,
                    "max_refunds_single_player": exp_result.selected.max_refunds_single_player,
                    "refund_variance": exp_result.selected.refund_variance,
                    "cap_violations": exp_result.selected.cap_violations,
                    "cap_feasible": exp_result.selected.feasible_under_cap,
                    "score": exp_result.selected.score,
                }
            except Exception as error:
                logger.exception(
                    "Experimental bracket optimizer failed for %s; using standard generation",
                    program["key"],
                )
                brackets, leftover_players = create_brackets_with_history(
                    entries,
                    bracket_size,
                    program["name"],
                    history_set,
                    seed,
                    allow_single_bye_per_bracket=bool(program.get("allow_byes", False)),
                )
                group_debug = {
                    "mode": "standard_fallback",
                    "attempts": 0,
                    "fallback_reason": str(error),
                }
        else:
            brackets, leftover_players = create_brackets_with_history(
                entries,
                bracket_size,
                program["name"],
                history_set,
                seed,
                allow_single_bye_per_bracket=bool(program.get("allow_byes", False)),
            )

        experimental_debug[program["key"]] = group_debug
        logger.info(
            "  %s brackets generated in %.3fs (%s entries, %s brackets, %s refunds)",
            program["name"],
            time.time() - group_start,
            len(entries),
            len(brackets),
            len(leftover_players),
        )

        placed_entries = calculate_placed_entries(brackets)
        all_skipped = skipped_players + leftover_players
        validation_by_program[program["key"]] = all_skipped

        bracket_groups.append(
            {
                "key": program["key"],
                "name": program["name"],
                "division": program["division"],
                "scoring_mode": program["scoring_mode"],
                "allow_byes": bool(program.get("allow_byes", False)),
                "entry_fee": program.get("entry_fee"),
                "display_order": program["display_order"],
                "brackets": brackets,
                "entries_count": len(entries),
                "placed_entries": placed_entries,
                "refund_entries": len(entries) - placed_entries,
                "skipped_players": all_skipped,
                "generation_debug": group_debug,
            }
        )

    total_time = time.time() - start_time
    logger.info(f"  Total generation time: {total_time:.3f}s")

    scratch_group = next(
        (group for group in bracket_groups if group["key"] == "scratch"), None
    )
    handicap_group = next(
        (group for group in bracket_groups if group["key"] == "handicap"), None
    )
    summary = create_bracket_summary_from_groups(bracket_groups)

    return {
        "bracket_groups": bracket_groups,
        "scratch_brackets": scratch_group["brackets"] if scratch_group else [],
        "handicap_brackets": handicap_group["brackets"] if handicap_group else [],
        "summary": summary,
        "bracket_size": bracket_size,
        "generation_mode": "experimental" if use_experimental_optimizer else "standard",
        "generation_debug": {
            "experimental_enabled": use_experimental_optimizer,
            "programs": experimental_debug,
        },
        "validation_warnings": {
            "skipped_scratch_players": validation_by_program.get("scratch", []),
            "skipped_handicap_players": validation_by_program.get("handicap", []),
            "by_program": validation_by_program,
            "total_skipped": sum(
                len(items) for items in validation_by_program.values()
            ),
        },
    }


def create_entries_for_program(
    players: List[Dict[str, Any]],
    program: Dict[str, Any],
) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    valid_entries: List[Dict[str, Any]] = []
    skipped_players: List[Dict[str, Any]] = []

    for player in players:
        if not is_program_allowed_for_division(
            program.get("division"), player.get("division")
        ):
            continue

        player_entries = normalize_bowler_bracket_entries(
            player.get("bracket_entries"),
            handicap_entries=player.get("handicap"),
            scratch_entries=player.get("scratch"),
        )
        entry_count = max(0, int(player_entries.get(program["key"], 0)))

        if entry_count <= 0:
            continue

        player_full_name = (
            f"{player.get('firstName', '')} {player.get('lastName', '')}".strip()
        )
        for entry_num in range(entry_count):
            valid_entries.append(
                {
                    "player_id": player.get("id"),
                    "name": player_full_name,
                    "average": player.get("average", 0),
                    "entry_number": entry_num + 1,
                    "scores": player.get("scores", {}),
                }
            )

    return valid_entries, skipped_players


def calculate_placed_entries(brackets: List[Dict[str, Any]]) -> int:
    if not brackets:
        return 0

    placed = 0
    for bracket in brackets:
        rounds = bracket.get("rounds") or []
        if not rounds:
            continue
        for match in rounds[0].get("matches", []):
            if str(match.get("playerA") or "").strip().upper() != "BYE":
                placed += 1
            if str(match.get("playerB") or "").strip().upper() != "BYE":
                placed += 1
    return placed


def create_bracket_summary_from_groups(
    bracket_groups: List[Dict[str, Any]],
) -> Dict[str, Any]:
    scratch_group = next(
        (group for group in bracket_groups if group["key"] == "scratch"), None
    )
    handicap_group = next(
        (group for group in bracket_groups if group["key"] == "handicap"), None
    )

    total_entries = sum(group.get("entries_count", 0) for group in bracket_groups)
    total_brackets = sum(len(group.get("brackets", [])) for group in bracket_groups)

    return {
        "total_entries": total_entries,
        "total_bracket_groups": len(bracket_groups),
        "total_brackets": total_brackets,
        "group_summaries": [
            {
                "key": group["key"],
                "name": group["name"],
                "entries_count": group.get("entries_count", 0),
                "brackets_count": len(group.get("brackets", [])),
                "placed_entries": group.get("placed_entries", 0),
                "refund_entries": group.get("refund_entries", 0),
            }
            for group in bracket_groups
        ],
        "total_scratch_entries": scratch_group["entries_count"] if scratch_group else 0,
        "total_handicap_entries": (
            handicap_group["entries_count"] if handicap_group else 0
        ),
        "scratch_brackets_count": (
            len(scratch_group["brackets"]) if scratch_group else 0
        ),
        "handicap_brackets_count": (
            len(handicap_group["brackets"]) if handicap_group else 0
        ),
        "scratch_placed_entries": (
            scratch_group["placed_entries"] if scratch_group else 0
        ),
        "handicap_placed_entries": (
            handicap_group["placed_entries"] if handicap_group else 0
        ),
        "scratch_refund_entries": (
            scratch_group["refund_entries"] if scratch_group else 0
        ),
        "handicap_refund_entries": (
            handicap_group["refund_entries"] if handicap_group else 0
        ),
    }


def create_empty_summary() -> Dict[str, Any]:
    """Create an empty summary when no players are provided"""
    return {
        "total_entries": 0,
        "total_bracket_groups": 0,
        "total_brackets": 0,
        "group_summaries": [],
        "total_scratch_entries": 0,
        "total_handicap_entries": 0,
        "scratch_brackets_count": 0,
        "handicap_brackets_count": 0,
        "scratch_placed_entries": 0,
        "handicap_placed_entries": 0,
        "scratch_refund_entries": 0,
        "handicap_refund_entries": 0,
    }


def update_match_score(
    brackets_data: Dict[str, Any],
    bracket_id: str,
    round_index: int,
    match_index: int,
    score_a: int,
    score_b: int,
) -> Dict[str, Any]:
    """Update a match score and advance winners automatically

    Handles three scenarios:
    1. Player A wins (score_a > score_b) - advances Player A
    2. Player B wins (score_b > score_a) - advances Player B
    3. Tie (score_a == score_b) - marked as tied, handled by bracket_persistence_simple hydration
    """

    if bracket_id.startswith("group:"):
        _, group_key, bracket_index_text = bracket_id.split(":", 2)
        bracket_group = next(
            (
                group
                for group in brackets_data.get("bracket_groups", [])
                if group.get("key") == group_key
            ),
            None,
        )
        if bracket_group and int(bracket_index_text) < len(
            bracket_group.get("brackets", [])
        ):
            bracket = bracket_group["brackets"][int(bracket_index_text)]
            if round_index < len(bracket["rounds"]) and match_index < len(
                bracket["rounds"][round_index]["matches"]
            ):
                match = bracket["rounds"][round_index]["matches"][match_index]
                match["match_score_a"] = score_a
                match["match_score_b"] = score_b
                if score_a > score_b:
                    match["winner"] = "A"
                    match["status"] = "completed"
                    advance_winner_to_next_round(
                        bracket, round_index, match_index, match["winner"]
                    )
                elif score_b > score_a:
                    match["winner"] = "B"
                    match["status"] = "completed"
                    advance_winner_to_next_round(
                        bracket, round_index, match_index, match["winner"]
                    )
                else:
                    match["winner"] = None
                    is_final_round = round_index == len(bracket.get("rounds", [])) - 1
                    if is_final_round:
                        match["status"] = "completed"
                        match["both_advance"] = False
                        match["split_pot"] = True
                    else:
                        match["status"] = "both_advance"
                        match["both_advance"] = True
                        match["split_pot"] = False
        return brackets_data

    # Find the bracket and update the match
    if bracket_id.startswith("scratch_"):
        bracket_type = "scratch_brackets"
        bracket_index = int(bracket_id.split("_")[1])
    elif bracket_id.startswith("handicap_"):
        bracket_type = "handicap_brackets"
        bracket_index = int(bracket_id.split("_")[1])
    else:
        # Single bracket case
        if "rounds" in brackets_data:
            match = brackets_data["rounds"][round_index]["matches"][match_index]
            match["match_score_a"] = score_a
            match["match_score_b"] = score_b

            # Check for winner or tie
            if score_a > score_b:
                match["winner"] = "A"
                match["status"] = "completed"
            elif score_b > score_a:
                match["winner"] = "B"
                match["status"] = "completed"
            else:
                # Tie semantics should match hydration logic for immediate UI consistency.
                match["winner"] = None
                is_final_round = round_index == len(brackets_data.get("rounds", [])) - 1
                if is_final_round:
                    match["status"] = "completed"
                    match["both_advance"] = False
                    match["split_pot"] = True
                else:
                    match["status"] = "both_advance"
                    match["both_advance"] = True
                    match["split_pot"] = False

        return brackets_data

    # Multiple brackets case
    if bracket_type in brackets_data and bracket_index < len(
        brackets_data[bracket_type]
    ):

        bracket = brackets_data[bracket_type][bracket_index]
        if round_index < len(bracket["rounds"]) and match_index < len(
            bracket["rounds"][round_index]["matches"]
        ):

            match = bracket["rounds"][round_index]["matches"][match_index]
            match["match_score_a"] = score_a
            match["match_score_b"] = score_b

            # Determine winner or tie
            if score_a > score_b:
                match["winner"] = "A"
                match["status"] = "completed"
                # Auto-advance winner to next round
                advance_winner_to_next_round(
                    bracket, round_index, match_index, match["winner"]
                )
            elif score_b > score_a:
                match["winner"] = "B"
                match["status"] = "completed"
                # Auto-advance winner to next round
                advance_winner_to_next_round(
                    bracket, round_index, match_index, match["winner"]
                )
            else:
                # Tie semantics should match hydration logic for immediate UI consistency.
                match["winner"] = None
                is_final_round = round_index == len(bracket.get("rounds", [])) - 1
                if is_final_round:
                    match["status"] = "completed"
                    match["both_advance"] = False
                    match["split_pot"] = True
                else:
                    match["status"] = "both_advance"
                    match["both_advance"] = True
                    match["split_pot"] = False

    return brackets_data


def advance_winner_to_next_round(
    bracket: Dict[str, Any], round_index: int, match_index: int, winner: str
):
    """Advance the winner of a match to the next round"""

    if round_index + 1 >= len(bracket["rounds"]):
        return  # This was the final

    # Find which match in the next round this winner goes to
    next_round = bracket["rounds"][round_index + 1]
    next_match_index = match_index // 2

    if next_match_index < len(next_round["matches"]):
        next_match = next_round["matches"][next_match_index]
        current_match = bracket["rounds"][round_index]["matches"][match_index]

        winner_name = (
            current_match["playerA"] if winner == "A" else current_match["playerB"]
        )
        winner_id = (
            current_match.get("playerA_id")
            if winner == "A"
            else current_match.get("playerB_id")
        )

        # Determine if this winner goes to playerA or playerB slot
        if match_index % 2 == 0:
            next_match["playerA"] = winner_name
            next_match["playerA_id"] = winner_id
        else:
            next_match["playerB"] = winner_name
            next_match["playerB_id"] = winner_id


def validate_bracket_structure(bracket: Dict[str, Any]) -> List[str]:
    """Validate a single bracket for logical errors and structural integrity

    Checks:
    1. Bracket has rounds structure
    2. First round has correct number of matches for bracket size
    3. Each subsequent round has half the matches of the previous round
    4. Final round has exactly 1 match
    5. All first-round matches have player names assigned

    Args:
        bracket: A single bracket dictionary

    Returns:
        List of error messages (empty list if no errors)
    """
    validation_errors = []

    # Check 1: Bracket has rounds structure
    if not bracket.get("rounds"):
        validation_errors.append("Bracket is missing 'rounds' structure")
        return validation_errors  # Can't continue validation without rounds

    rounds = bracket["rounds"]

    if len(rounds) == 0:
        validation_errors.append("Bracket has zero rounds")
        return validation_errors

    # Check 2: First round has correct number of matches
    first_round = rounds[0]
    if "matches" not in first_round:
        validation_errors.append("First round is missing 'matches' structure")
        return validation_errors

    # Check 3: Each round has half the matches of the previous round
    for round_index in range(1, len(rounds)):
        previous_round = rounds[round_index - 1]
        current_round = rounds[round_index]

        if "matches" not in current_round:
            validation_errors.append(
                f"Round {round_index + 1} is missing 'matches' structure"
            )
            continue

        previous_match_count = len(previous_round["matches"])
        current_match_count = len(current_round["matches"])
        expected_match_count = previous_match_count // 2

        if current_match_count != expected_match_count:
            validation_errors.append(
                f"Round {round_index + 1} should have {expected_match_count} matches "
                f"(half of previous round's {previous_match_count}), but has {current_match_count}"
            )

    # Check 4: Final round has exactly 1 match
    final_round = rounds[-1]
    if "matches" in final_round:
        final_match_count = len(final_round["matches"])
        if final_match_count != 1:
            validation_errors.append(
                f"Final round should have exactly 1 match, but has {final_match_count}"
            )

    # Check 5: All first-round matches have player names assigned
    for match_index, match in enumerate(first_round["matches"]):
        player_a_name = match.get("playerA")
        player_b_name = match.get("playerB")

        if not player_a_name or player_a_name == "TBD":
            validation_errors.append(
                f"First round match {match_index + 1} is missing Player A name"
            )

        if not player_b_name or player_b_name == "TBD":
            validation_errors.append(
                f"First round match {match_index + 1} is missing Player B name"
            )

    return validation_errors


def validate_all_brackets(brackets_data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate entire bracket structure before saving to database

    Validates all scratch and handicap brackets for structural integrity
    and logical consistency.

    Args:
        brackets_data: Full bracket data structure with scratch and handicap brackets

    Returns:
        Dictionary with validation results:
        {
            'is_valid': bool,
            'errors': List[str],
            'warnings': List[str]
        }
    """
    all_validation_errors = []
    validation_warnings = []

    # Validate scratch brackets
    scratch_brackets = brackets_data.get("scratch_brackets", [])
    for bracket_index, bracket in enumerate(scratch_brackets):
        bracket_errors = validate_bracket_structure(bracket)
        if bracket_errors:
            for error in bracket_errors:
                all_validation_errors.append(
                    f"Scratch Bracket {bracket_index + 1}: {error}"
                )

    # Validate handicap brackets
    handicap_brackets = brackets_data.get("handicap_brackets", [])
    for bracket_index, bracket in enumerate(handicap_brackets):
        bracket_errors = validate_bracket_structure(bracket)
        if bracket_errors:
            for error in bracket_errors:
                all_validation_errors.append(
                    f"Handicap Bracket {bracket_index + 1}: {error}"
                )

    # Add warnings for skipped players (from validation_warnings in brackets_data)
    validation_data = brackets_data.get("validation_warnings", {})
    skipped_scratch = validation_data.get("skipped_scratch_players", [])
    skipped_handicap = validation_data.get("skipped_handicap_players", [])

    if skipped_scratch:
        validation_warnings.append(
            f"{len(skipped_scratch)} player(s) skipped from scratch brackets due to invalid/missing scores"
        )

    if skipped_handicap:
        validation_warnings.append(
            f"{len(skipped_handicap)} player(s) skipped from handicap brackets due to invalid/missing scores"
        )

    # Check if there are any brackets at all
    if not scratch_brackets and not handicap_brackets:
        validation_warnings.append(
            "No brackets were generated. This may indicate insufficient players or all players were skipped."
        )

    return {
        "is_valid": len(all_validation_errors) == 0,
        "errors": all_validation_errors,
        "warnings": validation_warnings,
    }
