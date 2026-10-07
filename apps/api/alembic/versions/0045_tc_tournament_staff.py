"""add Tournament Central team membership and invitations

Revision ID: 0045_tc_tournament_staff
Revises: 0044_unique_tc_published_names
Create Date: 2026-10-08
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0045_tc_tournament_staff"
down_revision = "0044_unique_tc_published_names"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tc_tournament_staff_members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tournament_id", sa.Integer(), sa.ForeignKey("tc_tournaments.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("role", sa.String(32), nullable=False),
        sa.Column("invited_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("tournament_id", "user_id", name="uq_tc_tournament_staff_user"),
    )
    for column in ("tournament_id", "user_id", "role", "created_at"):
        op.create_index(
            f"ix_tc_tournament_staff_members_{column}",
            "tc_tournament_staff_members",
            [column],
        )

    op.create_table(
        "tc_tournament_staff_invitations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tournament_id", sa.Integer(), sa.ForeignKey("tc_tournaments.id"), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("role", sa.String(32), nullable=False),
        sa.Column("invited_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("responded_at", sa.DateTime(), nullable=True),
    )
    for column in ("tournament_id", "email", "role", "status", "created_at", "expires_at"):
        op.create_index(
            f"ix_tc_tournament_staff_invitations_{column}",
            "tc_tournament_staff_invitations",
            [column],
        )


def downgrade() -> None:
    op.drop_table("tc_tournament_staff_invitations")
    op.drop_table("tc_tournament_staff_members")
