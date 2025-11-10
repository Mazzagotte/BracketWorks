"""
Simplified bracket persistence - stores brackets as JSON instead of complex relational structure
"""
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, JSON, DateTime, ForeignKey, Boolean
from typing import Dict, Any, Optional, List
from datetime import datetime

from ..core.models import Base

class SimpleBracket(Base):
    """Simplified bracket storage using JSON"""
    __tablename__ = "simple_brackets"
    
    id = Column(Integer, primary_key=True, index=True)
    tournament_id = Column(Integer, ForeignKey("tournament.id"), nullable=False, index=True)
    squad_id = Column(Integer, ForeignKey("squad.id"), nullable=True, index=True)
    bracket_data = Column(JSON, nullable=False)  # Store entire bracket structure as JSON
    bracket_size = Column(Integer, nullable=False, default=8)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True, index=True)


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
        print(f"💾 SAVE DEBUG: Saving brackets to simple_brackets table")
        print(f"  Tournament: {tournament_id}, Squad: {squad_id}")
        print(f"  Bracket count: Scratch={len(brackets_data.get('scratch_brackets', []))}, Handicap={len(brackets_data.get('handicap_brackets', []))}")
        
        # Log first match to verify scores are present
        if brackets_data.get('scratch_brackets'):
            first_bracket = brackets_data['scratch_brackets'][0]
            if first_bracket.get('rounds'):
                first_match = first_bracket['rounds'][0]['matches'][0]
                print(f"  📊 Sample first match being saved:")
                print(f"     {first_match.get('playerA')} (scoreA={first_match.get('scoreA')}) vs {first_match.get('playerB')} (scoreB={first_match.get('scoreB')})")
        
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
            print(f"Warning: Failed to save match history: {hist_error}")
        
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
    
    # Process scratch brackets
    scratch_brackets = brackets_data.get('scratch_brackets', [])
    for bracket_num, bracket in enumerate(scratch_brackets, start=1):
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
                        bracket_type='scratch',
                        bracket_number=bracket_num,
                        round_number=1,
                        created_at=datetime.utcnow()
                    )
                    db.add(history_entry)
    
    # Process handicap brackets
    handicap_brackets = brackets_data.get('handicap_brackets', [])
    for bracket_num, bracket in enumerate(handicap_brackets, start=1):
        rounds = bracket.get('rounds', [])
        if rounds:
            first_round = rounds[0]
            matches = first_round.get('matches', [])
            
            for match in matches:
                player_a_id = match.get('playerA_id')
                player_b_id = match.get('playerB_id')
                
                if player_a_id and player_b_id:
                    history_entry = MatchHistory(
                        tournament_id=tournament_id,
                        player_a_id=min(player_a_id, player_b_id),
                        player_b_id=max(player_a_id, player_b_id),
                        bracket_type='handicap',
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
        print(f"📂 LOAD DEBUG: Loading brackets from simple_brackets table")
        print(f"  Tournament: {tournament_id}, Squad: {squad_id}, Refresh scores: {refresh_scores}")
        
        bracket_record = db.query(SimpleBracket).filter(
            SimpleBracket.tournament_id == tournament_id,
            SimpleBracket.squad_id == squad_id if squad_id else SimpleBracket.squad_id.is_(None),
            SimpleBracket.is_active == True
        ).order_by(SimpleBracket.created_at.desc()).first()
        
        if not bracket_record:
            print(f"  ❌ No brackets found")
            return None
        
        print(f"  ✅ Found brackets created at {bracket_record.created_at}")
        
        # Log first match to verify scores are in loaded data
        bracket_data = bracket_record.bracket_data
        
        # Refresh scores from database if requested
        if refresh_scores:
            print(f"  🔄 Refreshing scores from database...")
            bracket_data = hydrate_brackets_with_scores(db, tournament_id, squad_id, bracket_data)
        
        if bracket_data.get('scratch_brackets'):
            first_bracket = bracket_data['scratch_brackets'][0]
            if first_bracket.get('rounds'):
                first_match = first_bracket['rounds'][0]['matches'][0]
                print(f"  📊 Sample first match being loaded:")
                print(f"     {first_match.get('playerA')} (scoreA={first_match.get('scoreA')}) vs {first_match.get('playerB')} (scoreB={first_match.get('scoreB')})")
            
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
        bracket_data = bracket_record.bracket_data.copy()
        
        # Determine which bracket type and find the match
        if bracket_id.startswith('scratch_'):
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
        if bracket_type == 'rounds':
            # Single bracket format
            if (round_index < len(bracket_data['rounds']) and 
                match_index < len(bracket_data['rounds'][round_index]['matches'])):
                match = bracket_data['rounds'][round_index]['matches'][match_index]
                match['scoreA'] = score_a
                match['scoreB'] = score_b
                match['winner'] = 'A' if score_a > score_b else 'B'
                match['status'] = 'completed'
        else:
            # Multiple brackets format
            if (bracket_type in bracket_data and 
                bracket_index < len(bracket_data[bracket_type]) and
                'rounds' in bracket_data[bracket_type][bracket_index] and
                round_index < len(bracket_data[bracket_type][bracket_index]['rounds']) and
                match_index < len(bracket_data[bracket_type][bracket_index]['rounds'][round_index]['matches'])):
                
                match = bracket_data[bracket_type][bracket_index]['rounds'][round_index]['matches'][match_index]
                match['scoreA'] = score_a
                match['scoreB'] = score_b
                match['winner'] = 'A' if score_a > score_b else 'B'
                match['status'] = 'completed'
        
        # Save the updated data
        bracket_record.bracket_data = bracket_data
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
    
    print(f"🔄 HYDRATE: Refreshing scores for tournament {tournament_id}, squad {squad_id}")
    
    # Build a map of bowler_id -> scores
    scores_query = db.query(models.Score).filter(
        models.Score.tournament_id == tournament_id
    )
    if squad_id:
        scores_query = scores_query.filter(models.Score.squad_id == squad_id)
    
    score_records = scores_query.all()
    print(f"  📊 Found {len(score_records)} score records in database")
    
    scores_map = {
        score.bowler_id: {
            'game1_total': score.game1_total,
            'game2_total': score.game2_total,
            'game3_total': score.game3_total,
        }
        for score in score_records
    }
    
    # Log sample scores
    for bowler_id, scores in list(scores_map.items())[:3]:
        print(f"    Bowler {bowler_id}: G1={scores['game1_total']}, G2={scores['game2_total']}, G3={scores['game3_total']}")
    
    # Helper function to update match scores
    def update_match_scores(match: Dict[str, Any], round_num: int):
        """Update scores for a single match based on round number"""
        player_a_id = match.get('playerA_id')
        player_b_id = match.get('playerB_id')
        
        if not player_a_id or not player_b_id:
            return
        
        # Determine which game to use based on round (1-indexed in display, 0-indexed in code)
        game_field = f'game{round_num + 1}_total'
        
        # Get fresh scores
        score_a = scores_map.get(player_a_id, {}).get(game_field)
        score_b = scores_map.get(player_b_id, {}).get(game_field)
        
        # Update match with fresh scores
        old_score_a = match.get('scoreA')
        old_score_b = match.get('scoreB')
        
        match['scoreA'] = score_a
        match['scoreB'] = score_b
        
        if old_score_a != score_a or old_score_b != score_b:
            print(f"    ✏️  Updated match: {match.get('playerA')} vs {match.get('playerB')}: {old_score_a}→{score_a}, {old_score_b}→{score_b}")
        
        # Update winner and status based on scores
        if score_a is not None and score_b is not None:
            if score_a > score_b:
                match['winner'] = 'A'
                match['status'] = 'completed'
            elif score_b > score_a:
                match['winner'] = 'B'
                match['status'] = 'completed'
            else:
                match['winner'] = None
                match['status'] = 'tied'
        elif score_a is not None or score_b is not None:
            match['status'] = 'in_progress'
        else:
            match['winner'] = None
            match['status'] = 'pending'
    
    matches_updated = 0
    
    # Update scratch brackets
    for bracket in bracket_data.get('scratch_brackets', []):
        for round_num, round_data in enumerate(bracket.get('rounds', [])):
            for match in round_data.get('matches', []):
                update_match_scores(match, round_num)
                matches_updated += 1
    
    # Update handicap brackets
    for bracket in bracket_data.get('handicap_brackets', []):
        for round_num, round_data in enumerate(bracket.get('rounds', [])):
            for match in round_data.get('matches', []):
                update_match_scores(match, round_num)
                matches_updated += 1
    
    print(f"  ✅ Hydrated {matches_updated} matches with fresh scores")
    
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