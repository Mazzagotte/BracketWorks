"""remove email verification fields from users

Revision ID: 0005_remove_email_verification
Revises: 0004_split_senior_junior
Create Date: 2026-04-26
"""

from alembic import op
import sqlalchemy as sa

revision = "0005_remove_email_verification"
down_revision = "0004_split_senior_junior"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use IF EXISTS in case columns were already removed manually
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS email_verified_at")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS email_verified")


def downgrade() -> None:
    op.add_column("users", sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("email_verified_at", sa.DateTime(), nullable=True))
