"""add_simple_brackets_table_only

Revision ID: d9224bcca692
Revises: add_generated_brackets
Create Date: 2025-10-20 18:43:17.219413

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd9224bcca692'
down_revision: Union[str, Sequence[str], None] = 'add_generated_brackets'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
