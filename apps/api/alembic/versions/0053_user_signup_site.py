"""record which site each account was created on

Revision ID: 0053_user_signup_site
Revises: 0052_tc_finals_squad
Create Date: 2026-11-13

BracketWorks and Tournament Central share one account system. ``signup_site`` says which of the
two a person signed up on, so their account emails can be branded for it. Existing accounts stay
NULL, which the email code treats as BracketWorks.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0053_user_signup_site"
down_revision = "0052_tc_finals_squad"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("signup_site", sa.String(40), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("signup_site")
