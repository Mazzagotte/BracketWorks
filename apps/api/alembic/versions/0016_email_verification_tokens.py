"""add email verification tokens

Revision ID: 0016_email_verification_tokens
Revises: 0015_password_reset_tokens
Create Date: 2026-05-15
"""

from alembic import op
import sqlalchemy as sa


revision = "0016_email_verification_tokens"
down_revision = "0015_password_reset_tokens"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email_verified_at", sa.DateTime(), nullable=True))
    op.create_index("ix_users_email_verified_at", "users", ["email_verified_at"], unique=False)

    op.create_table(
        "email_verification_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_email_verification_tokens_id", "email_verification_tokens", ["id"], unique=False)
    op.create_index("ix_email_verification_tokens_user_id", "email_verification_tokens", ["user_id"], unique=False)
    op.create_index("ix_email_verification_tokens_email", "email_verification_tokens", ["email"], unique=False)
    op.create_index("ix_email_verification_tokens_token_hash", "email_verification_tokens", ["token_hash"], unique=True)
    op.create_index("ix_email_verification_tokens_created_at", "email_verification_tokens", ["created_at"], unique=False)
    op.create_index("ix_email_verification_tokens_expires_at", "email_verification_tokens", ["expires_at"], unique=False)
    op.create_index("ix_email_verification_tokens_used_at", "email_verification_tokens", ["used_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_email_verification_tokens_used_at", table_name="email_verification_tokens")
    op.drop_index("ix_email_verification_tokens_expires_at", table_name="email_verification_tokens")
    op.drop_index("ix_email_verification_tokens_created_at", table_name="email_verification_tokens")
    op.drop_index("ix_email_verification_tokens_token_hash", table_name="email_verification_tokens")
    op.drop_index("ix_email_verification_tokens_email", table_name="email_verification_tokens")
    op.drop_index("ix_email_verification_tokens_user_id", table_name="email_verification_tokens")
    op.drop_index("ix_email_verification_tokens_id", table_name="email_verification_tokens")
    op.drop_table("email_verification_tokens")

    op.drop_index("ix_users_email_verified_at", table_name="users")
    op.drop_column("users", "email_verified_at")