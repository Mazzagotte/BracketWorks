"""add structured changelog fields

Revision ID: 0041_structured_changelog
Revises: 0040_duplicate_resolutions
Create Date: 2026-08-23
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0041_structured_changelog"
down_revision = "0040_duplicate_resolutions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("changelog", sa.Column("title", sa.String(length=120), nullable=True))
    op.add_column("changelog", sa.Column("summary", sa.String(length=500), nullable=True))
    op.add_column("changelog", sa.Column("sections", sa.JSON(), nullable=True))
    op.add_column("changelog", sa.Column("tags", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("changelog", "tags")
    op.drop_column("changelog", "sections")
    op.drop_column("changelog", "summary")
    op.drop_column("changelog", "title")
