"""harden payout adjustment precision

Revision ID: 0042_hardening_pass
Revises: 0041_structured_changelog
Create Date: 2026-08-23
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0042_hardening_pass"
down_revision = "0041_structured_changelog"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tournament_staff_invitations", sa.Column("token_hash", sa.String(length=64), nullable=True))
    op.create_index("ix_tournament_staff_invitations_token_hash", "tournament_staff_invitations", ["token_hash"], unique=True)
    op.alter_column(
        "payout_adjustments", "old_amount",
        existing_type=sa.Float(), type_=sa.Numeric(precision=12, scale=2),
        existing_nullable=True, postgresql_using="ROUND(old_amount::numeric, 2)",
    )
    op.alter_column(
        "payout_adjustments", "new_amount",
        existing_type=sa.Float(), type_=sa.Numeric(precision=12, scale=2),
        existing_nullable=True, postgresql_using="ROUND(new_amount::numeric, 2)",
    )


def downgrade() -> None:
    op.alter_column("payout_adjustments", "new_amount", existing_type=sa.Numeric(12, 2), type_=sa.Float(), existing_nullable=True)
    op.alter_column("payout_adjustments", "old_amount", existing_type=sa.Numeric(12, 2), type_=sa.Float(), existing_nullable=True)
    op.drop_index("ix_tournament_staff_invitations_token_hash", table_name="tournament_staff_invitations")
    op.drop_column("tournament_staff_invitations", "token_hash")
