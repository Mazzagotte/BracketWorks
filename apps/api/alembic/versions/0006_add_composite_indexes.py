"""add composite indexes for hot query paths

Revision ID: 0006_add_composite_indexes
Revises: 0005_remove_email_verification
Create Date: 2026-05-04
"""

from alembic import op

revision = "0006_add_composite_indexes"
down_revision = "0005_remove_email_verification"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # player_scores(tournament_id, squad_id) — filtered together on every bracket load/hydration
    op.create_index(
        "ix_player_scores_tournament_squad",
        "player_scores",
        ["tournament_id", "squad_id"],
    )
    # tournament_players(tournament_id, squad_id) — filtered together on every bracket generation
    op.create_index(
        "ix_tournament_players_tournament_squad",
        "tournament_players",
        ["tournament_id", "squad_id"],
    )
    # bracket_snapshots(tournament_id, squad_id, is_current) — every bracket load
    op.create_index(
        "ix_bracket_snapshots_tournament_squad_active",
        "bracket_snapshots",
        ["tournament_id", "squad_id", "is_current"],
    )


def downgrade() -> None:
    op.drop_index("ix_bracket_snapshots_tournament_squad_active", table_name="bracket_snapshots")
    op.drop_index("ix_tournament_players_tournament_squad", table_name="tournament_players")
    op.drop_index("ix_player_scores_tournament_squad", table_name="player_scores")
