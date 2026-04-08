"""Add handicap column to bowler for computed handicap pin value

Revision ID: add_bowler_handicap_value
Revises: abc123entries
Create Date: 2026-03-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_bowler_handicap_value'
down_revision: Union[str, None] = 'abc123entries'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add handicap column to store the computed handicap pin value per bowler."""
    op.add_column('bowler', sa.Column('handicap', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Remove the handicap pin value column."""
    op.drop_column('bowler', 'handicap')
