"""add user feedback messages

Revision ID: 0027_user_feedback_messages
Revises: 0026_tc_tournament_logo_columns
Create Date: 2026-08-16
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0027_user_feedback_messages"
down_revision = "0026_tc_tournament_logo_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_feedback_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("subject", sa.String(160), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("admin_note", sa.Text(), nullable=True),
        sa.Column("resolved_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    for column in ("user_id", "category", "status", "created_at"):
        op.create_index(f"ix_user_feedback_messages_{column}", "user_feedback_messages", [column])


def downgrade() -> None:
    for column in ("created_at", "status", "category", "user_id"):
        op.drop_index(f"ix_user_feedback_messages_{column}", table_name="user_feedback_messages")
    op.drop_table("user_feedback_messages")