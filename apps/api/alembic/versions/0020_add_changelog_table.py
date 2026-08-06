"""add changelog table

Revision ID: 0020_add_changelog_table
Revises: 0019_dev_notice_acceptance
Create Date: 2026-07-23
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0020_add_changelog_table"
down_revision = "0019_dev_notice_acceptance"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "changelog",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("version", sa.String(length=20), nullable=False, unique=True),
        sa.Column("date", sa.String(length=10), nullable=False),
        sa.Column("changes", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_changelog_version"), "changelog", ["version"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_changelog_version"), table_name="changelog")
    op.drop_table("changelog")
