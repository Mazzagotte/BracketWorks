"""add idempotency keys and session intelligence fields

Revision ID: 0014_idempotency_keys
Revises: 0013_auth_sessions_login_attempts
Create Date: 2026-05-13
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0014_idempotency_keys"
down_revision = "0013_auth_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("auth_sessions", sa.Column("device_nickname", sa.String(length=120), nullable=True))
    op.add_column("auth_sessions", sa.Column("region_hint", sa.String(length=80), nullable=True))
    op.add_column("auth_sessions", sa.Column("risk_score", sa.Float(), nullable=False, server_default="0"))
    op.create_index("ix_auth_sessions_region_hint", "auth_sessions", ["region_hint"], unique=False)

    op.create_table(
        "idempotency_keys",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("idempotency_key", sa.String(length=255), nullable=False),
        sa.Column("endpoint_scope", sa.String(length=255), nullable=False),
        sa.Column("request_fingerprint", sa.String(length=128), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("response_body", sa.JSON(), nullable=True),
        sa.Column("state", sa.String(length=24), nullable=False, server_default="processing"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("idempotency_key", "endpoint_scope", name="uq_idempotency_key_scope"),
    )
    op.create_index("ix_idempotency_keys_idempotency_key", "idempotency_keys", ["idempotency_key"], unique=False)
    op.create_index("ix_idempotency_keys_endpoint_scope", "idempotency_keys", ["endpoint_scope"], unique=False)
    op.create_index("ix_idempotency_keys_user_id", "idempotency_keys", ["user_id"], unique=False)
    op.create_index("ix_idempotency_keys_state", "idempotency_keys", ["state"], unique=False)
    op.create_index("ix_idempotency_keys_created_at", "idempotency_keys", ["created_at"], unique=False)
    op.create_index("ix_idempotency_keys_expires_at", "idempotency_keys", ["expires_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_idempotency_keys_expires_at", table_name="idempotency_keys")
    op.drop_index("ix_idempotency_keys_created_at", table_name="idempotency_keys")
    op.drop_index("ix_idempotency_keys_state", table_name="idempotency_keys")
    op.drop_index("ix_idempotency_keys_user_id", table_name="idempotency_keys")
    op.drop_index("ix_idempotency_keys_endpoint_scope", table_name="idempotency_keys")
    op.drop_index("ix_idempotency_keys_idempotency_key", table_name="idempotency_keys")
    op.drop_table("idempotency_keys")

    op.drop_index("ix_auth_sessions_region_hint", table_name="auth_sessions")
    op.drop_column("auth_sessions", "risk_score")
    op.drop_column("auth_sessions", "region_hint")
    op.drop_column("auth_sessions", "device_nickname")
