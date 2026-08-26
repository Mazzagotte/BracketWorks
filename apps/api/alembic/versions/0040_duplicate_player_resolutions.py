"""add duplicate player resolutions

Revision ID: 0040_duplicate_resolutions
Revises: 0039_payout_adjustments
Create Date: 2026-08-22
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0040_duplicate_resolutions"
down_revision = "0039_payout_adjustments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "duplicate_player_resolutions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tournament_id", sa.Integer(), sa.ForeignKey("tournaments.id"), nullable=False),
        sa.Column("left_player_id", sa.Integer(), sa.ForeignKey("tournament_players.id"), nullable=False),
        sa.Column("right_player_id", sa.Integer(), sa.ForeignKey("tournament_players.id"), nullable=False),
        sa.Column("resolution", sa.String(30), nullable=False),
        sa.Column("resolved_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("tournament_id", "left_player_id", "right_player_id", name="uq_duplicate_player_pair"),
    )
    for column in ("tournament_id", "left_player_id", "right_player_id", "resolved_by_user_id", "created_at"):
        op.create_index(f"ix_duplicate_player_resolutions_{column}", "duplicate_player_resolutions", [column])


def downgrade() -> None:
    op.drop_table("duplicate_player_resolutions")
