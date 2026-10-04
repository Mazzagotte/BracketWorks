"""prevent duplicate published TC tournament names per owner

Revision ID: 0044_unique_tc_published_names
Revises: 0043_bowler_profile_average
Create Date: 2026-10-03
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0044_unique_tc_published_names"
down_revision = "0043_bowler_profile_average"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tc_tournaments",
        sa.Column("is_published", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.execute(sa.text(
        """
        UPDATE tc_tournaments
        SET is_published = COALESCE(
            (
                SELECT tc_tournament_setup_states.is_published
                FROM tc_tournament_setup_states
                WHERE tc_tournament_setup_states.tournament_id = tc_tournaments.id
            ),
            FALSE
        )
        """
    ))
    op.alter_column("tc_tournaments", "is_published", server_default=None)
    op.create_index(
        "uq_tc_tournaments_owner_published_name",
        "tc_tournaments",
        ["user_id", sa.text("lower(trim(name))")],
        unique=True,
        postgresql_where=sa.text("is_public IS TRUE OR is_published IS TRUE"),
        sqlite_where=sa.text("is_public = 1 OR is_published = 1"),
    )


def downgrade() -> None:
    op.drop_index("uq_tc_tournaments_owner_published_name", table_name="tc_tournaments")
    tournament_columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("tc_tournaments")}
    if "is_published" in tournament_columns:
        op.drop_column("tc_tournaments", "is_published")