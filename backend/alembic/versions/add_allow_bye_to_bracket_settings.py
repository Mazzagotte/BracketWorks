"""Add allow_bye column to bracket_settings

Revision ID: add_allow_bye_bracket_settings
Revises: 02847970201c
Create Date: 2026-04-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_allow_bye_bracket_settings'
down_revision: Union[str, Sequence[str], None] = '02847970201c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add allow_bye column to bracket_settings table."""
    op.add_column(
        'bracket_settings',
        sa.Column('allow_bye', sa.Boolean(), nullable=True, server_default=sa.false())
    )


def downgrade() -> None:
    """Remove allow_bye column from bracket_settings table."""
    op.drop_column('bracket_settings', 'allow_bye')
