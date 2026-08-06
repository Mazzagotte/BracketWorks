"""drop redundant single-column indexes and add composite for matchup history

Revision ID: 0007_optimize_indexes
Revises: 0006_add_composite_indexes
Create Date: 2026-05-04
"""

from alembic import op

revision = "0007_optimize_indexes"
down_revision = "0006_add_composite_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- bracket_snapshots ---
    # The composite (tournament_id, squad_id, is_current) added in 0006 makes
    # these three single-column indexes redundant. The composite's leading column
    # (tournament_id) already serves any tournament_id-only lookup.
    op.drop_index("ix_bracket_snapshots_tournament_id", table_name="bracket_snapshots")
    op.drop_index("ix_bracket_snapshots_squad_id",      table_name="bracket_snapshots")
    op.drop_index("ix_bracket_snapshots_is_current",    table_name="bracket_snapshots")

    # --- first_round_matchup_history ---
    # The query filters: bracket_group_key = ? AND round_number = 1
    #                AND (tournament_id = ? OR tournament_id != ?)
    # A composite on (tournament_id, bracket_group_key) covers this.
    # The existing single-column bracket_group_key index is superseded by the composite.
    op.create_index(
        "ix_matchup_history_tournament_bracket_type",
        "first_round_matchup_history",
        ["tournament_id", "bracket_group_key"],
    )
    op.drop_index(
        "ix_first_round_matchup_history_bracket_group_key",
        table_name="first_round_matchup_history",
    )


def downgrade() -> None:
    op.create_index(
        "ix_first_round_matchup_history_bracket_group_key",
        "first_round_matchup_history",
        ["bracket_group_key"],
    )
    op.drop_index(
        "ix_matchup_history_tournament_bracket_type",
        table_name="first_round_matchup_history",
    )
    op.create_index("ix_bracket_snapshots_is_current",   "bracket_snapshots", ["is_current"])
    op.create_index("ix_bracket_snapshots_squad_id",     "bracket_snapshots", ["squad_id"])
    op.create_index("ix_bracket_snapshots_tournament_id","bracket_snapshots", ["tournament_id"])
