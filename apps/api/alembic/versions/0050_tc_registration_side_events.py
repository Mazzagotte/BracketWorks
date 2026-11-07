"""store side events bought at registration, and each bowler's gender

Revision ID: 0050_tc_registration_side_events
Revises: 0049_tc_bracketworks_link
Create Date: 2026-11-07
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0050_tc_registration_side_events"
down_revision = "0049_tc_bracketworks_link"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tc_registration_side_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("registration_id", sa.Integer(), sa.ForeignKey("tc_registrations.id"), nullable=False),
        sa.Column("tournament_id", sa.Integer(), sa.ForeignKey("tc_tournaments.id"), nullable=False),
        sa.Column("bowler_id", sa.Integer(), sa.ForeignKey("tc_registration_bowlers.id"), nullable=True),
        sa.Column("fee_config_id", sa.String(120), nullable=False),
        sa.Column("name_snapshot", sa.String(255), nullable=False),
        sa.Column("kind", sa.String(32), nullable=False, server_default="fee"),
        sa.Column("scoring", sa.String(16), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("unit_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_tc_registration_side_events_id", "tc_registration_side_events", ["id"])
    op.create_index(
        "ix_tc_registration_side_events_registration_id", "tc_registration_side_events", ["registration_id"]
    )
    op.create_index(
        "ix_tc_registration_side_events_tournament_id", "tc_registration_side_events", ["tournament_id"]
    )
    op.create_index("ix_tc_registration_side_events_bowler_id", "tc_registration_side_events", ["bowler_id"])

    with op.batch_alter_table("tc_registration_bowlers") as batch_op:
        batch_op.add_column(sa.Column("gender", sa.String(16), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("tc_registration_bowlers") as batch_op:
        batch_op.drop_column("gender")

    op.drop_index("ix_tc_registration_side_events_bowler_id", table_name="tc_registration_side_events")
    op.drop_index("ix_tc_registration_side_events_tournament_id", table_name="tc_registration_side_events")
    op.drop_index("ix_tc_registration_side_events_registration_id", table_name="tc_registration_side_events")
    op.drop_index("ix_tc_registration_side_events_id", table_name="tc_registration_side_events")
    op.drop_table("tc_registration_side_events")
