"""add account active state for unverified account cleanup

Revision ID: 0028_account_lifecycle
Revises: 0027_user_feedback_messages
Create Date: 2026-08-16
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0028_account_lifecycle"
down_revision = "0027_user_feedback_messages"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.create_index("ix_users_is_active", "users", ["is_active"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_users_is_active", table_name="users")
    op.drop_column("users", "is_active")