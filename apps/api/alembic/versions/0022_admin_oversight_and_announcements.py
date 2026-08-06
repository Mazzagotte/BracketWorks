"""add tournament notes, announcements, and acknowledgments

Revision ID: 0022_admin_oversight
Revises: 0021_admin_user_reviews
Create Date: 2026-08-02
"""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op

revision = "0022_admin_oversight"
down_revision = "0021_admin_user_reviews"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("admin_tournament_notes",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("tournament_id", sa.Integer(), sa.ForeignKey("tournaments.id"), nullable=False),
        sa.Column("admin_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False), sa.Column("category", sa.String(40), nullable=False),
        sa.Column("note", sa.Text(), nullable=False), sa.Column("is_resolved", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("resolved_at", sa.DateTime(), nullable=True), sa.Column("resolved_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False), sa.Column("updated_at", sa.DateTime(), nullable=False))
    for column in ("tournament_id", "admin_user_id", "category", "is_resolved", "created_at"):
        op.create_index(f"ix_admin_tournament_notes_{column}", "admin_tournament_notes", [column])
    op.create_table("admin_announcements",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("title", sa.String(160), nullable=False), sa.Column("message", sa.Text(), nullable=False),
        sa.Column("audience_type", sa.String(30), nullable=False), sa.Column("audience_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("status", sa.String(20), nullable=False), sa.Column("requires_acknowledgment", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("starts_at", sa.DateTime(), nullable=True), sa.Column("ends_at", sa.DateTime(), nullable=True), sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False), sa.Column("updated_at", sa.DateTime(), nullable=False))
    for column in ("audience_type", "audience_user_id", "status", "starts_at", "ends_at", "created_at"):
        op.create_index(f"ix_admin_announcements_{column}", "admin_announcements", [column])
    op.create_table("user_acknowledgments",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("content_type", sa.String(40), nullable=False), sa.Column("content_id", sa.String(80), nullable=False), sa.Column("version", sa.String(40), nullable=False),
        sa.Column("acknowledged_at", sa.DateTime(), nullable=False), sa.UniqueConstraint("user_id", "content_type", "content_id", "version", name="uq_user_ack_content_version"))
    for column in ("user_id", "content_type", "content_id", "acknowledged_at"):
        op.create_index(f"ix_user_acknowledgments_{column}", "user_acknowledgments", [column])


def downgrade() -> None:
    for table, columns in (("user_acknowledgments", ("user_id", "content_type", "content_id", "acknowledged_at")), ("admin_announcements", ("audience_type", "audience_user_id", "status", "starts_at", "ends_at", "created_at")), ("admin_tournament_notes", ("tournament_id", "admin_user_id", "category", "is_resolved", "created_at"))):
        for column in reversed(columns): op.drop_index(f"ix_{table}_{column}", table_name=table)
        op.drop_table(table)
