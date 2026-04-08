"""Add performance indexes

Revision ID: performance_indexes
Revises: add_generated_brackets
Create Date: 2025-09-26 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'performance_indexes'
down_revision: Union[str, None] = 'add_generated_brackets'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    """Add performance indexes for frequently queried fields"""
    
    # Composite indexes for frequent queries
    op.create_index('idx_bowler_tournament_squad', 'bowler', ['tournament_id', 'squad_id'])
    op.create_index('idx_score_composite', 'score', ['tournament_id', 'squad_id', 'bowler_id'])
    op.create_index('idx_bracket_tournament_type', 'generated_bracket', ['tournament_id', 'bracket_type'])
    
    # Additional performance indexes
    op.create_index('idx_bowler_name_search', 'bowler', ['name'])
    op.create_index('idx_tournament_date_range', 'tournament', ['start_date', 'end_date'])
    op.create_index('idx_bracket_match_players', 'bracket_match', ['player_a_id', 'player_b_id'])
    
    # Partial indexes for active records
    op.execute("CREATE INDEX idx_bracket_match_active ON bracket_match(status) WHERE status != 'completed'")

def downgrade() -> None:
    """Remove performance indexes"""
    op.drop_index('idx_bracket_match_active')
    op.drop_index('idx_bracket_match_players')
    op.drop_index('idx_tournament_date_range')
    op.drop_index('idx_bowler_name_search')
    op.drop_index('idx_bracket_tournament_type')
    op.drop_index('idx_score_composite')
    op.drop_index('idx_bowler_tournament_squad')