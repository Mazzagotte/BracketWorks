"""
Simplified bracket generation service - cleaner and more readable
"""
import random
from typing import List, Dict, Any

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
                # First round - use seed numbers
                matches.append({
                    "seedA": i + 1,
                    "seedB": i + 2,
                    "playerA": f"Player {i + 1}",
                    "playerB": f"Player {i + 2}",
                    "scoreA": None,
                    "scoreB": None,
                    "winner": None,
                    "status": "pending"
                })
            else:
                # Later rounds - placeholders
                matches.append({
                    "seedA": None,
                    "seedB": None,
                    "playerA": f"TBD",
                    "playerB": f"TBD", 
                    "scoreA": None,
                    "scoreB": None,
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


def generate_tournament_brackets(
    players: List[Dict[str, Any]], 
    bracket_size: int = 8
) -> Dict[str, Any]:
    """
    Generate tournament brackets from actual player data.
    Simplified version that focuses on readability.
    """
    if not players:
        return {
            "scratch_brackets": [],
            "handicap_brackets": [],
            "summary": create_empty_summary()
        }
    
    # Separate players by bracket type entries
    scratch_entries = create_scratch_entries(players)
    handicap_entries = create_handicap_entries(players)
    
    # Generate brackets
    scratch_brackets = create_brackets(scratch_entries, bracket_size, "Scratch")
    handicap_brackets = create_brackets(handicap_entries, bracket_size, "Handicap")
    
    # Create summary
    summary = create_bracket_summary(scratch_entries, handicap_entries, scratch_brackets, handicap_brackets)
    
    return {
        "scratch_brackets": scratch_brackets,
        "handicap_brackets": handicap_brackets,
        "summary": summary,
        "bracket_size": bracket_size
    }


def create_scratch_entries(players: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Create scratch entries from player data"""
    entries = []
    
    for player in players:
        # Get number of scratch brackets this player wants
        scratch_count = player.get('scratch', 0)
        
        if scratch_count > 0:
            # Calculate scratch total (sum of scratch games)
            total_score = sum([
                player.get('scores', {}).get('game1_scratch', 0),
                player.get('scores', {}).get('game2_scratch', 0),
                player.get('scores', {}).get('game3_scratch', 0)
            ])
            
            # Create entries for each bracket this player wants
            for i in range(scratch_count):
                entries.append({
                    'player_id': player.get('id'),
                    'name': f"{player.get('firstName', '')} {player.get('lastName', '')}".strip(),
                    'total_score': total_score,
                    'average': player.get('average', 0),
                    'entry_number': i + 1  # Track which entry this is for the player
                })
    
    return entries


def create_handicap_entries(players: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Create handicap entries from player data"""
    entries = []
    
    for player in players:
        # Get number of handicap brackets this player wants
        handicap_count = player.get('handicap', 0)
        
        if handicap_count > 0:
            # Calculate handicap total (sum of total games with handicap)
            total_score = sum([
                player.get('scores', {}).get('game1_total', 0),
                player.get('scores', {}).get('game2_total', 0),
                player.get('scores', {}).get('game3_total', 0)
            ])
            
            # Create entries for each bracket this player wants
            for i in range(handicap_count):
                entries.append({
                    'player_id': player.get('id'),
                    'name': f"{player.get('firstName', '')} {player.get('lastName', '')}".strip(),
                    'total_score': total_score,
                    'average': player.get('average', 0),
                    'entry_number': i + 1  # Track which entry this is for the player
                })
    
    return entries


def create_brackets(entries: List[Dict[str, Any]], bracket_size: int, bracket_type: str) -> List[Dict[str, Any]]:
    """Create multiple full brackets from entries with random assignment"""
    if not entries:
        return []
    
    # Randomly shuffle entries instead of sorting by score
    randomized_entries = entries.copy()  # Don't modify original list
    random.shuffle(randomized_entries)
    
    brackets = []
    bracket_num = 1
    
    # Create brackets while we have enough players
    while len(randomized_entries) >= bracket_size:
        # Take next group of randomly ordered players
        bracket_players = randomized_entries[:bracket_size]
        randomized_entries = randomized_entries[bracket_size:]
        
        # Create the bracket
        bracket = create_single_bracket(bracket_players, f"{bracket_type} Bracket {bracket_num}")
        brackets.append(bracket)
        bracket_num += 1
    
    return brackets


def create_single_bracket(players: List[Dict[str, Any]], title: str) -> Dict[str, Any]:
    """Create a single bracket from a list of players with random seeding"""
    size = len(players)
    
    # Randomly shuffle players for random seeding
    shuffled_players = players.copy()
    random.shuffle(shuffled_players)
    
    # Assign sequential seeds to randomly ordered players
    seeded_players = [(i + 1, player) for i, player in enumerate(shuffled_players)]
    
    # Create initial matches with random pairings
    first_round_matches = []
    for i in range(0, size, 2):
        seed_a, player_a = seeded_players[i]
        seed_b, player_b = seeded_players[i + 1]
        
        first_round_matches.append({
            "seedA": seed_a,
            "seedB": seed_b,
            "playerA": player_a['name'],
            "playerB": player_b['name'],
            "scoreA": player_a['total_score'],  # Show qualifying score for reference
            "scoreB": player_b['total_score'],  # Show qualifying score for reference
            "winner": None,     # No predetermined winner
            "status": "pending" # All matches start as pending
        })
    
    # Build all rounds
    rounds = []
    current_matches = first_round_matches
    round_num = 1
    
    while len(current_matches) > 0:
        round_name = get_round_name(round_num, size)
        rounds.append({
            "name": round_name,
            "matches": current_matches.copy()
        })
        
        if len(current_matches) == 1:
            break
            
        # Create next round with TBD players (since first round is now pending)
        next_matches = []
        for i in range(0, len(current_matches), 2):
            if i + 1 < len(current_matches):
                next_matches.append({
                    "seedA": None,
                    "seedB": None,
                    "playerA": "TBD",
                    "playerB": "TBD",
                    "scoreA": None,
                    "scoreB": None,
                    "winner": None,
                    "status": "pending"
                })
        
        current_matches = next_matches
        round_num += 1
    
    return {
        "title": title,
        "rounds": rounds
    }


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
    """Update a match score and advance winners automatically"""
    
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
            match['scoreA'] = score_a
            match['scoreB'] = score_b
            match['winner'] = 'A' if score_a > score_b else 'B'
            match['status'] = 'completed'
        return brackets_data
    
    # Multiple brackets case
    if (bracket_type in brackets_data and 
        bracket_index < len(brackets_data[bracket_type])):
        
        bracket = brackets_data[bracket_type][bracket_index]
        if (round_index < len(bracket['rounds']) and 
            match_index < len(bracket['rounds'][round_index]['matches'])):
            
            match = bracket['rounds'][round_index]['matches'][match_index]
            match['scoreA'] = score_a
            match['scoreB'] = score_b
            match['winner'] = 'A' if score_a > score_b else 'B'
            match['status'] = 'completed'
            
            # Auto-advance winner to next round
            advance_winner_to_next_round(bracket, round_index, match_index, match['winner'])
    
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
        
        # Determine if this winner goes to playerA or playerB slot
        if match_index % 2 == 0:
            next_match['playerA'] = winner_name
        else:
            next_match['playerB'] = winner_name