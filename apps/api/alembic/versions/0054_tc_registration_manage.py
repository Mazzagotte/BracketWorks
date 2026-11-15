"""bowler "Manage registration" links and registration change history

Revision ID: 0054_tc_registration_manage
Revises: 0053_user_signup_site
Create Date: 2026-11-15

Bowlers can change their own registration from a link in their confirmation email. Each link is
signed with a per-person ``manage_key``; replacing the key (for example when a bowler is swapped
out) cancels that person's old link. ``tc_registration_changes`` keeps every saved change for the
organizer's history list.
"""

from __future__ import annotations

import secrets

import sqlalchemy as sa
from alembic import op

revision = "0054_tc_registration_manage"
down_revision = "0053_user_signup_site"
branch_labels = None
depends_on = None


def _fill_keys(table: str) -> None:
    bind = op.get_bind()
    ids = [row[0] for row in bind.execute(sa.text(f"SELECT id FROM {table} WHERE manage_key IS NULL"))]
    for row_id in ids:
        bind.execute(
            sa.text(f"UPDATE {table} SET manage_key = :key WHERE id = :id"),
            {"key": secrets.token_hex(16), "id": row_id},
        )


def upgrade() -> None:
    with op.batch_alter_table("tc_registrations") as batch_op:
        batch_op.add_column(sa.Column("manage_key", sa.String(64), nullable=True))
    with op.batch_alter_table("tc_registration_bowlers") as batch_op:
        batch_op.add_column(sa.Column("manage_key", sa.String(64), nullable=True))
    _fill_keys("tc_registrations")
    _fill_keys("tc_registration_bowlers")

    op.create_table(
        "tc_registration_changes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "registration_id",
            sa.Integer(),
            sa.ForeignKey("tc_registrations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tournament_id", sa.Integer(), sa.ForeignKey("tc_tournaments.id"), nullable=False),
        sa.Column("changed_by", sa.String(24), nullable=False),
        sa.Column("actor_name", sa.String(255), nullable=True),
        sa.Column("changes_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_tc_registration_changes_id", "tc_registration_changes", ["id"])
    op.create_index("ix_tc_registration_changes_registration_id", "tc_registration_changes", ["registration_id"])
    op.create_index("ix_tc_registration_changes_tournament_id", "tc_registration_changes", ["tournament_id"])
    op.create_index("ix_tc_registration_changes_created_at", "tc_registration_changes", ["created_at"])


def downgrade() -> None:
    op.drop_table("tc_registration_changes")
    with op.batch_alter_table("tc_registration_bowlers") as batch_op:
        batch_op.drop_column("manage_key")
    with op.batch_alter_table("tc_registrations") as batch_op:
        batch_op.drop_column("manage_key")
