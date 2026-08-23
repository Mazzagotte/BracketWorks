"""add payout attribution and adjustment history

Revision ID: 0039_payout_adjustments
Revises: 0038_score_corrections
Create Date: 2026-08-22
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0039_payout_adjustments"
down_revision = "0038_score_corrections"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tournament_payout_summaries", sa.Column("calculated_at", sa.DateTime(), nullable=True))
    op.add_column("tournament_payout_summaries", sa.Column("calculated_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))
    op.add_column("tournament_payout_summaries", sa.Column("finalized_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))
    op.create_index("ix_tournament_payout_summaries_calculated_by_user_id", "tournament_payout_summaries", ["calculated_by_user_id"])
    op.create_index("ix_tournament_payout_summaries_finalized_by_user_id", "tournament_payout_summaries", ["finalized_by_user_id"])
    op.create_table(
        "payout_adjustments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tournament_id", sa.Integer(), sa.ForeignKey("tournaments.id"), nullable=False),
        sa.Column("payout_id", sa.Integer(), sa.ForeignKey("bracket_payouts.id"), nullable=True),
        sa.Column("adjustment_type", sa.String(30), nullable=False),
        sa.Column("old_amount", sa.Float(), nullable=True),
        sa.Column("new_amount", sa.Float(), nullable=True),
        sa.Column("reason", sa.String(1000), nullable=False),
        sa.Column("adjusted_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    for column in ("tournament_id", "payout_id", "adjusted_by_user_id", "created_at"):
        op.create_index(f"ix_payout_adjustments_{column}", "payout_adjustments", [column])


def downgrade() -> None:
    op.drop_table("payout_adjustments")
    op.drop_index("ix_tournament_payout_summaries_finalized_by_user_id", table_name="tournament_payout_summaries")
    op.drop_index("ix_tournament_payout_summaries_calculated_by_user_id", table_name="tournament_payout_summaries")
    op.drop_column("tournament_payout_summaries", "finalized_by_user_id")
    op.drop_column("tournament_payout_summaries", "calculated_by_user_id")
    op.drop_column("tournament_payout_summaries", "calculated_at")
