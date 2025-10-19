
def generate_bracket_preview(size: int = 8):
    """Generate a complete single-elimination bracket tree"""
    if size < 2 or (size & (size - 1)) != 0:  # Check if size is power of 2
        raise ValueError("Bracket size must be a power of 2")
    
    # Generate all rounds for a complete bracket
    rounds = []
    current_size = size
    round_num = 1
    
    # Generate seeds for first round
    seeds = list(range(1, size + 1))
    # Standard bracket seeding: 1 vs size, 2 vs size-1, etc.
    first_round_pairs = []
    for i in range(size // 2):
        first_round_pairs.append((seeds[i], seeds[size - 1 - i]))
    
    # Create first round
    rounds.append({
        "name": f"Round {round_num}" if round_num > 1 else "First Round",
        "matches": [{"seedA": a, "seedB": b} for a, b in first_round_pairs]
    })
    
    # Generate subsequent rounds
    current_size = size // 2
    round_num += 1
    
    while current_size > 1:
        round_name = "Championship" if current_size == 2 else f"Round {round_num}"
        if current_size == 4:
            round_name = "Semifinals"
        
        matches = []
        for i in range(current_size // 2):
            # These will be filled by winners from previous round
            matches.append({
                "seedA": 0,  # Winner from previous round match
                "seedB": 0   # Winner from previous round match
            })
        
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


def generate_multiple_brackets(players_data: list, tournament_bracket_size: int):
    """
    Generate multiple unique brackets based on player entry counts and scores
    
    Args:
        players_data: List of players with scores and entry counts
        tournament_bracket_size: Size of each bracket (from tournament settings)
    
    Returns:
        Dictionary with scratch and handicap brackets
    """
    if not players_data:
        return {"scratch_brackets": [], "handicap_brackets": []}
    
    # Create player entries for each bracket type
    scratch_entries = []
    handicap_entries = []
    
    for player in players_data:
        # Calculate total scratch score (sum of all games)
        scratch_total = (
            (player.get('scores', {}).get('game1_scratch') or 0) +
            (player.get('scores', {}).get('game2_scratch') or 0) +
            (player.get('scores', {}).get('game3_scratch') or 0)
        )
        
        # Calculate total handicap score (sum of all games)
        handicap_total = (
            (player.get('scores', {}).get('game1_total') or 0) +
            (player.get('scores', {}).get('game2_total') or 0) +
            (player.get('scores', {}).get('game3_total') or 0)
        )
        
        # Add entries based on player's desired bracket counts
        scratch_count = player.get('scratch', 0)
        handicap_count = player.get('handicap', 0)
        
        # Add scratch entries
        for _ in range(scratch_count):
            scratch_entries.append({
                'player_id': player['id'],
                'player_name': f"{player.get('firstName', '')} {player.get('lastName', '')}".strip(),
                'total_score': scratch_total,
                'average': player.get('average', 0),
                'original_scores': player.get('scores', {})  # Pass through all game scores
            })
        
        # Add handicap entries  
        for _ in range(handicap_count):
            handicap_entries.append({
                'player_id': player['id'],
                'player_name': f"{player.get('firstName', '')} {player.get('lastName', '')}".strip(),
                'total_score': handicap_total,
                'average': player.get('average', 0),
                'original_scores': player.get('scores', {})  # Pass through all game scores
            })
    
    # Generate brackets for each type
    scratch_brackets = _create_brackets_from_entries(scratch_entries, tournament_bracket_size, "Scratch")
    handicap_brackets = _create_brackets_from_entries(handicap_entries, tournament_bracket_size, "Handicap")
    
    # Auto-advance all brackets through rounds using game-specific scoring
    for bracket in scratch_brackets:
        bracket = advance_bracket_rounds(bracket, "Scratch", scratch_entries)
    
    for bracket in handicap_brackets:
        bracket = advance_bracket_rounds(bracket, "Handicap", handicap_entries)
    
    # Calculate refund information
    scratch_placed_entries = sum(len(bracket['rounds'][0]['matches']) * 2 for bracket in scratch_brackets)
    handicap_placed_entries = sum(len(bracket['rounds'][0]['matches']) * 2 for bracket in handicap_brackets)
    
    scratch_refund_entries = len(scratch_entries) - scratch_placed_entries
    handicap_refund_entries = len(handicap_entries) - handicap_placed_entries
    
    return {
        "scratch_brackets": scratch_brackets,
        "handicap_brackets": handicap_brackets,
        "summary": {
            "total_scratch_entries": len(scratch_entries),
            "total_handicap_entries": len(handicap_entries),
            "scratch_brackets_count": len(scratch_brackets),
            "handicap_brackets_count": len(handicap_brackets),
            "scratch_placed_entries": scratch_placed_entries,
            "handicap_placed_entries": handicap_placed_entries,
            "scratch_refund_entries": scratch_refund_entries,
            "handicap_refund_entries": handicap_refund_entries
        }
    }


def _create_brackets_from_entries(entries: list, bracket_size: int, bracket_type: str):
    """Create multiple brackets from a list of entries, only creating full brackets and refunding remaining players"""
    if not entries:
        return []
    
    # Randomly shuffle entries for fair seeding
    import random
    shuffled_entries = entries.copy()
    random.shuffle(shuffled_entries)
    
    brackets = []
    bracket_num = 1
    
    # Only create brackets if we have exactly bracket_size or more players
    while len(shuffled_entries) >= bracket_size:
        # Take exactly bracket_size entries for a full bracket
        bracket_players = shuffled_entries[:bracket_size]
        # Remove them from the pool
        shuffled_entries = shuffled_entries[bracket_size:]
        
        # Generate bracket structure with the exact bracket size
        bracket = generate_bracket_preview(bracket_size)
        
        # Assign randomly ordered players to first round matches (Round 1 = Game 1)
        for i, match in enumerate(bracket['rounds'][0]['matches']):
            seed_a_idx = match['seedA'] - 1
            seed_b_idx = match['seedB'] - 1
            
            # Since we only create full brackets, we're guaranteed to have players for both positions
            player_a = bracket_players[seed_a_idx]
            player_b = bracket_players[seed_b_idx]
            
            # Set Player A
            bracket['rounds'][0]['matches'][i]['playerA'] = player_a['player_name']
            bracket['rounds'][0]['matches'][i]['player_id_A'] = player_a['player_id']
            
            # Round 1 uses Game 1 score
            game_score_a = _get_game_score_for_player(player_a, 1, bracket_type)
            bracket['rounds'][0]['matches'][i]['scoreA'] = game_score_a
            bracket['rounds'][0]['matches'][i]['game_number'] = 1
            
            # Set Player B
            bracket['rounds'][0]['matches'][i]['playerB'] = player_b['player_name']
            bracket['rounds'][0]['matches'][i]['player_id_B'] = player_b['player_id']
            
            # Round 1 uses Game 1 score
            game_score_b = _get_game_score_for_player(player_b, 1, bracket_type)
            bracket['rounds'][0]['matches'][i]['scoreB'] = game_score_b
            
            # Determine winner and set status (all matches are complete since we have scores)
            if game_score_a > game_score_b:
                bracket['rounds'][0]['matches'][i]['winner'] = 'A'
            elif game_score_b > game_score_a:
                bracket['rounds'][0]['matches'][i]['winner'] = 'B'
            else:
                # Tie - could implement tie-breaking logic here if needed
                bracket['rounds'][0]['matches'][i]['winner'] = 'A'  # Default to A for now
            
            bracket['rounds'][0]['matches'][i]['status'] = 'completed'
        
        # Initialize subsequent rounds with game numbers
        for round_idx in range(1, len(bracket['rounds'])):
            game_number = round_idx + 1  # Round 2 = Game 2, Round 3 = Game 3
            for match in bracket['rounds'][round_idx]['matches']:
                match['game_number'] = game_number
                match['status'] = 'pending'
        
        bracket['bracket_type'] = bracket_type
        bracket['bracket_number'] = bracket_num
        bracket['title'] = f"{bracket_type} Bracket #{bracket_num}"
        
        brackets.append(bracket)
        bracket_num += 1
    
    return brackets


def _get_game_score_for_player(player: dict, game_number: int, bracket_type: str) -> int:
    """Get the appropriate game score for a player based on game number and bracket type"""
    scores = player.get('original_scores', {})  # Use original player data with all game scores
    
    if bracket_type.lower() == 'scratch':
        score_key = f'game{game_number}_scratch'
    else:  # handicap
        score_key = f'game{game_number}_total'
    
    return scores.get(score_key, 0) or 0


def update_match_score(brackets_result: dict, bracket_id: str, round_index: int, match_index: int, score_a: int, score_b: int):
    """Update match score and auto-advance winner to next round"""
    
    # Parse bracket_id (e.g., "scratch_1" or "handicap_2")
    bracket_type, bracket_num = bracket_id.split('_')
    bracket_num = int(bracket_num) - 1  # Convert to 0-based index
    
    # Get the appropriate bracket
    if bracket_type == 'scratch':
        if bracket_num >= len(brackets_result['scratch_brackets']):
            raise ValueError(f"Scratch bracket {bracket_num + 1} not found")
        bracket = brackets_result['scratch_brackets'][bracket_num]
    elif bracket_type == 'handicap':
        if bracket_num >= len(brackets_result['handicap_brackets']):
            raise ValueError(f"Handicap bracket {bracket_num + 1} not found")
        bracket = brackets_result['handicap_brackets'][bracket_num]
    else:
        raise ValueError(f"Invalid bracket type: {bracket_type}")
    
    # Validate round and match indices
    if round_index >= len(bracket['rounds']):
        raise ValueError(f"Round {round_index} not found in bracket")
    
    round_data = bracket['rounds'][round_index]
    if match_index >= len(round_data['matches']):
        raise ValueError(f"Match {match_index} not found in round {round_index}")
    
    # Update match with scores
    match = round_data['matches'][match_index]
    match['scoreA'] = score_a
    match['scoreB'] = score_b
    
    # Determine winner
    if score_a > score_b:
        match['winner'] = 'A'
        winner_name = match['playerA']
        winner_id = match.get('player_id_A')
        winner_score = score_a
    elif score_b > score_a:
        match['winner'] = 'B'
        winner_name = match['playerB']
        winner_id = match.get('player_id_B')
        winner_score = score_b
    else:
        raise ValueError("Scores cannot be tied. Please enter a winner.")
    
    match['status'] = 'completed'
    
    # Auto-advance winner to next round
    if round_index + 1 < len(bracket['rounds']):
        next_round = bracket['rounds'][round_index + 1]
        
        # Calculate which match in next round this winner goes to
        # In single elimination: match 0,1 → next match 0; match 2,3 → next match 1, etc.
        next_match_index = match_index // 2
        
        if next_match_index < len(next_round['matches']):
            next_match = next_round['matches'][next_match_index]
            
            # Determine if winner goes to position A or B in next round
            if match_index % 2 == 0:  # Even match index → position A
                next_match['playerA'] = winner_name
                next_match['player_id_A'] = winner_id
                next_match['seedA'] = f"W{round_index + 1}-{match_index + 1}"  # Winner of Round X, Match Y
            else:  # Odd match index → position B  
                next_match['playerB'] = winner_name
                next_match['player_id_B'] = winner_id
                next_match['seedB'] = f"W{round_index + 1}-{match_index + 1}"
            
            # Check if next match is ready to play (both players assigned)
            if next_match.get('playerA') and next_match.get('playerB'):
                next_match['status'] = 'ready'
            else:
                next_match['status'] = 'waiting'
    
    # Update the bracket in the original result
    if bracket_type == 'scratch':
        brackets_result['scratch_brackets'][bracket_num] = bracket
    else:
        brackets_result['handicap_brackets'][bracket_num] = bracket
    
    return brackets_result


def advance_bracket_rounds(bracket: dict, bracket_type: str, all_player_data: list):
    """Automatically advance winners through bracket rounds based on game scores"""
    
    # Process each round starting from round 1 (round 0 is already populated)
    for round_idx in range(1, len(bracket['rounds'])):
        current_round = bracket['rounds'][round_idx]
        previous_round = bracket['rounds'][round_idx - 1]
        game_number = current_round['matches'][0]['game_number']  # All matches in round use same game
        
        # Check if all matches in previous round are completed (no more byes)
        all_previous_completed = all(
            match.get('status') == 'completed' 
            for match in previous_round['matches']
        )
        
        if not all_previous_completed:
            break  # Can't advance to this round yet
        
        # Advance winners to current round
        for match_idx, match in enumerate(current_round['matches']):
            if match.get('status') == 'completed':
                continue  # Already processed
            
            # Get winners from previous round matches
            prev_match_a_idx = match_idx * 2
            prev_match_b_idx = match_idx * 2 + 1
            
            if (prev_match_a_idx < len(previous_round['matches']) and 
                prev_match_b_idx < len(previous_round['matches'])):
                
                prev_match_a = previous_round['matches'][prev_match_a_idx]
                prev_match_b = previous_round['matches'][prev_match_b_idx]
                
                # Get winners from previous matches (guaranteed to exist since no byes)
                # Get winner from first previous match
                if prev_match_a.get('winner') == 'A':
                    player_a_name = prev_match_a.get('playerA')
                    player_a_id = prev_match_a.get('player_id_A')
                else:
                    player_a_name = prev_match_a.get('playerB') 
                    player_a_id = prev_match_a.get('player_id_B')
                
                # Get winner from second previous match
                if prev_match_b.get('winner') == 'A':
                    player_b_name = prev_match_b.get('playerA')
                    player_b_id = prev_match_b.get('player_id_A')
                else:
                    player_b_name = prev_match_b.get('playerB')
                    player_b_id = prev_match_b.get('player_id_B')
                
                # Set up the match with both players
                match['playerA'] = player_a_name
                match['player_id_A'] = player_a_id
                match['playerB'] = player_b_name
                match['player_id_B'] = player_b_id
                
                # Get scores for this game number (guaranteed to have both players)
                score_a = _get_player_score_by_id(all_player_data, player_a_id, game_number, bracket_type)
                score_b = _get_player_score_by_id(all_player_data, player_b_id, game_number, bracket_type)
                
                match['scoreA'] = score_a
                match['scoreB'] = score_b
                
                # Determine winner and status
                if score_a > score_b:
                    match['winner'] = 'A'
                elif score_b > score_a:
                    match['winner'] = 'B'
                else:
                    # Tie - default to A for now
                    match['winner'] = 'A'
                
                match['status'] = 'completed'
    
    return bracket


def _get_player_score_by_id(all_player_data: list, player_id: int, game_number: int, bracket_type: str) -> int:
    """Get a player's score for a specific game by their ID"""
    for player in all_player_data:
        if player['player_id'] == player_id:
            return _get_game_score_for_player(
                player,  # Entry already has 'original_scores' 
                game_number, 
                bracket_type
            )
    return 0


def get_bracket_champion(bracket: dict) -> dict:
    """Get the champion of a completed bracket"""
    if not bracket['rounds']:
        return None
    
    # Championship is the last round
    championship_round = bracket['rounds'][-1]
    if len(championship_round['matches']) != 1:
        return None
    
    championship_match = championship_round['matches'][0]
    if championship_match.get('status') != 'completed' or not championship_match.get('winner'):
        return None
    
    if championship_match['winner'] == 'A':
        return {
            'name': championship_match['playerA'],
            'player_id': championship_match.get('player_id_A'),
            'score': championship_match.get('scoreA')
        }
    else:
        return {
            'name': championship_match['playerB'], 
            'player_id': championship_match.get('player_id_B'),
            'score': championship_match.get('scoreB')
        }
