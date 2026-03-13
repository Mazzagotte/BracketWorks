"""
Simplified bracket generation service - cleaner and more readable
"""
import random
import time
import logging
from typing import List, Dict, Any, Set, Tuple, Optional
from sqlalchemy.orm import Session
from datetime import datetime

# Import advanced bracket generation
from .brackets_advanced import create_brackets_with_history, get_round_name

logger = logging.getLogger(__name__)

def generate_bracket_preview(size: int = 8) -> Dict[str, Any]:
    """Generate a simple bracket preview with placeholder players"""
    if size not in [4, 8, 16, 32, 64, 128]:
        raise ValueError("Bracket size must be 4, 8, 16, 32, 64, or 128")
    
    rounds = []
    current_size = size
    round_num = 1
    
    while current_size > 1:
        matches = []
        
        # Create matches for this round
        for i in range(0, current_size, 2):
            if round_num == 1:
                # First round - use seed numbers and placeholder names
                matches.append({
                    "seedA": i + 1,
                    "seedB": i + 2,
                    "playerA": f"Player {i + 1}",
                    "playerB": f"Player {i + 2}",
                    "qualifying_score_a": None,
                    "qualifying_score_b": None,
                    "match_score_a": None,
                    "match_score_b": None,
                    "winner": None,
                    "status": "pending"
                })
            else:
                # Later rounds - TBD placeholders
                matches.append({
                    "seedA": None,
                    "seedB": None,
                    "playerA": f"TBD",
                    "playerB": f"TBD",
                    "qualifying_score_a": None,
                    "qualifying_score_b": None,
                    "match_score_a": None,
                    "match_score_b": None,
                    "winner": None,
                    "status": "pending"
                })
        
        round_name = get_round_name(round_num, size)
        rounds.append({
            "name": round_name,
            "matches": matches
        })
        
        current_size = current_size // 2
        round_num += 1
    
    return {
        "size": size,
        "rounds": rounds
    }


def fetch_match_history(
    db: Session,
    bracket_type: str,
    tournament_id: Optional[int] = None,
    exclude_tournament_id: Optional[int] = None
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
        MatchHistory.round_number == 1  # Only first-round matches
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
        pair = (min(match.player_a_id, match.player_b_id), 
                max(match.player_a_id, match.player_b_id))
        history_set.add(pair)
    
    return history_set


def generate_tournament_brackets(
    players: List[Dict[str, Any]], 
    bracket_size: int = 8,
    db: Optional[Session] = None,
    tournament_id: Optional[int] = None,
    use_history: bool = True,
    seed: Optional[int] = None
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
            "scratch_brackets": [],
            "handicap_brackets": [],
            "summary": create_empty_summary(),
            "validation_warnings": {
                "skipped_scratch_players": [],
                "skipped_handicap_players": []
            }
        }
    
    # Separate and validate players by bracket type entries
    scratch_entries, skipped_scratch_players = create_scratch_entries(players)
    handicap_entries, skipped_handicap_players = create_handicap_entries(players)
    
    # Fetch match history if requested and database available
    scratch_history = set()
    handicap_history = set()
    
    if use_history and db is not None:
        try:
            scratch_history = fetch_match_history(
                db, 
                'scratch', 
                exclude_tournament_id=tournament_id
            )
            handicap_history = fetch_match_history(
                db,
                'handicap',
                exclude_tournament_id=tournament_id
            )
            logger.info(f"Loaded {len(scratch_history)} scratch history pairs")
            logger.info(f"Loaded {len(handicap_history)} handicap history pairs")
        except Exception as e:
            logger.warning(f"Could not load match history: {e}")
            # Fall back to no history
            scratch_history = set()
            handicap_history = set()
    
    # Log bracket generation info
    logger.info(f"Bracket generation started")
    logger.info(f"  Total players: {len(players)}")
    logger.info(f"  Scratch entries: {len(scratch_entries)}, Handicap entries: {len(handicap_entries)}")
    logger.info(f"  Bracket size: {bracket_size}")
    logger.info(f"  Expected brackets: Scratch={len(scratch_entries) // bracket_size}, Handicap={len(handicap_entries) // bracket_size}")
    logger.info(f"  Expected refunds: Scratch={len(scratch_entries) % bracket_size}, Handicap={len(handicap_entries) % bracket_size}")
    
    # START TIMING
    start_time = time.time()
    
    # Always use advanced algorithm (handles both history and no-history cases)
    has_history = len(scratch_history) > 0 or len(handicap_history) > 0
    logger.info(f"  Using constraint-based algorithm (history: {has_history})")
    
    scratch_start = time.time()
    scratch_brackets, leftover_scratch = create_brackets_with_history(
        scratch_entries, bracket_size, "Scratch", scratch_history, seed
    )
    scratch_time = time.time() - scratch_start
    logger.info(f"  Scratch brackets generated in {scratch_time:.3f}s")
    
    handicap_start = time.time()
    handicap_brackets, leftover_handicap = create_brackets_with_history(
        handicap_entries, bracket_size, "Handicap", handicap_history, seed
    )
    handicap_time = time.time() - handicap_start
    logger.info(f"  Handicap brackets generated in {handicap_time:.3f}s")
    
    # END TIMING
    total_time = time.time() - start_time
    logger.info(f"  Total generation time: {total_time:.3f}s")
    
    logger.info(f"Bracket generation complete: Scratch={len(scratch_brackets)}, Handicap={len(handicap_brackets)}")
    logger.debug(f"  Leftover entries: Scratch={len(leftover_scratch)}, Handicap={len(leftover_handicap)}")
    
    # Combine skipped players and leftover players for total refunds
    all_skipped_scratch = skipped_scratch_players + leftover_scratch
    all_skipped_handicap = skipped_handicap_players + leftover_handicap
    
    # Create summary statistics
    summary = create_bracket_summary(scratch_entries, handicap_entries, scratch_brackets, handicap_brackets)
    
    return {
        "scratch_brackets": scratch_brackets,
        "handicap_brackets": handicap_brackets,
        "summary": summary,
        "bracket_size": bracket_size,
        "validation_warnings": {
            "skipped_scratch_players": all_skipped_scratch,
            "skipped_handicap_players": all_skipped_handicap,
            "total_skipped": len(all_skipped_scratch) + len(all_skipped_handicap)
        }
    }


def create_scratch_entries(players: List[Dict[str, Any]]) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Create scratch entries from player data
    
    Returns:
        tuple: (valid_entries, skipped_players)
        - valid_entries: List of entries for bracket placement
        - skipped_players: List of players that were skipped with reasons
    """
    valid_entries = []
    skipped_players = []
    
    for player in players:
        # Get number of scratch brackets this player wants to enter
        scratch_count = player.get('scratch', 0)
        
        if scratch_count > 0:
            player_full_name = f"{player.get('firstName', '')} {player.get('lastName', '')}".strip()
            
            # Create entries for each bracket this player wants to enter
            for entry_num in range(scratch_count):
                valid_entries.append({
                    'player_id': player.get('id'),
                    'name': player_full_name,
                    'average': player.get('average', 0),
                    'entry_number': entry_num + 1,  # Track which entry (1, 2, 3, etc.)
                    'scores': player.get('scores', {})  # Include bowling scores
                })
    
    return valid_entries, skipped_players


def create_handicap_entries(players: List[Dict[str, Any]]) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Create handicap entries from player data
    
    Returns:
        tuple: (valid_entries, skipped_players)
        - valid_entries: List of entries for bracket placement
        - skipped_players: List of players that were skipped with reasons
    """
    valid_entries = []
    skipped_players = []
    
    for player in players:
        # Get number of handicap brackets this player wants to enter
        handicap_count = player.get('handicap', 0)
        
        if handicap_count > 0:
            player_full_name = f"{player.get('firstName', '')} {player.get('lastName', '')}".strip()
            
            # Create entries for each bracket this player wants to enter
            for entry_num in range(handicap_count):
                valid_entries.append({
                    'player_id': player.get('id'),
                    'name': player_full_name,
                    'average': player.get('average', 0),
                    'entry_number': entry_num + 1,  # Track which entry (1, 2, 3, etc.)
                    'scores': player.get('scores', {})  # Include bowling scores
                })
    
    return valid_entries, skipped_players


def create_bracket_summary(
    scratch_entries: List[Dict[str, Any]],
    handicap_entries: List[Dict[str, Any]], 
    scratch_brackets: List[Dict[str, Any]],
    handicap_brackets: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Create a summary of bracket generation results"""
    
    # Calculate placed entries (players who got into full brackets)
    scratch_placed = len(scratch_brackets) * (len(scratch_brackets[0]['rounds'][0]['matches']) * 2 if scratch_brackets else 0)
    handicap_placed = len(handicap_brackets) * (len(handicap_brackets[0]['rounds'][0]['matches']) * 2 if handicap_brackets else 0)
    
    return {
        "total_scratch_entries": len(scratch_entries),
        "total_handicap_entries": len(handicap_entries),
        "scratch_brackets_count": len(scratch_brackets),
        "handicap_brackets_count": len(handicap_brackets),
        "scratch_placed_entries": scratch_placed,
        "handicap_placed_entries": handicap_placed,
        "scratch_refund_entries": len(scratch_entries) - scratch_placed,
        "handicap_refund_entries": len(handicap_entries) - handicap_placed
    }


def create_empty_summary() -> Dict[str, Any]:
    """Create an empty summary when no players are provided"""
    return {
        "total_scratch_entries": 0,
        "total_handicap_entries": 0,
        "scratch_brackets_count": 0,
        "handicap_brackets_count": 0,
        "scratch_placed_entries": 0,
        "handicap_placed_entries": 0,
        "scratch_refund_entries": 0,
        "handicap_refund_entries": 0
    }


def update_match_score(
    brackets_data: Dict[str, Any],
    bracket_id: str,
    round_index: int,
    match_index: int,
    score_a: int,
    score_b: int
) -> Dict[str, Any]:
    """Update a match score and advance winners automatically
    
    Handles three scenarios:
    1. Player A wins (score_a > score_b) - advances Player A
    2. Player B wins (score_b > score_a) - advances Player B
    3. Tie (score_a == score_b) - marked as tied, handled by bracket_persistence_simple hydration
    """
    
    # Find the bracket and update the match
    if bracket_id.startswith('scratch_'):
        bracket_type = 'scratch_brackets'
        bracket_index = int(bracket_id.split('_')[1])
    elif bracket_id.startswith('handicap_'):
        bracket_type = 'handicap_brackets'
        bracket_index = int(bracket_id.split('_')[1])
    else:
        # Single bracket case
        if 'rounds' in brackets_data:
            match = brackets_data['rounds'][round_index]['matches'][match_index]
            match['match_score_a'] = score_a
            match['match_score_b'] = score_b
            
            # Check for winner or tie
            if score_a > score_b:
                match['winner'] = 'A'
                match['status'] = 'completed'
            elif score_b > score_a:
                match['winner'] = 'B'
                match['status'] = 'completed'
            else:
                # TIE - handled by bracket_persistence_simple hydration logic
                match['winner'] = None
                match['status'] = 'tied'
                
        return brackets_data
    
    # Multiple brackets case
    if (bracket_type in brackets_data and 
        bracket_index < len(brackets_data[bracket_type])):
        
        bracket = brackets_data[bracket_type][bracket_index]
        if (round_index < len(bracket['rounds']) and 
            match_index < len(bracket['rounds'][round_index]['matches'])):
            
            match = bracket['rounds'][round_index]['matches'][match_index]
            match['match_score_a'] = score_a
            match['match_score_b'] = score_b
            
            # Determine winner or tie
            if score_a > score_b:
                match['winner'] = 'A'
                match['status'] = 'completed'
                # Auto-advance winner to next round
                advance_winner_to_next_round(bracket, round_index, match_index, match['winner'])
            elif score_b > score_a:
                match['winner'] = 'B'
                match['status'] = 'completed'
                # Auto-advance winner to next round
                advance_winner_to_next_round(bracket, round_index, match_index, match['winner'])
            else:
                # TIE - handled by bracket_persistence_simple hydration logic
                match['winner'] = None
                match['status'] = 'tied'
    
    return brackets_data


def advance_winner_to_next_round(bracket: Dict[str, Any], round_index: int, match_index: int, winner: str):
    """Advance the winner of a match to the next round"""

    if round_index + 1 >= len(bracket['rounds']):
        return  # This was the final

    # Find which match in the next round this winner goes to
    next_round = bracket['rounds'][round_index + 1]
    next_match_index = match_index // 2

    if next_match_index < len(next_round['matches']):
        next_match = next_round['matches'][next_match_index]
        current_match = bracket['rounds'][round_index]['matches'][match_index]

        winner_name = current_match['playerA'] if winner == 'A' else current_match['playerB']
        winner_id   = current_match.get('playerA_id') if winner == 'A' else current_match.get('playerB_id')

        # Determine if this winner goes to playerA or playerB slot
        if match_index % 2 == 0:
            next_match['playerA']    = winner_name
            next_match['playerA_id'] = winner_id
        else:
            next_match['playerB']    = winner_name
            next_match['playerB_id'] = winner_id


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
    if not bracket.get('rounds'):
        validation_errors.append("Bracket is missing 'rounds' structure")
        return validation_errors  # Can't continue validation without rounds
    
    rounds = bracket['rounds']
    
    if len(rounds) == 0:
        validation_errors.append("Bracket has zero rounds")
        return validation_errors
    
    # Check 2: First round has correct number of matches
    first_round = rounds[0]
    if 'matches' not in first_round:
        validation_errors.append("First round is missing 'matches' structure")
        return validation_errors
    
    first_round_match_count = len(first_round['matches'])
    
    # Bracket size should be double the first round matches
    # e.g., 8-player bracket = 4 first-round matches
    inferred_bracket_size = first_round_match_count * 2
    
    # Check 3: Each round has half the matches of the previous round
    for round_index in range(1, len(rounds)):
        previous_round = rounds[round_index - 1]
        current_round = rounds[round_index]
        
        if 'matches' not in current_round:
            validation_errors.append(f"Round {round_index + 1} is missing 'matches' structure")
            continue
        
        previous_match_count = len(previous_round['matches'])
        current_match_count = len(current_round['matches'])
        expected_match_count = previous_match_count // 2
        
        if current_match_count != expected_match_count:
            validation_errors.append(
                f"Round {round_index + 1} should have {expected_match_count} matches "
                f"(half of previous round's {previous_match_count}), but has {current_match_count}"
            )
    
    # Check 4: Final round has exactly 1 match
    final_round = rounds[-1]
    if 'matches' in final_round:
        final_match_count = len(final_round['matches'])
        if final_match_count != 1:
            validation_errors.append(
                f"Final round should have exactly 1 match, but has {final_match_count}"
            )
    
    # Check 5: All first-round matches have player names assigned
    for match_index, match in enumerate(first_round['matches']):
        player_a_name = match.get('playerA')
        player_b_name = match.get('playerB')
        
        if not player_a_name or player_a_name == 'TBD':
            validation_errors.append(
                f"First round match {match_index + 1} is missing Player A name"
            )
        
        if not player_b_name or player_b_name == 'TBD':
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
    scratch_brackets = brackets_data.get('scratch_brackets', [])
    for bracket_index, bracket in enumerate(scratch_brackets):
        bracket_errors = validate_bracket_structure(bracket)
        if bracket_errors:
            for error in bracket_errors:
                all_validation_errors.append(f"Scratch Bracket {bracket_index + 1}: {error}")
    
    # Validate handicap brackets
    handicap_brackets = brackets_data.get('handicap_brackets', [])
    for bracket_index, bracket in enumerate(handicap_brackets):
        bracket_errors = validate_bracket_structure(bracket)
        if bracket_errors:
            for error in bracket_errors:
                all_validation_errors.append(f"Handicap Bracket {bracket_index + 1}: {error}")
    
    # Add warnings for skipped players (from validation_warnings in brackets_data)
    validation_data = brackets_data.get('validation_warnings', {})
    skipped_scratch = validation_data.get('skipped_scratch_players', [])
    skipped_handicap = validation_data.get('skipped_handicap_players', [])
    
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
        validation_warnings.append("No brackets were generated. This may indicate insufficient players or all players were skipped.")
    
    return {
        'is_valid': len(all_validation_errors) == 0,
        'errors': all_validation_errors,
        'warnings': validation_warnings
    }