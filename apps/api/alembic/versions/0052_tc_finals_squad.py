"""per-squad Tournament Central finals: add a squad key to tc_finals

Revision ID: 0052_tc_finals_squad
Revises: 0051_tc_scores_and_finals
Create Date: 2026-11-07

Events can run finals for each squad (sweepers crown a winner per squad). ``squad_key`` is "" for
tournament-wide finals and the squad group key otherwise, so the unique constraint stays a plain
column constraint (no NULL handling or expression index) on PostgreSQL and SQLite alike.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0052_tc_finals_squad"
down_revision = "0051_tc_scores_and_finals"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("tc_finals") as batch_op:
        batch_op.add_column(sa.Column("squad_config_id", sa.String(120), nullable=True))
        batch_op.add_column(sa.Column("squad_key", sa.String(120), nullable=False, server_default=""))
        batch_op.drop_constraint("uq_tc_finals_event_division", type_="unique")
        batch_op.create_unique_constraint(
            "uq_tc_finals_event_division_squad",
            ["tournament_id", "event_config_id", "division_key", "squad_key"],
        )


def downgrade() -> None:
    # Per-squad finals can't fit the old one-per-division constraint, so they're removed first.
    tc_finals = sa.table("tc_finals", sa.column("id", sa.Integer()), sa.column("squad_key", sa.String()))
    tc_finals_games = sa.table("tc_finals_games", sa.column("finals_id", sa.Integer()))
    squad_finals = sa.select(tc_finals.c.id).where(tc_finals.c.squad_key != "")
    op.execute(tc_finals_games.delete().where(tc_finals_games.c.finals_id.in_(squad_finals)))
    op.execute(tc_finals.delete().where(tc_finals.c.squad_key != ""))
    with op.batch_alter_table("tc_finals") as batch_op:
        batch_op.drop_constraint("uq_tc_finals_event_division_squad", type_="unique")
        batch_op.create_unique_constraint(
            "uq_tc_finals_event_division",
            ["tournament_id", "event_config_id", "division_key"],
        )
        batch_op.drop_column("squad_key")
        batch_op.drop_column("squad_config_id")
