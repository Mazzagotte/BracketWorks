"""Rename handicap and scratch columns to handicap_entries and scratch_entries

Revision ID: rename_handicap_scratch_to_entries
Revises: performance_indexes
Create Date: 2025-10-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'abc123entries'
down_revision: Union[str, None] = '02847970201c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Rename columns to clarify they represent entry counts"""
    # Rename handicap to handicap_entries
    op.alter_column('bowler', 'handicap',
                    new_column_name='handicap_entries',
                    existing_type=sa.Integer(),
                    existing_nullable=True)
    
    # Rename scratch to scratch_entries
    op.alter_column('bowler', 'scratch',
                    new_column_name='scratch_entries',
                    existing_type=sa.Integer(),
                    existing_nullable=True)


def downgrade() -> None:
    """Revert column names back to original"""
    # Rename handicap_entries back to handicap
    op.alter_column('bowler', 'handicap_entries',
                    new_column_name='handicap',
                    existing_type=sa.Integer(),
                    existing_nullable=True)
    
    # Rename scratch_entries back to scratch
    op.alter_column('bowler', 'scratch_entries',
                    new_column_name='scratch',
                    existing_type=sa.Integer(),
                    existing_nullable=True)
