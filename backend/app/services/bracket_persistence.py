"""
Bracket persistence utilities for saving/loading generated brackets to/from database
"""
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from datetime import datetime
from ..core.models import GeneratedBracket, BracketRound, BracketMatch, BracketSummary


def save_generated_brackets(
    db: Session,
    tournament_id: int,
    squad_id: Optional[int],
    brackets_data: Dict[str, Any]
) -> None:
    """
    Save generated brackets to database, replacing any existing brackets for the tournament/squad.
    
    Args:
        db: Database session
        tournament_id: ID of the tournament
        squad_id: ID of the squad (optional)
        brackets_data: The bracket data returned from generate_multiple_brackets()
    """
    try:
        # First, delete any existing brackets for this tournament/squad
        delete_existing_brackets(db, tournament_id, squad_id)
        
        # Save summary information
        summary_data = brackets_data.get('summary', {})
        bracket_summary = BracketSummary(
            tournament_id=tournament_id,
            squad_id=squad_id,
            total_scratch_entries=summary_data.get('total_scratch_entries', 0),
            total_handicap_entries=summary_data.get('total_handicap_entries', 0),
            scratch_brackets_count=summary_data.get('scratch_brackets_count', 0),
            handicap_brackets_count=summary_data.get('handicap_brackets_count', 0),
            scratch_placed_entries=summary_data.get('scratch_placed_entries', 0),
            handicap_placed_entries=summary_data.get('handicap_placed_entries', 0),
            scratch_refund_entries=summary_data.get('scratch_refund_entries', 0),
            handicap_refund_entries=summary_data.get('handicap_refund_entries', 0),
            generation_date=datetime.now().isoformat()
        )
        db.add(bracket_summary)
        db.flush()  # Get the ID
        
        # Save scratch brackets
        scratch_brackets = brackets_data.get('scratch_brackets', [])
        for bracket_index, bracket in enumerate(scratch_brackets):
            _save_bracket(db, tournament_id, squad_id, 'scratch', bracket_index, bracket, brackets_data.get('bracket_size', 8))
        
        # Save handicap brackets
        handicap_brackets = brackets_data.get('handicap_brackets', [])
        for bracket_index, bracket in enumerate(handicap_brackets):
            _save_bracket(db, tournament_id, squad_id, 'handicap', bracket_index, bracket, brackets_data.get('bracket_size', 8))
        
        db.commit()
        
    except Exception as e:
        db.rollback()
        raise Exception(f"Failed to save brackets: {str(e)}")


def _save_bracket(
    db: Session,
    tournament_id: int,
    squad_id: Optional[int],
    bracket_type: str,
    bracket_index: int,
    bracket_data: Dict[str, Any],
    bracket_size: int
) -> None:
    """Save a single bracket with its rounds and matches"""
    
    # Create the bracket record
    generated_bracket = GeneratedBracket(
        tournament_id=tournament_id,
        squad_id=squad_id,
        bracket_type=bracket_type,
        bracket_index=bracket_index,
        title=bracket_data.get('title', f'{bracket_type.title()} Bracket {bracket_index + 1}'),
        bracket_size=bracket_size,
        created_at=datetime.now().isoformat(),
        updated_at=datetime.now().isoformat()
    )
    db.add(generated_bracket)
    db.flush()  # Get the bracket ID
    
    # Save rounds
    rounds_data = bracket_data.get('rounds', [])
    for round_index, round_data in enumerate(rounds_data):
        bracket_round = BracketRound(
            bracket_id=generated_bracket.id,
            round_index=round_index,
            round_name=round_data.get('name', f'Round {round_index + 1}')
        )
        db.add(bracket_round)
        db.flush()  # Get the round ID
        
        # Save matches for this round
        matches_data = round_data.get('matches', [])
        for match_index, match_data in enumerate(matches_data):
            bracket_match = BracketMatch(
                round_id=bracket_round.id,
                match_index=match_index,
                player_a_id=match_data.get('playerA_id'),  # If we have bowler IDs
                player_a_name=match_data.get('playerA'),
                player_a_seed=match_data.get('seedA'),
                player_b_id=match_data.get('playerB_id'),  # If we have bowler IDs
                player_b_name=match_data.get('playerB'),
                player_b_seed=match_data.get('seedB'),
                score_a=match_data.get('scoreA'),
                score_b=match_data.get('scoreB'),
                winner=match_data.get('winner'),
                status=match_data.get('status', 'pending'),
                match_date=match_data.get('match_date')
            )
            db.add(bracket_match)


def load_generated_brackets(
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
        # Get the summary
        summary = db.query(BracketSummary).filter(
            BracketSummary.tournament_id == tournament_id,
            BracketSummary.squad_id == squad_id if squad_id else BracketSummary.squad_id.is_(None)
        ).first()
        
        if not summary:
            return None
        
        # Get all brackets for this tournament/squad
        brackets_query = db.query(GeneratedBracket).filter(
            GeneratedBracket.tournament_id == tournament_id,
            GeneratedBracket.squad_id == squad_id if squad_id else GeneratedBracket.squad_id.is_(None)
        ).order_by(GeneratedBracket.bracket_type, GeneratedBracket.bracket_index)
        
        brackets = brackets_query.all()
        if not brackets:
            return None
        
        # Organize brackets by type
        scratch_brackets = []
        handicap_brackets = []
        
        for bracket in brackets:
            bracket_data = _load_bracket_data(db, bracket)
            
            if bracket.bracket_type == 'scratch':
                scratch_brackets.append(bracket_data)
            elif bracket.bracket_type == 'handicap':
                handicap_brackets.append(bracket_data)
        
        # Build the response format
        result = {
            'summary': {
                'total_scratch_entries': summary.total_scratch_entries,
                'total_handicap_entries': summary.total_handicap_entries,
                'scratch_brackets_count': summary.scratch_brackets_count,
                'handicap_brackets_count': summary.handicap_brackets_count,
                'scratch_placed_entries': summary.scratch_placed_entries,
                'handicap_placed_entries': summary.handicap_placed_entries,
                'scratch_refund_entries': summary.scratch_refund_entries,
                'handicap_refund_entries': summary.handicap_refund_entries,
            },
            'scratch_brackets': scratch_brackets,
            'handicap_brackets': handicap_brackets,
            'bracket_size': brackets[0].bracket_size if brackets else 8
        }
        
        return result
        
    except Exception as e:
        raise Exception(f"Failed to load brackets: {str(e)}")


def _load_bracket_data(db: Session, bracket: GeneratedBracket) -> Dict[str, Any]:
    """Load a single bracket with its rounds and matches"""
    
    # Get rounds for this bracket
    rounds_query = db.query(BracketRound).filter(
        BracketRound.bracket_id == bracket.id
    ).order_by(BracketRound.round_index)
    
    rounds = []
    for round_record in rounds_query:
        # Get matches for this round
        matches_query = db.query(BracketMatch).filter(
            BracketMatch.round_id == round_record.id
        ).order_by(BracketMatch.match_index)
        
        matches = []
        for match_record in matches_query:
            match_data = {
                'playerA': match_record.player_a_name,
                'playerB': match_record.player_b_name,
                'seedA': match_record.player_a_seed,
                'seedB': match_record.player_b_seed,
                'scoreA': match_record.score_a,
                'scoreB': match_record.score_b,
                'winner': match_record.winner,
                'status': match_record.status,
                'match_date': match_record.match_date
            }
            # Include bowler IDs if available
            if match_record.player_a_id:
                match_data['playerA_id'] = match_record.player_a_id
            if match_record.player_b_id:
                match_data['playerB_id'] = match_record.player_b_id
                
            matches.append(match_data)
        
        rounds.append({
            'name': round_record.round_name,
            'matches': matches
        })
    
    return {
        'title': bracket.title,
        'rounds': rounds
    }


def delete_existing_brackets(
    db: Session,
    tournament_id: int,
    squad_id: Optional[int]
) -> None:
    """
    Delete all existing brackets for a tournament/squad.
    This will cascade delete all related rounds, matches, etc.
    """
    try:
        # Delete summary
        db.query(BracketSummary).filter(
            BracketSummary.tournament_id == tournament_id,
            BracketSummary.squad_id == squad_id if squad_id else BracketSummary.squad_id.is_(None)
        ).delete()
        
        # Delete brackets (this will cascade delete rounds and matches due to foreign key constraints)
        db.query(GeneratedBracket).filter(
            GeneratedBracket.tournament_id == tournament_id,
            GeneratedBracket.squad_id == squad_id if squad_id else GeneratedBracket.squad_id.is_(None)
        ).delete()
        
        db.commit()
        
    except Exception as e:
        db.rollback()
        raise Exception(f"Failed to delete existing brackets: {str(e)}")


def bracket_exists(
    db: Session,
    tournament_id: int,
    squad_id: Optional[int] = None
) -> bool:
    """Check if brackets exist for a tournament/squad"""
    count = db.query(GeneratedBracket).filter(
        GeneratedBracket.tournament_id == tournament_id,
        GeneratedBracket.squad_id == squad_id if squad_id else GeneratedBracket.squad_id.is_(None)
    ).count()
    return count > 0