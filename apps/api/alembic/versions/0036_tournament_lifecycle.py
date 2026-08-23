"""add tournament lifecycle fields

Revision ID: 0036_tournament_lifecycle
Revises: 0035_tournament_staff
Create Date: 2026-08-21
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0036_tournament_lifecycle"
down_revision = "0035_tournament_staff"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tournaments", sa.Column("lifecycle_status", sa.String(32), nullable=False, server_default="setup"))
    op.add_column("tournaments", sa.Column("scores_locked", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("tournaments", sa.Column("finalized_at", sa.DateTime(), nullable=True))
    op.add_column("tournaments", sa.Column("finalized_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))
    op.create_index("ix_tournaments_lifecycle_status", "tournaments", ["lifecycle_status"])
    op.create_index("ix_tournaments_scores_locked", "tournaments", ["scores_locked"])
    op.create_index("ix_tournaments_finalized_at", "tournaments", ["finalized_at"])


def downgrade() -> None:
    op.drop_index("ix_tournaments_finalized_at", table_name="tournaments")
    op.drop_index("ix_tournaments_scores_locked", table_name="tournaments")
    op.drop_index("ix_tournaments_lifecycle_status", table_name="tournaments")
    op.drop_column("tournaments", "finalized_by_user_id")
    op.drop_column("tournaments", "finalized_at")
    op.drop_column("tournaments", "scores_locked")
    op.drop_column("tournaments", "lifecycle_status")
