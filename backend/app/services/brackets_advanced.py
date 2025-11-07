"""
Advanced bracket generation with constraint-based pairing and rematch prevention.

This module implements a sophisticated bracket generation algorithm that:
1. Prevents players from facing previous opponents in first rounds (via historySet)
2. Uses backtracking to find valid pairings under constraints
3. Attempts cross-bracket swaps to salvage failing brackets
4. Supports deterministic RNG for reproducible results
5. Handles refunds for players who cannot be placed

Algorithm based on constraint satisfaction with randomized backtracking.
"""
import random
from typing import List, Dict, Any, Set, Tuple, Optional
from datetime import datetime


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def is_power_of_two(n: int) -> bool:
    """Check if n is a power of 2"""
    return n > 0 and (n & (n - 1)) == 0


def dedupe_by_id(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Remove duplicate player IDs, preserving first occurrence.
    Prevents same player from appearing twice in one bracket.
    """
    seen_ids = set()
    unique = []
    for entry in entries:
        player_id = entry.get('player_id')
        if player_id not in seen_ids:
            seen_ids.add(player_id)
            unique.append(entry)
    return unique


def fisher_yates_shuffle(items: List[Any], rng: random.Random) -> List[Any]:
    """
    Fisher-Yates shuffle using provided RNG.
    Returns a new shuffled list without modifying original.
    """
    shuffled = items.copy()
    n = len(shuffled)
    for i in range(n - 1, 0, -1):
        j = rng.randint(0, i)
        shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
    return shuffled


def normalize_pair(a: int, b: int) -> Tuple[int, int]:
    """
    Normalize a pair to (min, max) for consistent comparison.
    Example: (5, 3) -> (3, 5)
    """
    return (min(a, b), max(a, b))


def is_forbidden(player_a_id: int, player_b_id: int, history_set: Set[Tuple[int, int]]) -> bool:
    """
    Check if a pairing is forbidden based on match history.
    Uses normalized pairs for lookups.
    """
    pair = normalize_pair(player_a_id, player_b_id)
    return pair in history_set


def get_round_name(round_num: int, bracket_size: int) -> str:
    """Get the proper name for a tournament round"""
    total_rounds = bracket_size.bit_length() - 1
    
    if round_num == total_rounds:
        return "Final"
    elif round_num == total_rounds - 1:
        return "Semifinal"
    elif round_num == total_rounds - 2:
        return "Quarterfinal"
    else:
        return f"Round {round_num}"


# ============================================================================
# BACKTRACKING PAIRING ALGORITHM
# ============================================================================

def backtrack_make_pairs(
    pool: List[Dict[str, Any]],
    pairs: List[Dict[str, Any]],
    history_set: Set[Tuple[int, int]],
    rng: random.Random
) -> bool:
    """
    Recursive backtracking to create perfect matching with constraints.
    
    Args:
        pool: Remaining unmatched players
        pairs: List of completed pairings (modified in place)
        history_set: Set of forbidden (player_a_id, player_b_id) pairs
        rng: Random number generator for shuffled partner selection
    
    Returns:
        True if valid matching found, False if dead end
    """
    # Base case: all players matched
    if len(pool) == 0:
        return True
    
    # Take first player from pool
    player_a = pool.pop(0)
    player_a_id = player_a['player_id']
    
    # Find all allowed partners (not forbidden with player_a)
    allowed_indices = []
    for i, player_b in enumerate(pool):
        player_b_id = player_b['player_id']
        if not is_forbidden(player_a_id, player_b_id, history_set):
            allowed_indices.append(i)
    
    # Shuffle allowed partners for randomness
    allowed_indices = fisher_yates_shuffle(allowed_indices, rng)
    
    # Try each allowed partner
    for idx in allowed_indices:
        # Remove partner from pool
        player_b = pool.pop(idx)
        
        # Create pairing
        pairs.append({
            'home': player_a,
            'away': player_b
        })
        
        # Recurse
        if backtrack_make_pairs(pool, pairs, history_set, rng):
            return True
        
        # Backtrack: undo pairing and restore pool
        pairs.pop()
        pool.insert(idx, player_b)
    
    # Dead end for this player_a - restore to pool
    pool.insert(0, player_a)
    return False


def pair_with_constraints(
    entrants: List[Dict[str, Any]],
    bracket_size: int,
    history_set: Set[Tuple[int, int]],
    rng: random.Random,
    max_attempts: int = 1500
) -> Tuple[bool, List[Dict[str, Any]]]:
    """
    Attempt to create valid first-round pairings with constraints.
    Tries multiple shuffles + backtracking to find solution.
    
    Args:
        entrants: List of player entries for this bracket
        bracket_size: Expected bracket size (must match len(entrants))
        history_set: Set of forbidden pairings
        rng: Random number generator
        max_attempts: Maximum number of shuffle+backtrack attempts
    
    Returns:
        (success: bool, pairings: List[Dict])
    """
    if len(entrants) != bracket_size:
        return False, []
    
    # Start with shuffled base
    base = fisher_yates_shuffle(entrants, rng)
    
    for attempt in range(max_attempts):
        pool = base.copy()
        pairs = []
        
        if backtrack_make_pairs(pool, pairs, history_set, rng):
            return True, pairs
        
        # Reshuffle and try again
        base = fisher_yates_shuffle(base, rng)
    
    return False, []


def first_round_feasible(
    entrants: List[Dict[str, Any]],
    bracket_size: int,
    history_set: Set[Tuple[int, int]],
    rng: random.Random,
    trials: int = 200
) -> bool:
    """
    Check if first-round pairing is feasible (used for swap validation).
    Lighter weight than full pair_with_constraints.
    """
    if len(entrants) != bracket_size:
        return False
    
    for _ in range(trials):
        pool = fisher_yates_shuffle(entrants, rng)
        if backtrack_make_pairs(pool.copy(), [], history_set, rng):
            return True
    
    return False


# ============================================================================
# CROSS-BRACKET SWAP RESCUE
# ============================================================================

def pick_donor_group_index(
    groups: List[List[Dict[str, Any]]],
    fail_idx: int,
    leftovers: List[Dict[str, Any]],
    rng: random.Random
) -> int:
    """
    Select a donor group for swap rescue.
    Prefers another full group; falls back to leftovers (-1).
    """
    candidates = [i for i in range(len(groups)) if i != fail_idx]
    if candidates:
        return rng.choice(candidates)
    return -1  # Use leftovers


def attempt_swap_rescue(
    failing_group: List[Dict[str, Any]],
    donor_group: List[Dict[str, Any]],
    bracket_size: int,
    history_set: Set[Tuple[int, int]],
    rng: random.Random,
    is_donor_leftovers: bool = False
) -> Tuple[bool, Optional[List[Dict[str, Any]]]]:
    """
    Attempt to fix a failing group by swapping players with a donor group.
    
    Returns:
        (success: bool, valid_pairings: Optional[List])
    """
    # Can't swap if no donors available
    if not donor_group or not failing_group:
        return False, None
    
    max_swap_attempts = 25
    
    for _ in range(max_swap_attempts):
        # Pick random players to swap
        player_a = rng.choice(failing_group)
        player_b = rng.choice(donor_group)
        
        if player_a['player_id'] == player_b['player_id']:
            continue
        
        # Temporarily swap
        failing_group.remove(player_a)
        failing_group.append(player_b)
        donor_group.remove(player_b)
        donor_group.append(player_a)
        
        # Validate failing group
        ok_failing, pairings = pair_with_constraints(
            failing_group,
            bracket_size,
            history_set,
            rng,
            max_attempts=200
        )
        
        # Validate donor group (if it's a full bracket)
        ok_donor = True
        if not is_donor_leftovers and len(donor_group) == bracket_size:
            ok_donor = first_round_feasible(
                donor_group,
                bracket_size,
                history_set,
                rng,
                trials=200
            )
        
        if ok_failing and ok_donor:
            return True, pairings
        
        # Revert swap
        failing_group.remove(player_b)
        failing_group.append(player_a)
        donor_group.remove(player_a)
        donor_group.append(player_b)
    
    return False, None


# ============================================================================
# SINGLE BRACKET CREATION
# ============================================================================

def create_single_bracket_from_pairings(
    pairings: List[Dict[str, Any]],
    title: str,
    bracket_size: int
) -> Dict[str, Any]:
    """
    Create a complete bracket structure from first-round pairings.
    Builds all rounds with TBD placeholders for later rounds.
    """
    # Create first round matches from pairings
    first_round_matches = []
    for i, pairing in enumerate(pairings):
        home_player = pairing['home']
        away_player = pairing['away']
        
        first_round_matches.append({
            "seedA": i * 2 + 1,
            "seedB": i * 2 + 2,
            "playerA": home_player['name'],
            "playerB": away_player['name'],
            "playerA_id": home_player['player_id'],
            "playerB_id": away_player['player_id'],
            "match_score_a": None,
            "match_score_b": None,
            "winner": None,
            "status": "pending"
        })
    
    # Build all rounds
    rounds = []
    current_matches = first_round_matches
    round_num = 1
    
    while len(current_matches) > 0:
        round_name = get_round_name(round_num, bracket_size)
        rounds.append({
            "name": round_name,
            "matches": current_matches.copy()
        })
        
        if len(current_matches) == 1:
            break
        
        # Create next round with TBD players
        next_matches = []
        for i in range(0, len(current_matches), 2):
            if i + 1 < len(current_matches):
                next_matches.append({
                    "seedA": None,
                    "seedB": None,
                    "playerA": "TBD",
                    "playerB": "TBD",
                    "playerA_id": None,
                    "playerB_id": None,
                    "match_score_a": None,
                    "match_score_b": None,
                    "winner": None,
                    "status": "pending"
                })
        
        current_matches = next_matches
        round_num += 1
    
    return {
        "title": title,
        "rounds": rounds
    }


# ============================================================================
# MAIN BRACKET GENERATION
# ============================================================================

def generate_brackets_with_constraints(
    entries: List[Dict[str, Any]],
    bracket_size: int,
    history_set: Set[Tuple[int, int]],
    seed: Optional[int] = None,
    max_attempts_per_bracket: int = 1500,
    swap_rescue_tries: int = 200
) -> Dict[str, Any]:
    """
    Main bracket generation algorithm with constraint-based pairing.
    
    Args:
        entries: List of {player_id, name, average, entry_number} dicts
        bracket_size: Power of 2 (4, 8, 16, 32, 64, 128)
        history_set: Set of (player_a_id, player_b_id) tuples to avoid
        seed: Optional RNG seed for deterministic results
        max_attempts_per_bracket: Max backtracking attempts per bracket
        swap_rescue_tries: Max swap rescue attempts
    
    Returns:
        {
            brackets: List of bracket dicts,
            refunded: List of player entries that couldn't be placed
        }
    """
    assert is_power_of_two(bracket_size), f"Bracket size must be power of 2, got {bracket_size}"
    
    # Initialize RNG
    rng = random.Random(seed) if seed is not None else random.Random()
    
    # Step 1: Deduplicate - no player twice in same bracket
    unique = dedupe_by_id(entries)
    
    if len(unique) < bracket_size:
        return {
            'brackets': [],
            'refunded': unique
        }
    
    # Step 2: Shuffle pool
    pool = fisher_yates_shuffle(unique, rng)
    
    # Step 3: Calculate target brackets
    target_count = len(pool) // bracket_size
    
    # Step 4: Slice into candidate groups
    groups = []
    i = 0
    for _ in range(target_count):
        group = pool[i:i + bracket_size]
        groups.append(group)
        i += bracket_size
    leftovers = pool[i:]
    
    # Step 5: Try to pair each group
    brackets = []
    bad_groups = []
    
    for idx, group in enumerate(groups):
        ok, pairings = pair_with_constraints(
            group,
            bracket_size,
            history_set,
            rng,
            max_attempts=max_attempts_per_bracket
        )
        
        if ok:
            brackets.append({
                'entrants': group,
                'pairings': pairings,
                'group_index': idx
            })
        else:
            bad_groups.append(idx)
    
    # Step 6: Swap rescue for failing groups
    tries = 0
    while bad_groups and tries < swap_rescue_tries:
        tries += 1
        
        fail_idx = bad_groups.pop(0)
        failing_group = groups[fail_idx]
        
        donor_idx = pick_donor_group_index(groups, fail_idx, leftovers, rng)
        donor_group = leftovers if donor_idx == -1 else groups[donor_idx]
        is_donor_leftovers = (donor_idx == -1)
        
        success, pairings = attempt_swap_rescue(
            failing_group,
            donor_group,
            bracket_size,
            history_set,
            rng,
            is_donor_leftovers=is_donor_leftovers
        )
        
        if success:
            brackets.append({
                'entrants': failing_group.copy(),
                'pairings': pairings,
                'group_index': fail_idx
            })
        else:
            # Couldn't salvage, push back
            bad_groups.append(fail_idx)
        
        # Prevent infinite loop
        if tries >= swap_rescue_tries:
            break
    
    # Step 7: Collect refunds
    failed_entrants = []
    for idx in bad_groups:
        failed_entrants.extend(groups[idx])
    
    refunded = leftovers + failed_entrants
    
    return {
        'brackets': brackets,
        'refunded': refunded
    }


# ============================================================================
# INTEGRATION WITH EXISTING SYSTEM
# ============================================================================

def create_brackets_with_history(
    entries: List[Dict[str, Any]],
    bracket_size: int,
    bracket_type: str,
    history_set: Set[Tuple[int, int]] = None,
    seed: Optional[int] = None
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Wrapper function to integrate with existing bracket generation system.
    
    Args:
        entries: List of player entries
        bracket_size: Size of each bracket (power of 2)
        bracket_type: "Scratch" or "Handicap"
        history_set: Optional set of forbidden pairings
        seed: Optional RNG seed
    
    Returns:
        (brackets, leftover_players) tuple matching existing interface
    """
    if not entries:
        return [], []
    
    # Use empty history set if none provided (backwards compatible)
    if history_set is None:
        history_set = set()
    
    # Run advanced algorithm
    result = generate_brackets_with_constraints(
        entries=entries,
        bracket_size=bracket_size,
        history_set=history_set,
        seed=seed
    )
    
    # Convert to existing bracket format
    brackets = []
    for i, bracket_data in enumerate(result['brackets']):
        bracket_num = i + 1
        bracket_title = f"{bracket_type} Bracket {bracket_num}"
        
        bracket = create_single_bracket_from_pairings(
            bracket_data['pairings'],
            bracket_title,
            bracket_size
        )
        brackets.append(bracket)
    
    # Convert refunded to existing format
    leftover_players = []
    for entry in result['refunded']:
        leftover_players.append({
            'player_name': entry['name'],
            'player_id': entry['player_id'],
            'bracket_type': bracket_type.lower(),
            'reason': f'Could not create valid pairing (constraints or insufficient players)',
            'entry_number': entry.get('entry_number', 1)
        })
    
    return brackets, leftover_players
