"""store Tournament Central qualifying scores and finals

Revision ID: 0051_tc_scores_and_finals
Revises: 0050_tc_registration_side_events
Create Date: 2026-11-07
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0051_tc_scores_and_finals"
down_revision = "0050_tc_registration_side_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tc_scores",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tournament_id", sa.Integer(), sa.ForeignKey("tc_tournaments.id"), nullable=False),
        sa.Column("entry_id", sa.Integer(), sa.ForeignKey("tc_entries.id"), nullable=False),
        sa.Column("bowler_id", sa.Integer(), sa.ForeignKey("tc_registration_bowlers.id"), nullable=False),
        sa.Column("game_number", sa.Integer(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.Column("entered_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("entry_id", "bowler_id", "game_number", name="uq_tc_scores_entry_bowler_game"),
    )
    op.create_index("ix_tc_scores_id", "tc_scores", ["id"])
    op.create_index("ix_tc_scores_tournament_id", "tc_scores", ["tournament_id"])
    op.create_index("ix_tc_scores_entry_id", "tc_scores", ["entry_id"])
    op.create_index("ix_tc_scores_bowler_id", "tc_scores", ["bowler_id"])

    op.create_table(
        "tc_finals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tournament_id", sa.Integer(), sa.ForeignKey("tc_tournaments.id"), nullable=False),
        sa.Column("event_config_id", sa.String(120), nullable=False),
        sa.Column("division_config_id", sa.String(120), nullable=True),
        sa.Column("division_key", sa.String(120), nullable=False, server_default=""),
        sa.Column("finals_type", sa.String(32), nullable=False),
        sa.Column("seeds", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="in-progress"),
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("tournament_id", "event_config_id", "division_key", name="uq_tc_finals_event_division"),
    )
    op.create_index("ix_tc_finals_id", "tc_finals", ["id"])
    op.create_index("ix_tc_finals_tournament_id", "tc_finals", ["tournament_id"])

    op.create_table(
        "tc_finals_games",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("finals_id", sa.Integer(), sa.ForeignKey("tc_finals.id"), nullable=False),
        sa.Column("round", sa.Integer(), nullable=False),
        sa.Column("match_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("seed", sa.Integer(), nullable=False),
        sa.Column("game_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.Column("entered_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("finals_id", "round", "match_number", "seed", "game_number", name="uq_tc_finals_games_slot"),
    )
    op.create_index("ix_tc_finals_games_id", "tc_finals_games", ["id"])
    op.create_index("ix_tc_finals_games_finals_id", "tc_finals_games", ["finals_id"])


def downgrade() -> None:
    op.drop_index("ix_tc_finals_games_finals_id", table_name="tc_finals_games")
    op.drop_index("ix_tc_finals_games_id", table_name="tc_finals_games")
    op.drop_table("tc_finals_games")
    op.drop_index("ix_tc_finals_tournament_id", table_name="tc_finals")
    op.drop_index("ix_tc_finals_id", table_name="tc_finals")
    op.drop_table("tc_finals")
    op.drop_index("ix_tc_scores_bowler_id", table_name="tc_scores")
    op.drop_index("ix_tc_scores_entry_id", table_name="tc_scores")
    op.drop_index("ix_tc_scores_tournament_id", table_name="tc_scores")
    op.drop_index("ix_tc_scores_id", table_name="tc_scores")
    op.drop_table("tc_scores")
