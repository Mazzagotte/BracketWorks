"""add tc tournament documents table

Revision ID: 0033_tc_tournament_documents
Revises: 0032_tc_venues
Create Date: 2026-08-20
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0033_tc_tournament_documents"
down_revision = "0032_tc_venues"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tc_tournament_documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tournament_id", sa.Integer(), sa.ForeignKey("tc_tournaments.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("doc_type", sa.String(length=40), nullable=False, server_default="other"),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=120), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("file_blob", sa.LargeBinary(), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_tc_tournament_documents_tournament_id",
        "tc_tournament_documents",
        ["tournament_id"],
    )
    op.create_index(
        "ix_tc_tournament_documents_user_id",
        "tc_tournament_documents",
        ["user_id"],
    )
    op.create_index(
        "ix_tc_tournament_documents_uploaded_at",
        "tc_tournament_documents",
        ["uploaded_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_tc_tournament_documents_uploaded_at", table_name="tc_tournament_documents")
    op.drop_index("ix_tc_tournament_documents_user_id", table_name="tc_tournament_documents")
    op.drop_index("ix_tc_tournament_documents_tournament_id", table_name="tc_tournament_documents")
    op.drop_table("tc_tournament_documents")
