"""add tc venues and venue link on tc tournaments

Revision ID: 0032_tc_venues
Revises: 0031_tc_side_pot_authority
Create Date: 2026-08-20
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0032_tc_venues"
down_revision = "0031_side_pot_authority"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tc_venues",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("address_line_1", sa.String(length=255), nullable=True),
        sa.Column("address_line_2", sa.String(length=255), nullable=True),
        sa.Column("city", sa.String(length=120), nullable=True),
        sa.Column("state", sa.String(length=32), nullable=True),
        sa.Column("zip", sa.String(length=20), nullable=True),
        sa.Column("country", sa.String(length=64), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("external_provider", sa.String(length=64), nullable=True),
        sa.Column("external_place_id", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=40), nullable=True),
        sa.Column("website", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    op.create_index("ix_tc_venues_id", "tc_venues", ["id"], unique=False)
    op.create_index("ix_tc_venues_name", "tc_venues", ["name"], unique=False)
    op.create_index("ix_tc_venues_state", "tc_venues", ["state"], unique=False)
    op.create_index("ix_tc_venues_external_provider", "tc_venues", ["external_provider"], unique=False)
    op.create_index("ix_tc_venues_external_place_id", "tc_venues", ["external_place_id"], unique=False)
    op.create_index("ix_tc_venues_created_at", "tc_venues", ["created_at"], unique=False)
    op.create_index("ix_tc_venues_updated_at", "tc_venues", ["updated_at"], unique=False)
    op.create_unique_constraint(
        "uq_tc_venues_external_place",
        "tc_venues",
        ["external_provider", "external_place_id"],
    )

    op.add_column("tc_tournaments", sa.Column("venue_id", sa.Integer(), nullable=True))
    op.create_index("ix_tc_tournaments_venue_id", "tc_tournaments", ["venue_id"], unique=False)
    op.create_foreign_key(
        "fk_tc_tournaments_venue_id_tc_venues",
        "tc_tournaments",
        "tc_venues",
        ["venue_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_tc_tournaments_venue_id_tc_venues", "tc_tournaments", type_="foreignkey")
    op.drop_index("ix_tc_tournaments_venue_id", table_name="tc_tournaments")
    op.drop_column("tc_tournaments", "venue_id")

    op.drop_constraint("uq_tc_venues_external_place", "tc_venues", type_="unique")
    op.drop_index("ix_tc_venues_updated_at", table_name="tc_venues")
    op.drop_index("ix_tc_venues_created_at", table_name="tc_venues")
    op.drop_index("ix_tc_venues_external_place_id", table_name="tc_venues")
    op.drop_index("ix_tc_venues_external_provider", table_name="tc_venues")
    op.drop_index("ix_tc_venues_state", table_name="tc_venues")
    op.drop_index("ix_tc_venues_name", table_name="tc_venues")
    op.drop_index("ix_tc_venues_id", table_name="tc_venues")
    op.drop_table("tc_venues")
