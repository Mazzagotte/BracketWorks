"""add is_public to tournaments

Revision ID: 0018_add_tournament_is_public
Revises: 0017_add_snapshot_player_count
Create Date: 2026-06-07
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0018_add_tournament_is_public"
down_revision = "0017_add_snapshot_player_count"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tournaments",
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_tournaments_is_public", "tournaments", ["is_public"], unique=False)
    op.alter_column("tournaments", "is_public", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_tournaments_is_public", table_name="tournaments")
    op.drop_column("tournaments", "is_public")
