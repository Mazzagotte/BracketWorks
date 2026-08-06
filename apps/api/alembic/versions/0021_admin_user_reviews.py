"""add non-destructive administrator user reviews

Revision ID: 0021_admin_user_reviews
Revises: 0020_add_changelog_table
Create Date: 2026-08-02
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0021_admin_user_reviews"
down_revision = "0020_add_changelog_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "admin_user_reviews",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("admin_user_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("category", sa.String(length=40), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("is_resolved", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("resolved_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["admin_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["resolved_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("user_id", "admin_user_id", "kind", "category", "is_resolved", "created_at"):
        op.create_index(f"ix_admin_user_reviews_{column}", "admin_user_reviews", [column], unique=False)


def downgrade() -> None:
    for column in reversed(("user_id", "admin_user_id", "kind", "category", "is_resolved", "created_at")):
        op.drop_index(f"ix_admin_user_reviews_{column}", table_name="admin_user_reviews")
    op.drop_table("admin_user_reviews")
