"""split legacy seniors and juniors programs into scratch/handicap variants

Revision ID: 0004_split_senior_junior
Revises: 0003_split_womens_program
Create Date: 2026-04-26
"""

from alembic import op

revision = "0004_split_senior_junior"
down_revision = "0003_split_womens_program"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Rename legacy seniors/juniors scratch programs stored in tournament settings.
    op.execute(
        """
        UPDATE tournament_bracket_settings
        SET bracket_programs = (
            SELECT jsonb_agg(
                CASE
                    WHEN elem->>'key' = 'seniors' THEN
                        jsonb_set(
                            jsonb_set(
                                jsonb_set(elem, '{key}', '"seniors_scratch"'::jsonb),
                                '{name}', '"Seniors Scratch"'::jsonb
                            ),
                            '{scoring_mode}', '"scratch"'::jsonb
                        )
                    WHEN elem->>'key' = 'juniors' THEN
                        jsonb_set(
                            jsonb_set(
                                jsonb_set(elem, '{key}', '"juniors_scratch"'::jsonb),
                                '{name}', '"Juniors Scratch"'::jsonb
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
          AND (
            bracket_programs::jsonb @> '[{"key": "seniors"}]'::jsonb
            OR bracket_programs::jsonb @> '[{"key": "juniors"}]'::jsonb
          )
        """
    )

    # Rename legacy program entry counts to *_scratch keys.
    op.execute(
        """
        UPDATE tournament_players
        SET program_entry_counts = (
            (program_entry_counts::jsonb - 'seniors') ||
            jsonb_build_object('seniors_scratch', COALESCE(program_entry_counts::jsonb->'seniors', '0'::jsonb))
        )
        WHERE program_entry_counts IS NOT NULL
          AND program_entry_counts::jsonb ? 'seniors'
        """
    )

    op.execute(
        """
        UPDATE tournament_players
        SET program_entry_counts = (
            (program_entry_counts::jsonb - 'juniors') ||
            jsonb_build_object('juniors_scratch', COALESCE(program_entry_counts::jsonb->'juniors', '0'::jsonb))
        )
        WHERE program_entry_counts IS NOT NULL
          AND program_entry_counts::jsonb ? 'juniors'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE tournament_bracket_settings
        SET bracket_programs = (
            SELECT jsonb_agg(
                CASE
                    WHEN elem->>'key' = 'seniors_scratch' THEN
                        jsonb_set(
                            jsonb_set(elem, '{key}', '"seniors"'::jsonb),
                            '{name}', '"Seniors"'::jsonb
                        )
                    WHEN elem->>'key' = 'juniors_scratch' THEN
                        jsonb_set(
                            jsonb_set(elem, '{key}', '"juniors"'::jsonb),
                            '{name}', '"Juniors"'::jsonb
                        )
                    ELSE elem
                END
                ORDER BY COALESCE((elem->>'display_order')::int, 0)
            )
            FROM jsonb_array_elements(bracket_programs::jsonb) AS elem
        )
        WHERE bracket_programs IS NOT NULL
          AND (
            bracket_programs::jsonb @> '[{"key": "seniors_scratch"}]'::jsonb
            OR bracket_programs::jsonb @> '[{"key": "juniors_scratch"}]'::jsonb
          )
        """
    )

    op.execute(
        """
        UPDATE tournament_players
        SET program_entry_counts = (
            (program_entry_counts::jsonb - 'seniors_scratch') ||
            jsonb_build_object('seniors', COALESCE(program_entry_counts::jsonb->'seniors_scratch', '0'::jsonb))
        )
        WHERE program_entry_counts IS NOT NULL
          AND program_entry_counts::jsonb ? 'seniors_scratch'
        """
    )

    op.execute(
        """
        UPDATE tournament_players
        SET program_entry_counts = (
            (program_entry_counts::jsonb - 'juniors_scratch') ||
            jsonb_build_object('juniors', COALESCE(program_entry_counts::jsonb->'juniors_scratch', '0'::jsonb))
        )
        WHERE program_entry_counts IS NOT NULL
          AND program_entry_counts::jsonb ? 'juniors_scratch'
        """
    )