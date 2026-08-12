"""add tournament central isolated tournament tables

Revision ID: 0025_tc_tournament_tables
Revises: 0024_tournament_setup_state
Create Date: 2026-08-08
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0025_tc_tournament_tables"
down_revision = "0024_tournament_setup_state"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tc_tournaments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("location", sa.String(), nullable=True),
        sa.Column("start_date", sa.String(), nullable=True),
        sa.Column("end_date", sa.String(), nullable=True),
        sa.Column("squad_times", sa.Text(), nullable=True),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    op.create_index("ix_tc_tournaments_id", "tc_tournaments", ["id"], unique=False)
    op.create_index("ix_tc_tournaments_user_id", "tc_tournaments", ["user_id"], unique=False)
    op.create_index("ix_tc_tournaments_is_public", "tc_tournaments", ["is_public"], unique=False)

    op.create_table(
        "tc_tournament_setup_states",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tournament_id", sa.Integer(), sa.ForeignKey("tc_tournaments.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    op.create_index(
        "ix_tc_tournament_setup_states_tournament_id",
        "tc_tournament_setup_states",
        ["tournament_id"],
        unique=True,
    )
    op.create_index(
        "ix_tc_tournament_setup_states_user_id",
        "tc_tournament_setup_states",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_tc_tournament_setup_states_created_at",
        "tc_tournament_setup_states",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        "ix_tc_tournament_setup_states_updated_at",
        "tc_tournament_setup_states",
        ["updated_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_tc_tournament_setup_states_updated_at", table_name="tc_tournament_setup_states")
    op.drop_index("ix_tc_tournament_setup_states_created_at", table_name="tc_tournament_setup_states")
    op.drop_index("ix_tc_tournament_setup_states_user_id", table_name="tc_tournament_setup_states")
    op.drop_index("ix_tc_tournament_setup_states_tournament_id", table_name="tc_tournament_setup_states")
    op.drop_table("tc_tournament_setup_states")

    op.drop_index("ix_tc_tournaments_is_public", table_name="tc_tournaments")
    op.drop_index("ix_tc_tournaments_user_id", table_name="tc_tournaments")
    op.drop_index("ix_tc_tournaments_id", table_name="tc_tournaments")
    op.drop_table("tc_tournaments")
