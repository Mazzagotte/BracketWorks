"""link Tournament Central tournaments to BracketWorks tournaments

Revision ID: 0049_tc_bracketworks_link
Revises: 0048_tc_bowler_check_in
Create Date: 2026-11-07
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0049_tc_bracketworks_link"
down_revision = "0048_tc_bowler_check_in"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tc_bracketworks_links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tc_tournament_id", sa.Integer(), sa.ForeignKey("tc_tournaments.id"), nullable=False),
        sa.Column("bw_tournament_id", sa.Integer(), sa.ForeignKey("tournaments.id"), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("last_synced_at", sa.DateTime(), nullable=True),
        sa.Column("last_sync_summary", sa.JSON(), nullable=True),
    )
    op.create_index("ix_tc_bracketworks_links_id", "tc_bracketworks_links", ["id"])
    op.create_index(
        "ix_tc_bracketworks_links_tc_tournament_id", "tc_bracketworks_links", ["tc_tournament_id"], unique=True
    )
    op.create_index(
        "ix_tc_bracketworks_links_bw_tournament_id", "tc_bracketworks_links", ["bw_tournament_id"], unique=True
    )

    with op.batch_alter_table("tournament_players") as batch_op:
        batch_op.add_column(sa.Column("source", sa.String(16), nullable=True))
        batch_op.add_column(sa.Column("source_ref", sa.String(160), nullable=True))
    op.create_index(
        "uq_tournament_players_source_ref",
        "tournament_players",
        ["tournament_id", "source_ref"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_tournament_players_source_ref", table_name="tournament_players")
    with op.batch_alter_table("tournament_players") as batch_op:
        batch_op.drop_column("source_ref")
        batch_op.drop_column("source")

    op.drop_index("ix_tc_bracketworks_links_bw_tournament_id", table_name="tc_bracketworks_links")
    op.drop_index("ix_tc_bracketworks_links_tc_tournament_id", table_name="tc_bracketworks_links")
    op.drop_index("ix_tc_bracketworks_links_id", table_name="tc_bracketworks_links")
    op.drop_table("tc_bracketworks_links")
