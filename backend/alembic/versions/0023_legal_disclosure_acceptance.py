"""add recurring legal disclosure acceptance history

Revision ID: 0023_legal_disclosure
Revises: 0022_admin_oversight
Create Date: 2026-08-02
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0023_legal_disclosure"
down_revision = "0022_admin_oversight"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "legal_disclosure_acceptances",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("disclosure_version", sa.String(40), nullable=False),
        sa.Column("disclosure_hash", sa.String(64), nullable=False),
        sa.Column("accepted_at", sa.DateTime(), nullable=False),
        sa.Column("next_required_at", sa.DateTime(), nullable=False),
        sa.Column("acceptance_source", sa.String(40), nullable=False, server_default="required_modal"),
    )
    for column in ("user_id", "disclosure_version", "accepted_at", "next_required_at"):
        op.create_index(
            f"ix_legal_disclosure_acceptances_{column}",
            "legal_disclosure_acceptances",
            [column],
        )


def downgrade() -> None:
    for column in reversed(("user_id", "disclosure_version", "accepted_at", "next_required_at")):
        op.drop_index(
            f"ix_legal_disclosure_acceptances_{column}",
            table_name="legal_disclosure_acceptances",
        )
    op.drop_table("legal_disclosure_acceptances")
