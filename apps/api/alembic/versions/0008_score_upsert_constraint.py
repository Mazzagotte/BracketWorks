"""add unique constraint on player_scores and drop redundant single-column indexes

Revision ID: 0008_score_upsert_constraint
Revises: 0007_optimize_indexes
Create Date: 2026-05-04
"""

from alembic import op

revision = "0008_score_upsert_constraint"
down_revision = "0007_optimize_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add unique constraint on (player_id, tournament_id, squad_id).
    # This serves double duty:
    #   1. Enforces data integrity (one score row per player per squad).
    #   2. Enables a single-statement INSERT ... ON CONFLICT DO UPDATE upsert,
    #      eliminating the SELECT-then-INSERT/UPDATE pattern in the scores API.
    # The constraint implicitly creates an index on (player_id, tournament_id, squad_id)
    # which makes the "does this score exist?" check free.
    op.create_unique_constraint(
        "uq_player_scores_player_tournament_squad",
        "player_scores",
        ["player_id", "tournament_id", "squad_id"],
    )

    # Drop the now-redundant single-column indexes on player_scores.
    # The composite (tournament_id, squad_id) from 0006 already covers range scans
    # by tournament/squad. The new unique constraint covers player_id lookups.
    op.drop_index("ix_player_scores_tournament_id", table_name="player_scores")
    op.drop_index("ix_player_scores_squad_id",      table_name="player_scores")


def downgrade() -> None:
    op.create_index("ix_player_scores_squad_id",      "player_scores", ["squad_id"])
    op.create_index("ix_player_scores_tournament_id", "player_scores", ["tournament_id"])
    op.drop_constraint(
        "uq_player_scores_player_tournament_squad",
        "player_scores",
        type_="unique",
    )
