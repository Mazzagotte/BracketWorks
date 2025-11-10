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
    
    print(f"\n=== BRACKET MATCH CREATION DEBUG ===")
    print(f"Creating bracket: {title}")
    print(f"Number of pairings: {len(pairings)}")
    
    for i, pairing in enumerate(pairings):
        home_player = pairing['home']
        away_player = pairing['away']
        
        # Get Game 1 scores for Round 1 matches
        home_scores = home_player.get('scores', {})
        away_scores = away_player.get('scores', {})
        
        print(f"\nMatch {i+1}: {home_player.get('name')} vs {away_player.get('name')}")
        print(f"  {home_player.get('name')} scores: {home_scores}")
        print(f"  {away_player.get('name')} scores: {away_scores}")
        
        match_score_a = home_scores.get('game1_total') if home_scores else None
        match_score_b = away_scores.get('game1_total') if away_scores else None
        
        print(f"  Game 1 scores: {match_score_a} vs {match_score_b}")
        
        # Determine winner if both scores exist
        winner = None
        status = "pending"
        if match_score_a is not None and match_score_b is not None:
            if match_score_a > match_score_b:
                winner = "A"
                status = "completed"
            elif match_score_b > match_score_a:
                winner = "B"
                status = "completed"
            elif match_score_a == match_score_b:
                status = "tied"
        elif match_score_a is not None or match_score_b is not None:
            status = "in_progress"
        
        print(f"  Winner: {winner}, Status: {status}")
        
        first_round_matches.append({
            "seedA": i * 2 + 1,
            "seedB": i * 2 + 2,
            "playerA": home_player['name'],
            "playerB": away_player['name'],
            "playerA_id": home_player['player_id'],
            "playerB_id": away_player['player_id'],
            "scoreA": match_score_a,  # Frontend expects scoreA/scoreB
            "scoreB": match_score_b,
            "winner": winner,
            "status": status
        })
    
    # Build all rounds
    rounds = []
    current_matches = first_round_matches
    round_num = 1
    
    # Keep track of original pairings for score lookup
    player_scores_map = {}
    for pairing in pairings:
        home_player = pairing['home']
        away_player = pairing['away']
        player_scores_map[home_player['player_id']] = home_player.get('scores', {})
        player_scores_map[away_player['player_id']] = away_player.get('scores', {})
    
    while len(current_matches) > 0:
        round_name = get_round_name(round_num, bracket_size)
        rounds.append({
            "name": round_name,
            "matches": current_matches.copy()
        })
        
        if len(current_matches) == 1:
            break
        
        # Create next round by advancing winners
        next_matches = []
        game_field = f'game{round_num + 1}_total'  # game2_total for Round 2, game3_total for Round 3
        
        for i in range(0, len(current_matches), 2):
            if i + 1 < len(current_matches):
                match1 = current_matches[i]
                match2 = current_matches[i + 1]
                
                # Determine who advances from each match
                playerA = None
                playerA_id = None
                playerA_seed = None
                match_score_a = None
                
                playerB = None
                playerB_id = None
                playerB_seed = None
                match_score_b = None
                
                # Match 1 winner advances as Player A
                if match1.get('winner') == 'A':
                    playerA = match1['playerA']
                    playerA_id = match1.get('playerA_id')
                    playerA_seed = match1.get('seedA')
                elif match1.get('winner') == 'B':
                    playerA = match1['playerB']
                    playerA_id = match1.get('playerB_id')
                    playerA_seed = match1.get('seedB')
                
                # Match 2 winner advances as Player B
                if match2.get('winner') == 'A':
                    playerB = match2['playerA']
                    playerB_id = match2.get('playerA_id')
                    playerB_seed = match2.get('seedA')
                elif match2.get('winner') == 'B':
                    playerB = match2['playerB']
                    playerB_id = match2.get('playerB_id')
                    playerB_seed = match2.get('seedB')
                
                # Get scores for next game if players advanced
                if playerA_id and playerA_id in player_scores_map:
                    match_score_a = player_scores_map[playerA_id].get(game_field)
                
                if playerB_id and playerB_id in player_scores_map:
                    match_score_b = player_scores_map[playerB_id].get(game_field)
                
                # Determine winner if both players and scores exist
                winner = None
                status = "pending"
                
                if playerA and playerB:
                    if match_score_a is not None and match_score_b is not None:
                        if match_score_a > match_score_b:
                            winner = "A"
                            status = "completed"
                        elif match_score_b > match_score_a:
                            winner = "B"
                            status = "completed"
                        elif match_score_a == match_score_b:
                            status = "tied"
                    elif match_score_a is not None or match_score_b is not None:
                        status = "in_progress"
                    else:
                        status = "next_up"  # Both players known but no scores yet
                
                next_matches.append({
                    "seedA": playerA_seed,
                    "seedB": playerB_seed,
                    "playerA": playerA or "TBD",
                    "playerB": playerB or "TBD",
                    "playerA_id": playerA_id,
                    "playerB_id": playerB_id,
                    "scoreA": match_score_a,  # Frontend expects scoreA/scoreB
                    "scoreB": match_score_b,
                    "winner": winner,
                    "status": status
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
    
    # Step 1: Shuffle entire pool
    pool = fisher_yates_shuffle(entries, rng)
    
    # Step 2: Calculate how many brackets we can make
    total_entries = len(pool)
    target_count = total_entries // bracket_size
    
    if total_entries < bracket_size:
        return {
            'brackets': [],
            'refunded': pool
        }
    
    # Step 3: Distribute entries to groups, ensuring no duplicate player_ids per group
    groups = [[] for _ in range(target_count)]
    player_counts = [{} for _ in range(target_count)]  # Track player_id counts per group
    skipped_entries = []
    
    for entry in pool:
        player_id = entry.get('player_id')
        placed = False
        
        # Try to place in a group that doesn't already have this player_id
        for group_idx in range(target_count):
            if len(groups[group_idx]) < bracket_size:
                # Check if this player is already in this group
                if player_counts[group_idx].get(player_id, 0) == 0:
                    groups[group_idx].append(entry)
                    player_counts[group_idx][player_id] = player_counts[group_idx].get(player_id, 0) + 1
                    placed = True
                    break
        
        if not placed:
            skipped_entries.append(entry)
    
    # Step 4: Filter out incomplete groups and collect their entries as leftovers
    complete_groups = []
    leftovers = []
    
    for group in groups:
        if len(group) == bracket_size:
            complete_groups.append(group)
        else:
            leftovers.extend(group)
    
    leftovers.extend(skipped_entries)
    groups = complete_groups
    
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
