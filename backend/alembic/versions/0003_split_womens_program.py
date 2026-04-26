"""split legacy womens program into scratch/handicap variants

Revision ID: 0003_split_womens_program
Revises: 0002_rm_reverse_program
Create Date: 2026-04-26
"""

from alembic import op

revision = "0003_split_womens_program"
down_revision = "0002_rm_reverse_program"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Rename any legacy women's scratch program stored in tournament settings.
    op.execute(
        """
        UPDATE tournament_bracket_settings
        SET bracket_programs = (
            SELECT jsonb_agg(
                CASE
                    WHEN elem->>'key' = 'womens' THEN
                        jsonb_set(
                            jsonb_set(
                                jsonb_set(elem, '{key}', '"womens_scratch"'::jsonb),
                                '{name}', '"Women''s Scratch"'::jsonb
                            ),
                            '{scoring_mode}', '"scratch"'::jsonb
                        )
                    ELSE elem
                END
                ORDER BY COALESCE((elem->>'display_order')::int, 0)
            )
            FROM jsonb_array_elements(bracket_programs::jsonb) AS elem
        )
        WHERE bracket_programs IS NOT NULL
          AND bracket_programs::jsonb @> '[{"key": "womens"}]'::jsonb
        """
    )

    # Rename legacy women's player entry counts to womens_scratch.
    op.execute(
        """
        UPDATE tournament_players
        SET program_entry_counts = (
            (program_entry_counts::jsonb - 'womens') ||
            jsonb_build_object('womens_scratch', COALESCE(program_entry_counts::jsonb->'womens', '0'::jsonb))
        )
        WHERE program_entry_counts IS NOT NULL
          AND program_entry_counts::jsonb ? 'womens'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE tournament_bracket_settings
        SET bracket_programs = (
            SELECT jsonb_agg(
                CASE
                    WHEN elem->>'key' = 'womens_scratch' THEN
                        jsonb_set(
                            jsonb_set(elem, '{key}', '"womens"'::jsonb),
                            '{name}', '"Womens"'::jsonb
                        )
                    ELSE elem
                END
                ORDER BY COALESCE((elem->>'display_order')::int, 0)
            )
            FROM jsonb_array_elements(bracket_programs::jsonb) AS elem
        )
        WHERE bracket_programs IS NOT NULL
          AND bracket_programs::jsonb @> '[{"key": "womens_scratch"}]'::jsonb
        """
    )

    op.execute(
        """
        UPDATE tournament_players
        SET program_entry_counts = (
            (program_entry_counts::jsonb - 'womens_scratch') ||
            jsonb_build_object('womens', COALESCE(program_entry_counts::jsonb->'womens_scratch', '0'::jsonb))
        )
        WHERE program_entry_counts IS NOT NULL
          AND program_entry_counts::jsonb ? 'womens_scratch'
        """
    )
