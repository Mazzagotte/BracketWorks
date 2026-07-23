"""add dev notice acceptance fields to users

Revision ID: 0019_dev_notice_acceptance
Revises: 0018_add_tournament_is_public
Create Date: 2026-07-23
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0019_dev_notice_acceptance"
down_revision = "0018_add_tournament_is_public"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("dev_notice_version_accepted", sa.String(length=10), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("dev_notice_accepted_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "dev_notice_accepted_at")
    op.drop_column("users", "dev_notice_version_accepted")
