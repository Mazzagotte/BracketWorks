"""add logo storage columns for tc tournaments

Revision ID: 0026_tc_tournament_logo_columns
Revises: 0025_tc_tournament_tables
Create Date: 2026-08-08
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0026_tc_tournament_logo_columns"
down_revision = "0025_tc_tournament_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tc_tournaments", sa.Column("logo_blob", sa.LargeBinary(), nullable=True))
    op.add_column("tc_tournaments", sa.Column("logo_mime_type", sa.String(), nullable=True))
    op.add_column("tc_tournaments", sa.Column("logo_file_name", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("tc_tournaments", "logo_file_name")
    op.drop_column("tc_tournaments", "logo_mime_type")
    op.drop_column("tc_tournaments", "logo_blob")
