"""remove legacy reverse bracket program from tournament JSON

Revision ID: 0002_remove_reverse_bracket_program
Revises: 0001_clean_schema_baseline
Create Date: 2026-04-26
"""

from alembic import op

revision = "0002_rm_reverse_program"
down_revision = "0001_clean_schema_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remove any bracket_programs entry with key == 'reverse' from all tournaments.
    # Uses a PostgreSQL jsonb expression to filter out the legacy entry.
    op.execute(
        """
        UPDATE tournament_bracket_settings
        SET bracket_programs = (
            SELECT jsonb_agg(elem ORDER BY (elem->>'display_order')::int)
            FROM jsonb_array_elements(bracket_programs::jsonb) AS elem
            WHERE elem->>'key' != 'reverse'
        )
        WHERE bracket_programs IS NOT NULL
          AND bracket_programs::jsonb @> '[{"key": "reverse"}]'::jsonb
        """
    )


def downgrade() -> None:
    # No-op: we intentionally don't restore the legacy 'reverse' program.
    pass
