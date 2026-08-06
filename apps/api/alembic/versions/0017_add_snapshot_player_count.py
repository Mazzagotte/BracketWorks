"""add player_count to bracket_snapshots

Revision ID: 0016_add_snapshot_player_count
Revises: 0015_password_reset_tokens
Create Date: 2026-05-27
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0017_add_snapshot_player_count"
down_revision = "0016_email_verification_tokens"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("bracket_snapshots", sa.Column("player_count", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("bracket_snapshots", "player_count")
