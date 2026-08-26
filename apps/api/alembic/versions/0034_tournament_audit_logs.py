"""add tournament audit logs

Revision ID: 0034_tournament_audit_logs
Revises: 0033_tc_tournament_documents
Create Date: 2026-08-21
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0034_tournament_audit_logs"
down_revision = "0033_tc_tournament_documents"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tournament_audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tournament_id", sa.Integer(), sa.ForeignKey("tournaments.id"), nullable=False),
        sa.Column("event_type", sa.String(length=80), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("user_display_name", sa.String(length=160), nullable=False),
        sa.Column("summary", sa.String(length=500), nullable=False),
        sa.Column("before_values", sa.JSON(), nullable=True),
        sa.Column("after_values", sa.JSON(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("entity_type", sa.String(length=60), nullable=True),
        sa.Column("entity_id", sa.String(length=80), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    for column in ("tournament_id", "event_type", "user_id", "entity_type", "entity_id", "created_at"):
        op.create_index(f"ix_tournament_audit_logs_{column}", "tournament_audit_logs", [column])


def downgrade() -> None:
    for column in reversed(("tournament_id", "event_type", "user_id", "entity_type", "entity_id", "created_at")):
        op.drop_index(f"ix_tournament_audit_logs_{column}", table_name="tournament_audit_logs")
    op.drop_table("tournament_audit_logs")
