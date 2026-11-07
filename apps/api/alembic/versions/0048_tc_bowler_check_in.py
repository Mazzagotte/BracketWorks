"""add tournament-day check-in to Tournament Central bowlers

Revision ID: 0048_tc_bowler_check_in
Revises: 0045_tc_tournament_staff
Create Date: 2026-11-07
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0048_tc_bowler_check_in"
down_revision = "0045_tc_tournament_staff"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("tc_registration_bowlers") as batch_op:
        batch_op.add_column(sa.Column("checked_in_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("checked_in_by_user_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_tc_registration_bowlers_checked_in_by_user_id_users",
            "users",
            ["checked_in_by_user_id"],
            ["id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("tc_registration_bowlers") as batch_op:
        batch_op.drop_constraint(
            "fk_tc_registration_bowlers_checked_in_by_user_id_users",
            type_="foreignkey",
        )
        batch_op.drop_column("checked_in_by_user_id")
        batch_op.drop_column("checked_in_at")
