"""Add generated brackets storage tables

Revision ID: add_generated_brackets
Revises: 08f4e14df868
Create Date: 2024-12-21 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'add_generated_brackets'
down_revision: Union[str, None] = '08f4e14df868'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Create generated_bracket table to store complete bracket data
    op.create_table(
        'generated_bracket',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tournament_id', sa.Integer(), nullable=False),
        sa.Column('squad_id', sa.Integer(), nullable=True),
        sa.Column('bracket_type', sa.String(20), nullable=False),  # 'scratch' or 'handicap'
        sa.Column('bracket_index', sa.Integer(), nullable=False),  # 0, 1, 2... for multiple brackets of same type
        sa.Column('title', sa.String(100), nullable=False),
        sa.Column('bracket_size', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.String(), nullable=False),
        sa.Column('updated_at', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tournament_id'], ['tournament.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['squad_id'], ['squad.id'], ondelete='CASCADE'),
    )
    
    op.create_index('ix_generated_bracket_tournament', 'generated_bracket', ['tournament_id'])
    op.create_index('ix_generated_bracket_squad', 'generated_bracket', ['squad_id'])
    op.create_index('ix_generated_bracket_type', 'generated_bracket', ['bracket_type'])
    
    # Create bracket_round table to store rounds within brackets
    op.create_table(
        'bracket_round',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('bracket_id', sa.Integer(), nullable=False),
        sa.Column('round_index', sa.Integer(), nullable=False),  # 0, 1, 2... (Round 1, Quarterfinals, etc.)
        sa.Column('round_name', sa.String(50), nullable=False),  # "Round 1", "Quarterfinals", "Semifinals", "Finals"
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['bracket_id'], ['generated_bracket.id'], ondelete='CASCADE'),
    )
    
    op.create_index('ix_bracket_round_bracket', 'bracket_round', ['bracket_id'])
    op.create_index('ix_bracket_round_index', 'bracket_round', ['bracket_id', 'round_index'])
    
    # Create bracket_match table to store individual matches
    op.create_table(
        'bracket_match',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('round_id', sa.Integer(), nullable=False),
        sa.Column('match_index', sa.Integer(), nullable=False),  # 0, 1, 2... within the round
        sa.Column('player_a_id', sa.Integer(), nullable=True),  # bowler.id
        sa.Column('player_a_name', sa.String(100), nullable=True),
        sa.Column('player_a_seed', sa.Integer(), nullable=True),
        sa.Column('player_b_id', sa.Integer(), nullable=True),  # bowler.id  
        sa.Column('player_b_name', sa.String(100), nullable=True),
        sa.Column('player_b_seed', sa.Integer(), nullable=True),
        sa.Column('score_a', sa.Integer(), nullable=True),
        sa.Column('score_b', sa.Integer(), nullable=True),
        sa.Column('winner', sa.String(1), nullable=True),  # 'A' or 'B'
        sa.Column('status', sa.String(20), nullable=False, default='pending'),  # 'pending', 'in_progress', 'completed'
        sa.Column('match_date', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['round_id'], ['bracket_round.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['player_a_id'], ['bowler.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['player_b_id'], ['bowler.id'], ondelete='SET NULL'),
    )
    
    op.create_index('ix_bracket_match_round', 'bracket_match', ['round_id'])
    op.create_index('ix_bracket_match_index', 'bracket_match', ['round_id', 'match_index'])
    op.create_index('ix_bracket_match_status', 'bracket_match', ['status'])
    
    # Create bracket_summary table to store high-level bracket generation summary
    op.create_table(
        'bracket_summary',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tournament_id', sa.Integer(), nullable=False),
        sa.Column('squad_id', sa.Integer(), nullable=True),
        sa.Column('total_scratch_entries', sa.Integer(), nullable=False, default=0),
        sa.Column('total_handicap_entries', sa.Integer(), nullable=False, default=0),
        sa.Column('scratch_brackets_count', sa.Integer(), nullable=False, default=0),
        sa.Column('handicap_brackets_count', sa.Integer(), nullable=False, default=0),
        sa.Column('scratch_placed_entries', sa.Integer(), nullable=False, default=0),
        sa.Column('handicap_placed_entries', sa.Integer(), nullable=False, default=0),
        sa.Column('scratch_refund_entries', sa.Integer(), nullable=False, default=0),
        sa.Column('handicap_refund_entries', sa.Integer(), nullable=False, default=0),
        sa.Column('generation_date', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tournament_id'], ['tournament.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['squad_id'], ['squad.id'], ondelete='CASCADE'),
    )
    
    op.create_index('ix_bracket_summary_tournament', 'bracket_summary', ['tournament_id'])
    op.create_index('ix_bracket_summary_squad', 'bracket_summary', ['squad_id'])

def downgrade() -> None:
    op.drop_table('bracket_summary')
    op.drop_table('bracket_match')
    op.drop_table('bracket_round')
    op.drop_table('generated_bracket')