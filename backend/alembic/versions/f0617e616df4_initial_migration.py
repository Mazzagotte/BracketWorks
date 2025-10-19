"""Initial migration

Revision ID: f0617e616df4
Revises: 
Create Date: 2025-09-22 07:42:51.575195

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f0617e616df4'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create users table
    op.create_table('users',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('username', sa.String(), nullable=False, index=True),
        sa.Column('email', sa.String(), nullable=False, index=True),
        sa.Column('first_name', sa.String(), nullable=False),
        sa.Column('last_name', sa.String(), nullable=False),
        sa.Column('organization', sa.String(), nullable=True),
        sa.Column('password', sa.String(), nullable=False),
        sa.Column('is_admin', sa.Boolean(), default=False),
    )
    op.create_index('ix_users_username', 'users', ['username'], unique=True)
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    
    # Create tournament table
    op.create_table('tournament',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('location', sa.String(), nullable=True),
        sa.Column('start_date', sa.String(), nullable=True),
        sa.Column('end_date', sa.String(), nullable=True),
        sa.Column('squad_times', sa.Text(), nullable=True),
    )
    
    # Create squad table
    op.create_table('squad',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('tournament_id', sa.Integer(), sa.ForeignKey('tournament.id'), nullable=False, index=True),
        sa.Column('date', sa.String(), nullable=False),
        sa.Column('time', sa.String(), nullable=False),
    )
    
    # Create selected_squad table
    op.create_table('selected_squad',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('squad_id', sa.Integer(), sa.ForeignKey('squad.id'), nullable=False, index=True),
    )
    
    # Create bowler table
    op.create_table('bowler',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('average', sa.Integer(), nullable=True),
        sa.Column('handicap', sa.Integer(), nullable=True),
        sa.Column('scratch', sa.Integer(), nullable=True),
        sa.Column('lane', sa.String(), nullable=True),
        sa.Column('division', sa.String(), nullable=True, default='Open'),
        sa.Column('usbc', sa.String(), nullable=True),
        sa.Column('amount_paid', sa.Float(), nullable=True, default=0.0),
    )
    
    # Create bracket table
    op.create_table('bracket',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('squad', sa.String(), nullable=True),
        sa.Column('game_count', sa.Integer(), default=3),
    )
    
    # Create bracket_settings table
    op.create_table('bracket_settings',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('tournament_id', sa.Integer(), sa.ForeignKey('tournament.id'), nullable=False, index=True),
        sa.Column('bracket_size', sa.Integer(), nullable=True),
        sa.Column('first_place', sa.Float(), nullable=True),
        sa.Column('second_place', sa.Float(), nullable=True),
        sa.Column('house_amount', sa.Float(), nullable=True),
        sa.Column('cost_per_bracket', sa.Float(), nullable=True),
        sa.Column('handicap_percentage', sa.Float(), nullable=True, default=80.0),
        sa.Column('handicap_base', sa.Float(), nullable=True, default=200.0),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('bracket_settings')
    op.drop_table('bracket')
    op.drop_table('bowler')
    op.drop_table('selected_squad')
    op.drop_table('squad')
    op.drop_table('tournament')
    op.drop_table('users')
