"""merge historical players and match history branches

Revision ID: 3b8ca910e4b7
Revises: abc123entries, create_match_history
Create Date: 2025-11-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3b8ca910e4b7'
down_revision: Union[str, Sequence[str], None] = ('abc123entries', 'create_match_history')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
