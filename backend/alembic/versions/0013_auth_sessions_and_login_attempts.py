"""add auth sessions and login attempts

Revision ID: 0013_auth_sessions
Revises: 0012_admin_audit_log
Create Date: 2026-05-13
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0013_auth_sessions"
down_revision = "0012_admin_audit_log"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("session_id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("token_family", sa.String(length=64), nullable=False),
        sa.Column("refresh_token_hash", sa.String(length=128), nullable=False),
        sa.Column("source_ip_hash", sa.String(length=128), nullable=True),
        sa.Column("user_agent_fingerprint", sa.String(length=128), nullable=True),
        sa.Column("issued_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("last_seen_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("is_revoked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("replaced_by_session_id", sa.String(length=64), nullable=True),
    )
    op.create_index("ix_auth_sessions_session_id", "auth_sessions", ["session_id"], unique=True)
    op.create_index("ix_auth_sessions_user_id", "auth_sessions", ["user_id"], unique=False)
    op.create_index("ix_auth_sessions_token_family", "auth_sessions", ["token_family"], unique=False)
    op.create_index("ix_auth_sessions_refresh_token_hash", "auth_sessions", ["refresh_token_hash"], unique=True)
    op.create_index("ix_auth_sessions_source_ip_hash", "auth_sessions", ["source_ip_hash"], unique=False)
    op.create_index("ix_auth_sessions_issued_at", "auth_sessions", ["issued_at"], unique=False)
    op.create_index("ix_auth_sessions_expires_at", "auth_sessions", ["expires_at"], unique=False)
    op.create_index("ix_auth_sessions_is_revoked", "auth_sessions", ["is_revoked"], unique=False)

    op.create_table(
        "login_attempts",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("username", sa.String(length=255), nullable=False),
        sa.Column("source_ip_hash", sa.String(length=128), nullable=False),
        sa.Column("window_start", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("failed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("blocked_until", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("username", "source_ip_hash", name="uq_login_attempt_username_ip"),
    )
    op.create_index("ix_login_attempts_username", "login_attempts", ["username"], unique=False)
    op.create_index("ix_login_attempts_source_ip_hash", "login_attempts", ["source_ip_hash"], unique=False)
    op.create_index("ix_login_attempts_blocked_until", "login_attempts", ["blocked_until"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_login_attempts_blocked_until", table_name="login_attempts")
    op.drop_index("ix_login_attempts_source_ip_hash", table_name="login_attempts")
    op.drop_index("ix_login_attempts_username", table_name="login_attempts")
    op.drop_table("login_attempts")

    op.drop_index("ix_auth_sessions_is_revoked", table_name="auth_sessions")
    op.drop_index("ix_auth_sessions_expires_at", table_name="auth_sessions")
    op.drop_index("ix_auth_sessions_issued_at", table_name="auth_sessions")
    op.drop_index("ix_auth_sessions_source_ip_hash", table_name="auth_sessions")
    op.drop_index("ix_auth_sessions_refresh_token_hash", table_name="auth_sessions")
    op.drop_index("ix_auth_sessions_token_family", table_name="auth_sessions")
    op.drop_index("ix_auth_sessions_user_id", table_name="auth_sessions")
    op.drop_index("ix_auth_sessions_session_id", table_name="auth_sessions")
    op.drop_table("auth_sessions")
