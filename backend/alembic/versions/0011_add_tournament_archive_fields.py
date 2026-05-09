"""add archive fields to tournaments

Revision ID: 0011_tournament_archive
Revises: 0010_add_user_created_at
Create Date: 2026-05-08
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0011_tournament_archive"
down_revision = "0010_add_user_created_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tournaments", sa.Column("archived_at", sa.DateTime(), nullable=True))
    op.add_column("tournaments", sa.Column("archive_reason", sa.String(), nullable=True))
    op.create_index("ix_tournaments_archived_at", "tournaments", ["archived_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_tournaments_archived_at", table_name="tournaments")
    op.drop_column("tournaments", "archive_reason")
    op.drop_column("tournaments", "archived_at")
