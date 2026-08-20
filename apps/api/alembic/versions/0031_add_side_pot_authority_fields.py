"""add side-pot authority fields

Revision ID: 0031_side_pot_authority
Revises: 0030_tc_confirmation_codes
Create Date: 2026-08-20
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0031_side_pot_authority"
down_revision = "0030_tc_confirmation_codes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tournament_bracket_settings",
        sa.Column("side_pots_settings", sa.JSON(), nullable=True),
    )
    op.add_column(
        "tournament_players",
        sa.Column("side_pot_entries", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tournament_players", "side_pot_entries")
    op.drop_column("tournament_bracket_settings", "side_pots_settings")
