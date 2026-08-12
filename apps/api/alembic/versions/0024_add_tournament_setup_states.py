"""add tournament setup state persistence

Revision ID: 0024_tournament_setup_state
Revises: 0023_legal_disclosure
Create Date: 2026-08-08
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0024_tournament_setup_state"
down_revision = "0023_legal_disclosure"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tournament_setup_states",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tournament_id", sa.Integer(), sa.ForeignKey("tournaments.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    op.create_index(
        "ix_tournament_setup_states_tournament_id",
        "tournament_setup_states",
        ["tournament_id"],
        unique=True,
    )
    op.create_index(
        "ix_tournament_setup_states_user_id",
        "tournament_setup_states",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_tournament_setup_states_created_at",
        "tournament_setup_states",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        "ix_tournament_setup_states_updated_at",
        "tournament_setup_states",
        ["updated_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_tournament_setup_states_updated_at", table_name="tournament_setup_states")
    op.drop_index("ix_tournament_setup_states_created_at", table_name="tournament_setup_states")
    op.drop_index("ix_tournament_setup_states_user_id", table_name="tournament_setup_states")
    op.drop_index("ix_tournament_setup_states_tournament_id", table_name="tournament_setup_states")
    op.drop_table("tournament_setup_states")
