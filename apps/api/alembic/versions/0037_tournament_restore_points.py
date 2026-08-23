"""add tournament restore points

Revision ID: 0037_tournament_restore_points
Revises: 0036_tournament_lifecycle
Create Date: 2026-08-21
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0037_tournament_restore_points"
down_revision = "0036_tournament_lifecycle"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tournament_restore_points",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tournament_id", sa.Integer(), sa.ForeignKey("tournaments.id"), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("trigger", sa.String(80), nullable=False),
        sa.Column("summary", sa.String(500), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("activity_watermark_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("restored_at", sa.DateTime(), nullable=True),
        sa.Column("restored_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
    )
    for column in ("tournament_id", "created_by_user_id", "trigger", "created_at"):
        op.create_index(f"ix_tournament_restore_points_{column}", "tournament_restore_points", [column])


def downgrade() -> None:
    op.drop_table("tournament_restore_points")
