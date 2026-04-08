"""Add handicap column to bowler table

Revision ID: add_bowler_handicap_col
Revises: abc123entries
Create Date: 2026-03-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_bowler_handicap_col'
down_revision: Union[str, Sequence[str], None] = '3b8ca910e4b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add calculated handicap pins column to bowler."""
    op.add_column('bowler', sa.Column('handicap', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Remove handicap column from bowler."""
    op.drop_column('bowler', 'handicap')
