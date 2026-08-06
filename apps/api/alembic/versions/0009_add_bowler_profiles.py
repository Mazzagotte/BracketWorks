"""add bowler profiles and link tournament players

Revision ID: 0009_add_bowler_profiles
Revises: 0008_score_upsert_constraint
Create Date: 2026-05-05
"""

from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from alembic import op

revision = "0009_add_bowler_profiles"
down_revision = "0008_score_upsert_constraint"
branch_labels = None
depends_on = None


def _split_full_name(full_name: str) -> tuple[str, str]:
    value = (full_name or "").strip()
    if not value:
        return "", ""

    if "," in value:
        parts = [segment.strip() for segment in value.split(",") if segment.strip()]
        if len(parts) >= 2:
            return parts[1], parts[0]

    tokens = [token for token in value.split() if token]
    if len(tokens) <= 1:
        return value, ""
    return tokens[0], " ".join(tokens[1:])


def upgrade() -> None:
    op.create_table(
        "bowler_profiles",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("first_name", sa.String(), nullable=False),
        sa.Column("last_name", sa.String(), nullable=False),
        sa.Column("usbc_number", sa.String(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("archived_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )

    op.create_index("ix_bowler_profiles_user_id", "bowler_profiles", ["user_id"], unique=False)
    op.create_index("ix_bowler_profiles_first_name", "bowler_profiles", ["first_name"], unique=False)
    op.create_index("ix_bowler_profiles_last_name", "bowler_profiles", ["last_name"], unique=False)
    op.create_index("ix_bowler_profiles_usbc_number", "bowler_profiles", ["usbc_number"], unique=False)
    op.create_index("ix_bowler_profiles_is_active", "bowler_profiles", ["is_active"], unique=False)
    op.create_index("ix_bowler_profiles_name_lower", "bowler_profiles", [sa.text("lower(last_name)"), sa.text("lower(first_name)")], unique=False)
    op.create_unique_constraint(
        "uq_bowler_profiles_user_usbc",
        "bowler_profiles",
        ["user_id", "usbc_number"],
    )

    op.add_column("tournament_players", sa.Column("bowler_profile_id", sa.Integer(), nullable=True))
    op.create_index("ix_tournament_players_bowler_profile_id", "tournament_players", ["bowler_profile_id"], unique=False)
    op.create_foreign_key(
        "fk_tournament_players_bowler_profile_id",
        "tournament_players",
        "bowler_profiles",
        ["bowler_profile_id"],
        ["id"],
    )

    bind = op.get_bind()
    metadata = sa.MetaData()

    players_table = sa.Table(
        "tournament_players",
        metadata,
        sa.Column("id", sa.Integer),
        sa.Column("user_id", sa.Integer),
        sa.Column("full_name", sa.String),
        sa.Column("usbc_number", sa.String),
        sa.Column("bowler_profile_id", sa.Integer),
    )

    profiles_table = sa.Table(
        "bowler_profiles",
        metadata,
        sa.Column("id", sa.Integer),
        sa.Column("user_id", sa.Integer),
        sa.Column("first_name", sa.String),
        sa.Column("last_name", sa.String),
        sa.Column("usbc_number", sa.String),
        sa.Column("is_active", sa.Boolean),
        sa.Column("archived_at", sa.DateTime),
        sa.Column("created_at", sa.DateTime),
        sa.Column("updated_at", sa.DateTime),
    )

    player_rows = bind.execute(
        sa.select(
            players_table.c.id,
            players_table.c.user_id,
            players_table.c.full_name,
            players_table.c.usbc_number,
        )
    ).fetchall()

    profile_key_to_id: dict[tuple, int] = {}
    now = datetime.utcnow()

    for row in player_rows:
        usbc = (row.usbc_number or "").strip()
        normalized_usbc = usbc or None
        first_name, last_name = _split_full_name(row.full_name or "")
        first_name = first_name.strip() or "Unknown"
        last_name = last_name.strip() or "Bowler"

        if normalized_usbc:
            profile_key = (row.user_id, "usbc", normalized_usbc.lower())
        else:
            profile_key = (row.user_id, "name", first_name.lower(), last_name.lower())

        profile_id = profile_key_to_id.get(profile_key)
        if profile_id is None:
            insert_result = bind.execute(
                profiles_table.insert().values(
                    user_id=row.user_id,
                    first_name=first_name,
                    last_name=last_name,
                    usbc_number=normalized_usbc,
                    is_active=True,
                    archived_at=None,
                    created_at=now,
                    updated_at=now,
                ).returning(profiles_table.c.id)
            )
            profile_id = int(insert_result.scalar_one())
            profile_key_to_id[profile_key] = profile_id

        bind.execute(
            players_table.update()
            .where(players_table.c.id == row.id)
            .values(bowler_profile_id=profile_id)
        )


def downgrade() -> None:
    op.drop_constraint("fk_tournament_players_bowler_profile_id", "tournament_players", type_="foreignkey")
    op.drop_index("ix_tournament_players_bowler_profile_id", table_name="tournament_players")
    op.drop_column("tournament_players", "bowler_profile_id")

    op.drop_constraint("uq_bowler_profiles_user_usbc", "bowler_profiles", type_="unique")
    op.drop_index("ix_bowler_profiles_name_lower", table_name="bowler_profiles")
    op.drop_index("ix_bowler_profiles_is_active", table_name="bowler_profiles")
    op.drop_index("ix_bowler_profiles_usbc_number", table_name="bowler_profiles")
    op.drop_index("ix_bowler_profiles_last_name", table_name="bowler_profiles")
    op.drop_index("ix_bowler_profiles_first_name", table_name="bowler_profiles")
    op.drop_index("ix_bowler_profiles_user_id", table_name="bowler_profiles")
    op.drop_table("bowler_profiles")
