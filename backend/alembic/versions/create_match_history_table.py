"""create match history table

Revision ID: create_match_history
Revises: 
Create Date: 2025-11-07

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'create_match_history'
down_revision = None  # Will be set to the latest migration
branch_labels = None
depends_on = None


def upgrade():
    # Create match_history table to track historical first-round pairings
    op.create_table(
        'match_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tournament_id', sa.Integer(), nullable=False),
        sa.Column('player_a_id', sa.Integer(), nullable=False),
        sa.Column('player_b_id', sa.Integer(), nullable=False),
        sa.Column('bracket_type', sa.String(20), nullable=False),  # 'scratch' or 'handicap'
        sa.Column('bracket_number', sa.Integer(), nullable=True),  # which bracket within the type
        sa.Column('round_number', sa.Integer(), nullable=False),  # 1 for first round
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tournament_id'], ['tournaments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['player_a_id'], ['bowlers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['player_b_id'], ['bowlers.id'], ondelete='CASCADE'),
    )
    
    # Create indexes for efficient querying
    op.create_index('ix_match_history_tournament_id', 'match_history', ['tournament_id'])
    op.create_index('ix_match_history_player_a_id', 'match_history', ['player_a_id'])
    op.create_index('ix_match_history_player_b_id', 'match_history', ['player_b_id'])
    op.create_index('ix_match_history_bracket_type', 'match_history', ['bracket_type'])
    
    # Composite index for common query: get all first-round matches for bracket type
    op.create_index(
        'ix_match_history_type_round',
        'match_history',
        ['bracket_type', 'round_number']
    )


def downgrade():
    op.drop_index('ix_match_history_type_round', table_name='match_history')
    op.drop_index('ix_match_history_bracket_type', table_name='match_history')
    op.drop_index('ix_match_history_player_b_id', table_name='match_history')
    op.drop_index('ix_match_history_player_a_id', table_name='match_history')
    op.drop_index('ix_match_history_tournament_id', table_name='match_history')
    op.drop_table('match_history')
