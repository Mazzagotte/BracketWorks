"""add created_at to users

Revision ID: 0010_add_user_created_at
Revises: 0009_add_bowler_profiles
Create Date: 2026-05-08
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0010_add_user_created_at"
down_revision = "0009_add_bowler_profiles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("created_at", sa.DateTime(), nullable=True, server_default=sa.text("now()")))
    op.execute("UPDATE users SET created_at = NOW() WHERE created_at IS NULL")
    op.alter_column("users", "created_at", existing_type=sa.DateTime(), nullable=False)


def downgrade() -> None:
    op.drop_column("users", "created_at")
