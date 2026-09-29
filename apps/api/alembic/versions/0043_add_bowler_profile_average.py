"""add reusable bowler profile average

Revision ID: 0043_bowler_profile_average
Revises: 0042_hardening_pass
Create Date: 2026-09-28
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0043_bowler_profile_average"
down_revision = "0042_hardening_pass"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("bowler_profiles", sa.Column("average", sa.Integer(), nullable=True))
    op.execute(sa.text(
        """
        UPDATE bowler_profiles
        SET average = (
            SELECT tournament_players.average
            FROM tournament_players
            WHERE tournament_players.bowler_profile_id = bowler_profiles.id
              AND tournament_players.average IS NOT NULL
            ORDER BY tournament_players.id DESC
            LIMIT 1
        )
        """
    ))


def downgrade() -> None:
    op.drop_column("bowler_profiles", "average")