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
                        created_at=datetime.utcnow().isoformat()
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
                        created_at=datetime.utcnow().isoformat()
                    )
                    db.add(history_entry)
    
    # Don't commit here - let the parent function handle the transaction


def load_brackets_simple(
    db: Session,
    tournament_id: int,
    squad_id: Optional[int] = None
) -> Optional[Dict[str, Any]]:
    """
    Load saved brackets for a tournament/squad from database.
    
    Returns:
        Dictionary matching the format returned by generate_multiple_brackets(), or None if no brackets found
    """
    try:
        bracket_record = db.query(SimpleBracket).filter(
            SimpleBracket.tournament_id == tournament_id,
            SimpleBracket.squad_id == squad_id if squad_id else SimpleBracket.squad_id.is_(None),
            SimpleBracket.is_active == True
        ).order_by(SimpleBracket.created_at.desc()).first()
        
        if not bracket_record:
            return None
            
        return bracket_record.bracket_data
        
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