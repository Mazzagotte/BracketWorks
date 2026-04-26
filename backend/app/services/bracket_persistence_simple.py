"""
Simplified bracket persistence - stores brackets as JSON instead of complex relational structure

Match Structure in JSON:
{
    "seedA": int | None,
    "seedB": int | None,
    "playerA": str,
    "playerB": str,
    "playerA_id": int | None,
    "playerB_id": int | None,
    "qualifying_score_a": int | None,
    "qualifying_score_b": int | None,
    "scoreA": int | None,  # match_score_a
    "scoreB": int | None,  # match_score_b
    "winner": 'A' | 'B' | None,
    "status": 'pending' | 'in_progress' | 'completed' | 'tied' | 'both_advance',
    "both_advance": bool,  # True if tied and both players advance to next round
    "split_pot": bool,  # True if Round 3 tie (finals) - pot is split
    "tied_from_round": int | None,  # If this match involved players who tied in previous round
    "eliminated_player": 'A' | 'B' | None,  # Player eliminated due to lower score after tie
    "elimination_notes": str | None  # Details about why player was eliminated
}
"""
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional, List
from datetime import datetime
import logging

from ..core.models import SimpleBracket

logger = logging.getLogger(__name__)


def get_bracket_groups(bracket_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    groups = bracket_data.get('bracket_groups')
    if groups:
        return groups
    return [
        {
            'key': 'scratch',
            'name': 'Scratch',
            'scoring_mode': 'scratch',
            'brackets': bracket_data.get('scratch_brackets', []),
        },
        {
            'key': 'handicap',
            'name': 'Handicap',
            'scoring_mode': 'handicap',
            'brackets': bracket_data.get('handicap_brackets', []),
        },
    ]


def ensure_legacy_bracket_views(bracket_data: Dict[str, Any]) -> Dict[str, Any]:
    groups = get_bracket_groups(bracket_data)
    # Migrate legacy 'reverse' scoring_mode to 'reverse_scratch' so old snapshots
    # are treated correctly by the hydration logic.
    for group in groups:
        if str(group.get('scoring_mode') or '').lower() == 'reverse':
            group['scoring_mode'] = 'reverse_scratch'
            if str(group.get('key') or '').lower() == 'reverse':
                group['key'] = 'reverse_scratch'
                group['name'] = group.get('name', 'Reverse Scratch')
    bracket_data['bracket_groups'] = groups
    bracket_data['scratch_brackets'] = next(
        (group.get('brackets', []) for group in groups if group.get('key') == 'scratch'),
        bracket_data.get('scratch_brackets', []),
    )
    bracket_data['handicap_brackets'] = next(
        (group.get('brackets', []) for group in groups if group.get('key') == 'handicap'),
        bracket_data.get('handicap_brackets', []),
    )
    return bracket_data


def iter_group_brackets(bracket_data: Dict[str, Any]):
    for group in get_bracket_groups(bracket_data):
        for bracket_num, bracket in enumerate(group.get('brackets', []), start=1):
            yield group, bracket_num, bracket


def save_brackets_simple(
    db: Session,
    tournament_id: int,
    squad_id: Optional[int],
    brackets_data: Dict[str, Any]
) -> None:
    """
    Save generated brackets to database as JSON - much simpler than the relational approach.
    
    Args:
        db: Database session
        tournament_id: ID of the tournament
        squad_id: ID of the squad (optional)
        brackets_data: The bracket data returned from generate_multiple_brackets()
    """
    try:
        brackets_data = ensure_legacy_bracket_views(brackets_data.copy())
        logger.info(f"Saving brackets to simple_brackets table")
        logger.info(f"  Tournament: {tournament_id}, Squad: {squad_id}")
        logger.info(f"  Bracket groups: {len(brackets_data.get('bracket_groups', []))}")
        
        # Log first match to verify scores are present
        if brackets_data.get('scratch_brackets'):
            first_bracket = brackets_data['scratch_brackets'][0]
            if first_bracket.get('rounds'):
                first_match = first_bracket['rounds'][0]['matches'][0]
                logger.debug(f"  Sample first match being saved:")
                logger.debug(f"     {first_match.get('playerA')} (scoreA={first_match.get('scoreA')}) vs {first_match.get('playerB')} (scoreB={first_match.get('scoreB')})")
        
        # First, mark any existing brackets as inactive
        db.query(SimpleBracket).filter(
            SimpleBracket.tournament_id == tournament_id,
            SimpleBracket.squad_id == squad_id if squad_id else SimpleBracket.squad_id.is_(None),
            SimpleBracket.is_active == True
        ).update({'is_active': False, 'updated_at': datetime.utcnow()})
        
        # Create new bracket record
        new_bracket = SimpleBracket(
            tournament_id=tournament_id,
            squad_id=squad_id,
            bracket_data=brackets_data,
            bracket_size=brackets_data.get('bracket_size', 8),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            is_active=True
        )
        
        db.add(new_bracket)
        
        # Save first-round matches to history for future constraint checking
        try:
            save_first_round_to_history(db, tournament_id, brackets_data)
        except Exception as hist_error:
            # Log but don't fail the whole save if history recording fails
            logger.warning(f"Failed to save match history: {hist_error}")
        
        # Commit everything together
        db.commit()
        
    except Exception as e:
        db.rollback()
        raise Exception(f"Failed to save brackets: {str(e)}")


def save_first_round_to_history(
    db: Session,
    tournament_id: int,
    brackets_data: Dict[str, Any]
) -> None:
    """
    Extract first-round matchups from brackets and save to match_history table.
    This enables rematch prevention in future tournaments.
    """
    from ..core.models import MatchHistory

    for group, bracket_num, bracket in iter_group_brackets(brackets_data):
        rounds = bracket.get('rounds', [])
        if rounds:
            first_round = rounds[0]  # First round
            matches = first_round.get('matches', [])
            
            for match in matches:
                player_a_id = match.get('playerA_id')
                player_b_id = match.get('playerB_id')
                
                # Only save if both player IDs are present
                if player_a_id and player_b_id:
                    history_entry = MatchHistory(
                        tournament_id=tournament_id,
                        player_a_id=min(player_a_id, player_b_id),  # Normalize
                        player_b_id=max(player_a_id, player_b_id),
                        bracket_type=str(group.get('key', 'scratch'))[:20],
                        bracket_number=bracket_num,
                        round_number=1,
                        created_at=datetime.utcnow()
                    )
                    db.add(history_entry)

    # Don't commit here - let the parent function handle the transaction


def load_brackets_simple(
    db: Session,
    tournament_id: int,
    squad_id: Optional[int] = None,
    refresh_scores: bool = True
) -> Optional[Dict[str, Any]]:
    """
    Load saved brackets for a tournament/squad from database.
    
    Args:
        db: Database session
        tournament_id: Tournament ID
        squad_id: Squad ID (optional)
        refresh_scores: If True, refresh all scores from the score table
    
    Returns:
        Dictionary matching the format returned by generate_multiple_brackets(), or None if no brackets found
    """
    try:
        logger.info(f"Loading brackets from simple_brackets table")
        logger.debug(f"  Tournament: {tournament_id}, Squad: {squad_id}, Refresh scores: {refresh_scores}")
        
        bracket_record = db.query(SimpleBracket).filter(
            SimpleBracket.tournament_id == tournament_id,
            SimpleBracket.squad_id == squad_id if squad_id else SimpleBracket.squad_id.is_(None),
            SimpleBracket.is_active == True
        ).order_by(SimpleBracket.created_at.desc()).first()
        
        if not bracket_record:
            logger.debug(f"  No brackets found")
            return None
        
        logger.info(f"  Found brackets created at {bracket_record.created_at}")
        
        # Log first match to verify scores are in loaded data
        bracket_data = ensure_legacy_bracket_views(bracket_record.bracket_data)
        
        # Refresh scores from database if requested
        if refresh_scores:
            logger.debug(f"  Refreshing scores from database...")
            bracket_data = hydrate_brackets_with_scores(db, tournament_id, squad_id, bracket_data)
        
        if bracket_data.get('bracket_groups') and bracket_data['bracket_groups'][0].get('brackets'):
            first_bracket = bracket_data['bracket_groups'][0]['brackets'][0]
            if first_bracket.get('rounds'):
                first_match = first_bracket['rounds'][0]['matches'][0]
                logger.debug(f"  Sample first match being loaded:")
                logger.debug(f"     {first_match.get('playerA')} (scoreA={first_match.get('scoreA')}) vs {first_match.get('playerB')} (scoreB={first_match.get('scoreB')})")
            
        return bracket_data
        
    except Exception as e:
        raise Exception(f"Failed to load brackets: {str(e)}")


def update_match_score_simple(
    db: Session,
    tournament_id: int,
    squad_id: Optional[int],
    bracket_id: str,
    round_index: int,
    match_index: int,
    score_a: int,
    score_b: int
) -> Optional[Dict[str, Any]]:
    """
    Update a match score and return the updated bracket data.
    
    Returns:
        Updated bracket data or None if not found
    """
    try:
        # Load current brackets
        bracket_record = db.query(SimpleBracket).filter(
            SimpleBracket.tournament_id == tournament_id,
            SimpleBracket.squad_id == squad_id if squad_id else SimpleBracket.squad_id.is_(None),
            SimpleBracket.is_active == True
        ).order_by(SimpleBracket.created_at.desc()).first()
        
        if not bracket_record:
            return None
            
        # Update the match in the JSON data
        bracket_data = ensure_legacy_bracket_views(bracket_record.bracket_data.copy())
        
        # Determine which bracket type and find the match
        if bracket_id.startswith('group:'):
            _, group_key, bracket_index_text = bracket_id.split(':', 2)
            bracket_type = group_key
            bracket_index = int(bracket_index_text)
        elif bracket_id.startswith('scratch_'):
            bracket_type = 'scratch_brackets'
            bracket_index = int(bracket_id.split('_')[1])
        elif bracket_id.startswith('handicap_'):
            bracket_type = 'handicap_brackets'  
            bracket_index = int(bracket_id.split('_')[1])
        else:
            # Single bracket case
            bracket_type = 'rounds'
            bracket_index = None
            
        # Update the specific match
        def apply_score_to_match(match, sa, sb, r_idx):
            match['scoreA'] = sa
            match['scoreB'] = sb
            if sa > sb:
                match['winner'] = 'A'
                match['status'] = 'completed'
                match['both_advance'] = False
                match['split_pot'] = False
            elif sb > sa:
                match['winner'] = 'B'
                match['status'] = 'completed'
                match['both_advance'] = False
                match['split_pot'] = False
            else:
                # Tie
                match['winner'] = None
                if r_idx == 2:  # Finals (round index 2 = Round 3)
                    match['status'] = 'completed'
                    match['both_advance'] = False
                    match['split_pot'] = True
                    match['elimination_notes'] = f"Finals tie - pot split evenly between {match.get('playerA')} and {match.get('playerB')}"
                else:
                    match['status'] = 'both_advance'
                    match['both_advance'] = True
                    match['split_pot'] = False
                    match['elimination_notes'] = f"Tied in Round {r_idx + 1} - both players advance, lower Round {r_idx + 2} score will be eliminated"

        if bracket_type == 'rounds':
            # Single bracket format
            if (round_index < len(bracket_data['rounds']) and
                match_index < len(bracket_data['rounds'][round_index]['matches'])):
                match = bracket_data['rounds'][round_index]['matches'][match_index]
                apply_score_to_match(match, score_a, score_b, round_index)
        elif bracket_id.startswith('group:'):
            group = next((item for item in bracket_data.get('bracket_groups', []) if item.get('key') == bracket_type), None)
            if (group and bracket_index < len(group.get('brackets', [])) and
                'rounds' in group['brackets'][bracket_index] and
                round_index < len(group['brackets'][bracket_index]['rounds']) and
                match_index < len(group['brackets'][bracket_index]['rounds'][round_index]['matches'])):

                match = group['brackets'][bracket_index]['rounds'][round_index]['matches'][match_index]
                apply_score_to_match(match, score_a, score_b, round_index)
        else:
            # Multiple brackets format
            if (bracket_type in bracket_data and
                bracket_index < len(bracket_data[bracket_type]) and
                'rounds' in bracket_data[bracket_type][bracket_index] and
                round_index < len(bracket_data[bracket_type][bracket_index]['rounds']) and
                match_index < len(bracket_data[bracket_type][bracket_index]['rounds'][round_index]['matches'])):

                match = bracket_data[bracket_type][bracket_index]['rounds'][round_index]['matches'][match_index]
                apply_score_to_match(match, score_a, score_b, round_index)
        
        # Save the updated data
        bracket_record.bracket_data = ensure_legacy_bracket_views(bracket_data)
        bracket_record.updated_at = datetime.utcnow()
        
        db.commit()
        
        return bracket_data
        
    except Exception as e:
        db.rollback()
        raise Exception(f"Failed to update match score: {str(e)}")


def hydrate_brackets_with_scores(
    db: Session,
    tournament_id: int,
    squad_id: Optional[int],
    bracket_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Refresh all scores in bracket data by fetching current scores from the score table.
    This ensures brackets always display the latest scores.
    """
    from ..core import models
    
    logger.info(f"Hydrating scores for tournament {tournament_id}, squad {squad_id}")
    bracket_data = ensure_legacy_bracket_views(bracket_data)
    
    # Build a map of bowler_id -> scores
    scores_query = db.query(models.Score).filter(
        models.Score.tournament_id == tournament_id
    )
    if squad_id:
        scores_query = scores_query.filter(models.Score.squad_id == squad_id)
    
    score_records = scores_query.all()
    logger.info(f"  Found {len(score_records)} score records in database")
    
    # Build maps for both scratch and total scores
    scores_map_scratch = {
        score.bowler_id: {
            'game1': score.game1_scratch,
            'game2': score.game2_scratch,
            'game3': score.game3_scratch,
        }
        for score in score_records
    }
    
    scores_map_total = {
        score.bowler_id: {
            'game1': score.game1_total,
            'game2': score.game2_total,
            'game3': score.game3_total,
        }
        for score in score_records
    }
    
    # Log sample scores
    for bowler_id in list(scores_map_total.keys())[:3]:
        scratch = scores_map_scratch.get(bowler_id, {})
        total = scores_map_total.get(bowler_id, {})
        logger.debug(f"    Bowler {bowler_id}: Scratch=(G1={scratch.get('game1')}, G2={scratch.get('game2')}, G3={scratch.get('game3')}), Total=(G1={total.get('game1')}, G2={total.get('game2')}, G3={total.get('game3')})")
    
    # Build a name -> bowler_id lookup from all round-1 matches across all brackets.
    # This lets us resolve player IDs in round 2+ slots that only have player names
    # (which happens when advance_winner_to_next_round didn't propagate IDs).
    name_to_id: Dict[str, int] = {}
    for group, _, bracket in iter_group_brackets(bracket_data):
        rounds = bracket.get('rounds', [])
        if rounds:
            for m in rounds[0].get('matches', []):
                if m.get('playerA') and m.get('playerA_id'):
                    name_to_id[m['playerA']] = m['playerA_id']
                if m.get('playerB') and m.get('playerB_id'):
                    name_to_id[m['playerB']] = m['playerB_id']

    # Helper function to update match scores
    def update_match_scores(match: Dict[str, Any], round_num: int, use_scratch: bool, use_reverse: bool = False):
        """Update scores for a single match based on round number and bracket type"""
        player_a_id = match.get('playerA_id')
        player_b_id = match.get('playerB_id')

        # Fall back to name lookup for round 2+ slots where IDs weren't propagated
        if not player_a_id and match.get('playerA'):
            player_a_id = name_to_id.get(match['playerA'])
            if player_a_id:
                match['playerA_id'] = player_a_id
        if not player_b_id and match.get('playerB'):
            player_b_id = name_to_id.get(match['playerB'])
            if player_b_id:
                match['playerB_id'] = player_b_id

        if not player_a_id or not player_b_id:
            return
        
        # Determine which game to use based on round.
        # Normal brackets: Round 1 = Game 1, Round 2 = Game 2, Round 3 = Game 3.
        # Reverse brackets: Round 1 = Game 3, Round 2 = Game 2, Round 3 = Game 1.
        game_key = f'game{3 - round_num}' if use_reverse else f'game{round_num + 1}'
        
        # Choose the appropriate scores map based on bracket type
        scores_map = scores_map_scratch if use_scratch else scores_map_total
        
        # Get fresh scores
        score_a = scores_map.get(player_a_id, {}).get(game_key)
        score_b = scores_map.get(player_b_id, {}).get(game_key)
        
        # Update match with fresh scores
        old_score_a = match.get('scoreA')
        old_score_b = match.get('scoreB')
        
        match['scoreA'] = score_a
        match['scoreB'] = score_b
        
        if old_score_a != score_a or old_score_b != score_b:
            logger.debug(f"    Updated match: {match.get('playerA')} vs {match.get('playerB')}: {old_score_a}->{score_a}, {old_score_b}->{score_b}")
        
        # Initialize tie-related fields if not present
        if 'both_advance' not in match:
            match['both_advance'] = False
        if 'split_pot' not in match:
            match['split_pot'] = False
        if 'eliminated_player' not in match:
            match['eliminated_player'] = None
        if 'elimination_notes' not in match:
            match['elimination_notes'] = None
        
        # Update winner and status based on scores
        if score_a is not None and score_b is not None:
            if score_a > score_b:
                match['winner'] = 'A'
                match['status'] = 'completed'
                match['both_advance'] = False
                match['split_pot'] = False
            elif score_b > score_a:
                match['winner'] = 'B'
                match['status'] = 'completed'
                match['both_advance'] = False
                match['split_pot'] = False
            else:
                # TIE DETECTED
                # Round 3 (finals) - split pot
                if round_num == 2:  # Round 3 is index 2
                    match['winner'] = None
                    match['status'] = 'completed'
                    match['both_advance'] = False
                    match['split_pot'] = True
                    match['elimination_notes'] = f"Finals tie - pot split evenly between {match.get('playerA')} and {match.get('playerB')}"
                    logger.info(f"  Round 3 tie detected: {match.get('playerA')} vs {match.get('playerB')} - pot split")
                # Round 1 or Round 2 - both advance
                else:
                    match['winner'] = None
                    match['status'] = 'both_advance'
                    match['both_advance'] = True
                    match['split_pot'] = False
                    match['elimination_notes'] = f"Tied in Round {round_num + 1} - both players advance, lower Round {round_num + 2} score will be eliminated"
                    logger.info(f"  Round {round_num + 1} tie detected: {match.get('playerA')} vs {match.get('playerB')} (both {score_a}) - both advance")
        elif score_a is not None or score_b is not None:
            match['status'] = 'in_progress'
            match['winner'] = None
        else:
            match['winner'] = None
            match['status'] = 'pending'
    
    matches_updated = 0
    
    # Update brackets - use_scratch selects scratch vs total scores; use_reverse inverts round→game mapping
    for group, _, bracket in iter_group_brackets(bracket_data):
        scoring_mode = str(group.get('scoring_mode') or '').lower()
        use_scratch = scoring_mode in ('scratch', 'reverse_scratch', 'reverse')
        use_reverse = scoring_mode in ('reverse_scratch', 'reverse_handicap', 'reverse')
        for round_num, round_data in enumerate(bracket.get('rounds', [])):
            for match in round_data.get('matches', []):
                update_match_scores(match, round_num, use_scratch=use_scratch, use_reverse=use_reverse)
                matches_updated += 1
    
    logger.info(f"  Hydrated {matches_updated} matches with fresh scores")

    # PROPAGATE WINNERS ROUND-BY-ROUND
    # If scores were entered via the Scores page only, round 2+ slots are still
    # TBD with no player names/IDs.  We reconstruct bracket progression here:
    # for each completed match, advance the winner into the next round's slot,
    # then re-run score hydration on that slot so the championship gets scored.
    def propagate_and_rehydrate(bracket: Dict, use_scratch: bool, use_reverse: bool = False):
        rounds = bracket.get('rounds', [])
        for round_idx in range(len(rounds) - 1):
            current_matches = rounds[round_idx].get('matches', [])
            next_matches    = rounds[round_idx + 1].get('matches', [])

            changed = False
            for match_idx, match in enumerate(current_matches):
                winner = match.get('winner')
                if winner not in ('A', 'B'):
                    continue

                winner_name = match.get('playerA') if winner == 'A' else match.get('playerB')
                winner_id   = match.get('playerA_id') if winner == 'A' else match.get('playerB_id')

                if not winner_id:
                    continue

                next_idx = match_idx // 2
                if next_idx >= len(next_matches):
                    continue

                nxt = next_matches[next_idx]
                if match_idx % 2 == 0:
                    if nxt.get('playerA_id') != winner_id:
                        nxt['playerA']    = winner_name
                        nxt['playerA_id'] = winner_id
                        changed = True
                else:
                    if nxt.get('playerB_id') != winner_id:
                        nxt['playerB']    = winner_name
                        nxt['playerB_id'] = winner_id
                        changed = True

            if changed:
                # Re-hydrate next round now that player IDs are populated
                for match in next_matches:
                    update_match_scores(match, round_idx + 1, use_scratch, use_reverse=use_reverse)

    for group, _, bracket in iter_group_brackets(bracket_data):
        scoring_mode = str(group.get('scoring_mode') or '').lower()
        propagate_and_rehydrate(
            bracket,
            use_scratch=scoring_mode in ('scratch', 'reverse_scratch', 'reverse'),
            use_reverse=scoring_mode in ('reverse_scratch', 'reverse_handicap', 'reverse'),
        )

    # RESOLVE TIES FROM PREVIOUS ROUNDS
    # This must happen AFTER all matches are updated with fresh scores.
    # Applies to both scratch and handicap brackets.

    def find_player_score_in_round(player_id, matches):
        """Return this player's score from the given round's matches, or None."""
        for m in matches:
            if m.get('playerA_id') == player_id:
                return m.get('scoreA')
            if m.get('playerB_id') == player_id:
                return m.get('scoreB')
        return None

    def resolve_tie_using_next_round(tied_match, next_round_matches, next_round_num, final_round_num):
        """
        Compare the two tied players' scores from the next round.
        - If one is higher → that player wins, other is eliminated.
        - If still tied and more rounds remain → keep both_advance = True (cascade).
        - If still tied in the final round → pot split (already marked by update_match_scores).
        """
        pid_a = tied_match.get('playerA_id')
        pid_b = tied_match.get('playerB_id')

        score_a = find_player_score_in_round(pid_a, next_round_matches)
        score_b = find_player_score_in_round(pid_b, next_round_matches)

        if score_a is None or score_b is None:
            return  # Next round scores not yet entered — leave unresolved

        if score_a > score_b:
            tied_match['winner'] = 'A'
            tied_match['status'] = 'completed'
            tied_match['both_advance'] = False
            tied_match['eliminated_player'] = 'B'
            tied_match['elimination_notes'] = (
                f"Tie resolved in Round {next_round_num}: "
                f"{tied_match.get('playerA')} scored {score_a}, "
                f"{tied_match.get('playerB')} scored {score_b} — "
                f"{tied_match.get('playerB')} eliminated"
            )
            logger.info(f"  Resolved tie: {tied_match.get('playerA')} wins ({score_a} > {score_b} in Round {next_round_num})")

        elif score_b > score_a:
            tied_match['winner'] = 'B'
            tied_match['status'] = 'completed'
            tied_match['both_advance'] = False
            tied_match['eliminated_player'] = 'A'
            tied_match['elimination_notes'] = (
                f"Tie resolved in Round {next_round_num}: "
                f"{tied_match.get('playerB')} scored {score_b}, "
                f"{tied_match.get('playerA')} scored {score_a} — "
                f"{tied_match.get('playerA')} eliminated"
            )
            logger.info(f"  Resolved tie: {tied_match.get('playerB')} wins ({score_b} > {score_a} in Round {next_round_num})")

        else:
            # Still tied after next round
            if next_round_num >= final_round_num:
                # No more rounds — split pot
                tied_match['winner'] = None
                tied_match['status'] = 'completed'
                tied_match['both_advance'] = False
                tied_match['split_pot'] = True
                tied_match['elimination_notes'] = (
                    f"Tied through all {final_round_num} rounds — pot split evenly between "
                    f"{tied_match.get('playerA')} and {tied_match.get('playerB')}"
                )
                logger.info(f"  Tie persists through finals: {tied_match.get('playerA')} vs {tied_match.get('playerB')} — pot split")
            else:
                # Cascade: still tied, both advance again
                tied_match['both_advance'] = True
                tied_match['elimination_notes'] = (
                    f"Still tied after Round {next_round_num} — both advance to Round {next_round_num + 1}"
                )
                logger.info(f"  Tie cascades to Round {next_round_num + 1}: {tied_match.get('playerA')} vs {tied_match.get('playerB')}")

    all_brackets = [bracket for _, _, bracket in iter_group_brackets(bracket_data)]

    for bracket in all_brackets:
        rounds = bracket.get('rounds', [])
        total_rounds = len(rounds)

        for round_idx in range(total_rounds - 1):
            current_matches = rounds[round_idx].get('matches', [])
            next_matches = rounds[round_idx + 1].get('matches', [])

            for match in current_matches:
                if match.get('both_advance') and match.get('scoreA') == match.get('scoreB'):
                    resolve_tie_using_next_round(
                        match,
                        next_matches,
                        next_round_num=round_idx + 2,   # 1-indexed display round
                        final_round_num=total_rounds
                    )

    return bracket_data


def delete_brackets_simple(
    db: Session,
    tournament_id: int,
    squad_id: Optional[int] = None
) -> None:
    """
    Delete all brackets for a tournament/squad by marking them as inactive.
    """
    try:
        db.query(SimpleBracket).filter(
            SimpleBracket.tournament_id == tournament_id,
            SimpleBracket.squad_id == squad_id if squad_id else SimpleBracket.squad_id.is_(None)
        ).update({'is_active': False, 'updated_at': datetime.utcnow()})
        
        db.commit()
        
    except Exception as e:
        db.rollback()
        raise Exception(f"Failed to delete brackets: {str(e)}")


def brackets_exist_simple(
    db: Session,
    tournament_id: int,
    squad_id: Optional[int] = None
) -> bool:
    """Check if active brackets exist for a tournament/squad"""
    count = db.query(SimpleBracket).filter(
        SimpleBracket.tournament_id == tournament_id,
        SimpleBracket.squad_id == squad_id if squad_id else SimpleBracket.squad_id.is_(None),
        SimpleBracket.is_active == True
    ).count()
    return count > 0


# Compatibility alias for legacy imports
def load_generated_brackets(
    db: Session,
    tournament_id: int,
    squad_id: Optional[int] = None
) -> List[dict]:
    """
    Compatibility alias for load_brackets_simple.
    Maintains backward compatibility with existing payouts module.
    """
    return load_brackets_simple(db, tournament_id, squad_id)