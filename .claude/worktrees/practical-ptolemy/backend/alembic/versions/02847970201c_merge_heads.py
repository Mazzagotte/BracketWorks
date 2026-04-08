"""merge_heads

Revision ID: 02847970201c
Revises: 06ae6e1faa6c, d9224bcca692
Create Date: 2025-10-23 15:35:40.648694

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '02847970201c'
down_revision: Union[str, Sequence[str], None] = ('06ae6e1faa6c', 'd9224bcca692')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
