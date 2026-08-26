"""add score correction history

Revision ID: 0038_score_corrections
Revises: 0037_tournament_restore_points
Create Date: 2026-08-22
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0038_score_corrections"
down_revision = "0037_tournament_restore_points"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "score_corrections",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tournament_id", sa.Integer(), sa.ForeignKey("tournaments.id"), nullable=False),
        sa.Column("score_id", sa.Integer(), sa.ForeignKey("player_scores.id"), nullable=False),
        sa.Column("player_id", sa.Integer(), sa.ForeignKey("tournament_players.id"), nullable=False),
        sa.Column("field_name", sa.String(40), nullable=False),
        sa.Column("old_value", sa.Integer(), nullable=True),
        sa.Column("new_value", sa.Integer(), nullable=True),
        sa.Column("reason", sa.String(1000), nullable=False),
        sa.Column("changed_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    for column in ("tournament_id", "score_id", "player_id", "changed_by_user_id", "created_at"):
        op.create_index(f"ix_score_corrections_{column}", "score_corrections", [column])


def downgrade() -> None:
    op.drop_table("score_corrections")
