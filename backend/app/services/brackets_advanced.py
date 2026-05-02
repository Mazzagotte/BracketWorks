"""
Advanced bracket generation with two-phase algorithm:

Phase 1 — Deterministic Max Fill:
  Fills the maximum possible number of complete brackets without randomness
  affecting the count. Uses a convergence formula to find k (number of brackets),
  then greedily assigns entries to groups ensuring no player appears twice in the
  same bracket.

Phase 2 — Optimized Pairing:
  Randomness only affects matchup quality, never bracket count. For each group,
  shuffles first-round pairings and scores them by:
    1. Historical rematch avoidance (players who have faced each other before)
    2. Cross-bracket uniqueness (same two players shouldn't face each other in
       multiple brackets in the same tournament)
  Keeps the best pairing found across many attempts.
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
# PHASE 1: DETERMINISTIC MAX FILL
# ============================================================================

def max_fill_groups(
    entries: List[Dict[str, Any]],
    bracket_size: int,
    rng: random.Random
) -> Tuple[List[List[Dict[str, Any]]], List[Dict[str, Any]]]:
    """
    Deterministically fill the maximum number of complete brackets.

    Algorithm:
    1. Compute k (bracket count) via convergence: start at floor(total/size),
       cap each player's contribution at k (one entry per bracket), reduce k
       until the capped total can actually fill k brackets.
    2. Assign entries to k groups greedily: for each player (most-entries first),
       pick the k groups with fewest members and place one entry in each, ensuring
       no player appears twice in the same group.

    This is deterministic — randomness only affects internal shuffles used to
    break ties when groups have equal fill level, not the final bracket count.

    Returns:
        (complete_groups, leftover_entries)
    """
    if len(entries) < bracket_size:
        return [], list(entries)

    # Group entries by player_id
    by_player: Dict[int, List[Dict[str, Any]]] = {}
    for entry in entries:
        pid = entry['player_id']
        by_player.setdefault(pid, []).append(entry)

    counts = [len(v) for v in by_player.values()]
    total = sum(counts)

    # Convergence: find the largest k where capped supply meets demand
    k = total // bracket_size
    while k > 0:
        fillable = sum(min(c, k) for c in counts)
        new_k = fillable // bracket_size
        if new_k >= k:
            break
        k = new_k

    if k == 0:
        return [], list(entries)

    groups: List[List[Dict[str, Any]]] = [[] for _ in range(k)]
    leftovers: List[Dict[str, Any]] = []

    # Sort players by entry count descending so high-volume players are spread
    # across groups early, preventing late congestion.
    sorted_players = sorted(by_player.values(), key=len, reverse=True)

    for player_entries in sorted_players:
        pid = player_entries[0]['player_id']
        # Cap: this player can appear in at most k groups (one per bracket)
        to_assign = player_entries[:k]
        leftovers.extend(player_entries[k:])

        # Shuffle this player's own entries for variety within assignment
        to_assign = fisher_yates_shuffle(to_assign, rng)

        # Build list of eligible groups (not full, don't already have this player)
        # sorted by current fill level ascending (fill least-full groups first)
        eligible = sorted(
            [
                i for i in range(k)
                if len(groups[i]) < bracket_size
                and all(existing.get('player_id') != pid for existing in groups[i])
            ],
            key=lambda i: len(groups[i])
        )

        for entry in to_assign:
            placed = False
            for i in eligible:
                if len(groups[i]) < bracket_size:
                    groups[i].append(entry)
                    placed = True
                    # A player can only appear once per group.
                    eligible = [idx for idx in eligible if idx != i]
                    # Re-sort remaining groups after each placement.
                    eligible.sort(key=lambda idx: len(groups[idx]))
                    break
            if not placed:
                leftovers.append(entry)

    # Separate complete from incomplete groups
    complete: List[List[Dict[str, Any]]] = []
    for group in groups:
        if len(group) == bracket_size:
            complete.append(group)
        else:
            leftovers.extend(group)

    return complete, leftovers


# ============================================================================
# PHASE 2: OPTIMIZED PAIRING
# ============================================================================

def optimize_pairings(
    groups: List[List[Dict[str, Any]]],
    bracket_size: int,
    history_set: Set[Tuple[int, int]],
    rng: random.Random,
    max_attempts: int = 1500
) -> Tuple[List[Dict[str, Any]], List[List[Dict[str, Any]]]]:
    """
    For each group, find first-round pairings that minimize:
      1. Historical rematches (players who have faced each other before)
      2. Cross-bracket repeat matchups within this generation run

    Strategy: shuffle the group `max_attempts` times, create consecutive pairs
    (p[0] vs p[1], p[2] vs p[3], …), score each candidate, keep the best.

    Scoring (lower is better):
      - +2 per historical rematch (hard penalty — strongly avoid)
      - +1 per cross-bracket repeat in this run (soft penalty — try to avoid)

    If no valid (zero-history) pairing is found after all attempts, falls back
    to the best attempt that merely minimizes historical rematches.

    Returns:
        (brackets, failed_groups)
        - brackets: list of {entrants, pairings} dicts for successful groups
        - failed_groups: list of groups where no valid pairing was found at all
    """
    brackets: List[Dict[str, Any]] = []
    failed_groups: List[List[Dict[str, Any]]] = []
    established_pairs: Set[Tuple[int, int]] = set()  # Cross-bracket tracking
    bye_recipient_counts: Dict[int, int] = {}  # Avoid repeatedly giving BYE to same player

    for group in groups:
        best_pairings: Optional[List[Tuple[Dict, Dict, Tuple[int, int], Optional[int]]]] = None
        best_score = float('inf')

        for _ in range(max_attempts):
            shuffled = fisher_yates_shuffle(group, rng)

            candidate: List[Tuple[Dict, Dict, Tuple[int, int], Optional[int]]] = []
            score = 0
            valid = True

            for i in range(0, bracket_size, 2):
                a, b = shuffled[i], shuffled[i + 1]
                a_id = a.get('player_id')
                b_id = b.get('player_id')

                # Never allow a bowler to face themself in round one.
                if a_id is not None and b_id is not None and a_id == b_id:
                    valid = False
                    break

                # BYE slots (player_id=None) are exempt from history/cross checks.
                if a_id is None or b_id is None:
                    bye_recipient_id = b_id if a_id is None else a_id
                    if bye_recipient_id is not None:
                        # Soft penalty: distribute BYEs across players when possible.
                        score += 2 * bye_recipient_counts.get(bye_recipient_id, 0)
                    candidate.append((a, b, (-1, -1), bye_recipient_id))
                    continue

                pair = normalize_pair(a_id, b_id)

                if is_forbidden(a_id, b_id, history_set):
                    score += 2  # Hard penalty for historical rematch
                if pair in established_pairs:
                    score += 1  # Soft penalty for cross-bracket repeat

                candidate.append((a, b, pair, None))

            # Ignore invalid or incomplete candidates entirely.
            if not valid or len(candidate) != (bracket_size // 2):
                continue

            if score < best_score:
                best_score = score
                best_pairings = candidate
                if best_score == 0:
                    break  # Perfect — no history violations, no cross-bracket repeats

        if best_pairings is not None:
            for _, _, p, bye_recipient_id in best_pairings:
                if p != (-1, -1):
                    established_pairs.add(p)
                elif bye_recipient_id is not None:
                    bye_recipient_counts[bye_recipient_id] = bye_recipient_counts.get(bye_recipient_id, 0) + 1
            brackets.append({
                'entrants': group,
                'pairings': [{'home': a, 'away': b} for a, b, _, _ in best_pairings]
            })
        else:
            failed_groups.append(group)

    return brackets, failed_groups


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
    Builds all rounds with automatic score-based winner advancement.
    
    Score Field Naming Convention:
    - Database: game1_total, game2_total, game3_total
    - Output: scoreA, scoreB (camelCase for frontend)
    - Round 1 uses game1_total, Round 2 uses game2_total, Round 3 uses game3_total
    """
    # Create first round matches from pairings
    first_round_matches = []
    
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Creating bracket '{title}' with {len(pairings)} matches")
    
    for i, pairing in enumerate(pairings):
        home_player = pairing['home']
        away_player = pairing['away']
        home_is_bye = str(home_player.get('name') or '').strip().upper() == 'BYE'
        away_is_bye = str(away_player.get('name') or '').strip().upper() == 'BYE'
        
        # Get Game 1 scores for Round 1 matches
        home_scores = home_player.get('scores', {})
        away_scores = away_player.get('scores', {})
        
        logger.debug(f"  Match {i+1}: {home_player.get('name')} vs {away_player.get('name')}")
        logger.debug(f"    Home scores: {home_scores}")
        logger.debug(f"    Away scores: {away_scores}")
        
        score_a = home_scores.get('game1_total') if home_scores else None
        score_b = away_scores.get('game1_total') if away_scores else None
        
        logger.debug(f"    score_a (game1_total): {score_a}")
        logger.debug(f"    score_b (game1_total): {score_b}")
        
        # Determine winner if both scores exist (or auto-advance on BYE)
        winner = None
        status = "pending"
        if home_is_bye and not away_is_bye:
            winner = "B"
            status = "completed"
        elif away_is_bye and not home_is_bye:
            winner = "A"
            status = "completed"
        elif score_a is not None and score_b is not None:
            if score_a > score_b:
                winner = "A"
                status = "completed"
            elif score_b > score_a:
                winner = "B"
                status = "completed"
            elif score_a == score_b:
                status = "tied"
        elif score_a is not None or score_b is not None:
            status = "in_progress"
        
        first_round_matches.append({
            "seedA": i * 2 + 1,
            "seedB": i * 2 + 2,
            "playerA": home_player['name'],
            "playerB": away_player['name'],
            "playerA_id": home_player['player_id'],
            "playerB_id": away_player['player_id'],
            "scoreA": score_a,  # camelCase for frontend
            "scoreB": score_b,
            "winner": winner,
            "status": status
        })
        
        logger.debug(f"    Created match with scoreA={score_a}, scoreB={score_b}, winner={winner}, status={status}")
    
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
                
                # Advance winners from previous matches
                playerA = None
                playerA_id = None
                playerA_seed = None
                score_a = None
                
                playerB = None
                playerB_id = None
                playerB_seed = None
                score_b = None
                
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
                    score_a = player_scores_map[playerA_id].get(game_field)
                
                if playerB_id and playerB_id in player_scores_map:
                    score_b = player_scores_map[playerB_id].get(game_field)
                
                # Determine winner for this round based on scores
                winner = None
                status = "pending"
                
                if playerA and playerB:
                    if score_a is not None and score_b is not None:
                        if score_a > score_b:
                            winner = "A"
                            status = "completed"
                        elif score_b > score_a:
                            winner = "B"
                            status = "completed"
                        elif score_a == score_b:
                            status = "tied"
                    elif score_a is not None or score_b is not None:
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
                    "scoreA": score_a,  # camelCase for frontend
                    "scoreB": score_b,
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
    max_pairing_attempts: int = 1500,
    **kwargs  # Accept (and ignore) legacy keyword args for backwards compat
) -> Dict[str, Any]:
    """
    Two-phase bracket generation.

    Phase 1 — Deterministic Max Fill (max_fill_groups):
        Computes the maximum achievable bracket count using the convergence
        formula, then assigns entries to groups deterministically. Bracket
        count is no longer affected by random shuffle order.

    Phase 2 — Optimized Pairing (optimize_pairings):
        Shuffles first-round matchups within each group, scoring each
        candidate by historical rematches (+2) and cross-bracket repeats
        (+1). Keeps the best pairing found across max_pairing_attempts.

    Args:
        entries: List of {player_id, name, average, entry_number} dicts
        bracket_size: Power of 2 (4, 8, 16, 32, 64, 128)
        history_set: Set of (player_a_id, player_b_id) tuples to avoid
        seed: Optional RNG seed for reproducible results
        max_pairing_attempts: Shuffle attempts per bracket in Phase 2

    Returns:
        {brackets: List, refunded: List}
    """
    assert is_power_of_two(bracket_size), f"Bracket size must be power of 2, got {bracket_size}"

    rng = random.Random(seed) if seed is not None else random.Random()

    # Phase 1: fill as many brackets as possible (deterministic count)
    groups, leftovers = max_fill_groups(entries, bracket_size, rng)

    # Phase 2: find best first-round pairings for each group
    brackets, failed_groups = optimize_pairings(
        groups, bracket_size, history_set, rng, max_attempts=max_pairing_attempts
    )

    refunded = leftovers + [entry for group in failed_groups for entry in group]

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
    seed: Optional[int] = None,
    allow_single_bye_per_bracket: bool = False,
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

    # Optional universal BYE mode: if standard generation leaves refunds,
    # rebuild from the full entry pool using a mixed layout of normal brackets
    # (size) and BYE brackets (size-1 + BYE), then pick the best placement.
    if allow_single_bye_per_bracket and result.get('refunded'):
        real_slots = bracket_size - 1
        total_entries = len(entries)
        standard_refunded = list(result.get('refunded', []))
        standard_placed = total_entries - len(standard_refunded)

        if real_slots > 0:
            by_player: Dict[Any, List[Dict[str, Any]]] = {}
            for entry in entries:
                player_id = entry.get('player_id')
                if player_id is None:
                    continue
                by_player.setdefault(player_id, []).append(entry)

            sorted_players = sorted(by_player.values(), key=len, reverse=True)
            bye_entry = {
                'player_id': None,
                'name': 'BYE',
                'average': 0,
                'entry_number': 0,
                'scores': {},
            }

            best_layout_brackets: Optional[List[Dict[str, Any]]] = None
            best_layout_refunded: Optional[List[Dict[str, Any]]] = None
            best_layout_placed = standard_placed
            best_layout_normal_count = len(result.get('brackets', []))

            max_bye_brackets = total_entries // real_slots
            for bye_count in range(1, max_bye_brackets + 1):
                remaining_after_byes = total_entries - (bye_count * real_slots)
                if remaining_after_byes < 0:
                    continue

                normal_count = remaining_after_byes // bracket_size
                target_groups = normal_count + bye_count
                if target_groups <= 0:
                    continue

                candidate_rng = random.Random(seed + bye_count) if seed is not None else random.Random()
                capacities = [bracket_size for _ in range(normal_count)] + [real_slots for _ in range(bye_count)]
                groups: List[List[Dict[str, Any]]] = [[] for _ in range(target_groups)]
                candidate_refunded: List[Dict[str, Any]] = []

                for player_entries in sorted_players:
                    player_id = player_entries[0].get('player_id')
                    assignable_entries = fisher_yates_shuffle(player_entries[:target_groups], candidate_rng)
                    candidate_refunded.extend(player_entries[target_groups:])

                    for entry in assignable_entries:
                        eligible = [
                            index for index in range(target_groups)
                            if len(groups[index]) < capacities[index]
                            and all(existing.get('player_id') != player_id for existing in groups[index])
                        ]

                        if not eligible:
                            candidate_refunded.append(entry)
                            continue

                        eligible.sort(key=lambda index: (len(groups[index]) / capacities[index], len(groups[index])))
                        groups[eligible[0]].append(entry)

                # Keep any fully filled groups and refund incomplete ones.
                # This avoids all-or-nothing collapse when distribution across
                # players is uneven (common in division-restricted programs).
                filled_group_records: List[Tuple[List[Dict[str, Any]], int]] = []
                for i, group in enumerate(groups):
                    capacity = capacities[i]
                    if len(group) == capacity:
                        filled_group_records.append((group, capacity))
                    else:
                        candidate_refunded.extend(group)

                if not filled_group_records:
                    continue

                augmented_groups: List[List[Dict[str, Any]]] = []
                for group, capacity in filled_group_records:
                    if capacity == real_slots:
                        augmented_groups.append(group + [bye_entry.copy()])
                    else:
                        augmented_groups.append(group)

                optimized_brackets, failed_groups = optimize_pairings(
                    groups=augmented_groups,
                    bracket_size=bracket_size,
                    history_set=history_set,
                    rng=candidate_rng,
                    max_attempts=1500,
                )

                for failed_group in failed_groups:
                    candidate_refunded.extend(
                        [
                            entry for entry in failed_group
                            if str(entry.get('name') or '').strip().upper() != 'BYE'
                        ]
                    )

                candidate_placed = total_entries - len(candidate_refunded)
                if candidate_placed > best_layout_placed or (
                    candidate_placed == best_layout_placed and normal_count > best_layout_normal_count
                ):
                    best_layout_brackets = optimized_brackets
                    best_layout_refunded = candidate_refunded
                    best_layout_placed = candidate_placed
                    best_layout_normal_count = normal_count

            # Deterministic BYE-only fallback: build as many (size-1 + BYE)
            # groups as possible by taking one entry from each of the most
            # available distinct players per group.
            by_player_for_greedy: Dict[Any, List[Dict[str, Any]]] = {
                pid: items.copy() for pid, items in by_player.items() if items
            }
            greedy_groups: List[List[Dict[str, Any]]] = []

            while True:
                eligible = [pid for pid, items in by_player_for_greedy.items() if items]
                if len(eligible) < real_slots:
                    break

                selected = sorted(
                    eligible,
                    key=lambda pid: (-len(by_player_for_greedy[pid]), pid),
                )[:real_slots]

                group: List[Dict[str, Any]] = []
                for pid in selected:
                    group.append(by_player_for_greedy[pid].pop())

                greedy_groups.append(group + [bye_entry.copy()])

            if greedy_groups:
                candidate_rng = random.Random((seed or 0) + 99991) if seed is not None else random.Random()
                optimized_brackets, failed_groups = optimize_pairings(
                    groups=greedy_groups,
                    bracket_size=bracket_size,
                    history_set=history_set,
                    rng=candidate_rng,
                    max_attempts=1500,
                )

                candidate_refunded: List[Dict[str, Any]] = []
                for failed_group in failed_groups:
                    candidate_refunded.extend(
                        [
                            entry for entry in failed_group
                            if str(entry.get('name') or '').strip().upper() != 'BYE'
                        ]
                    )

                for items in by_player_for_greedy.values():
                    candidate_refunded.extend(items)

                candidate_placed = total_entries - len(candidate_refunded)
                if candidate_placed > best_layout_placed:
                    best_layout_brackets = optimized_brackets
                    best_layout_refunded = candidate_refunded
                    best_layout_placed = candidate_placed
                    best_layout_normal_count = 0

            if best_layout_brackets is not None and best_layout_refunded is not None and best_layout_placed > standard_placed:
                result['brackets'] = best_layout_brackets
                result['refunded'] = best_layout_refunded

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
