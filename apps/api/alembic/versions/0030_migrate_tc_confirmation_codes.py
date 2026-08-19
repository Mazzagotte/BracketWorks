"""migrate legacy tc confirmation codes

Revision ID: 0030_tc_confirmation_codes
Revises: 0029_tc_registration_tables
Create Date: 2026-08-16
"""
from __future__ import annotations

import re

import sqlalchemy as sa
from alembic import op

revision = "0030_tc_confirmation_codes"
down_revision = "0029_tc_registration_tables"
branch_labels = None
depends_on = None


def _confirmation_prefix(name: str) -> str:
    words = re.findall(r"[A-Za-z0-9]+", name or "")
    if not words:
        return "TC"
    if len(words) == 1:
        return words[0][:4].upper()
    return "".join(word[0] for word in words)[:5].upper()


def _confirmation_year(start_date: str | None) -> str:
    match = re.match(r"(\d{4})", (start_date or "").strip())
    return match.group(1) if match else "2026"


def upgrade() -> None:
    connection = op.get_bind()
    rows = connection.execute(
        sa.text(
            """
            SELECT r.id, r.confirmation_code, r.tournament_id, t.name, t.start_date
            FROM tc_registrations AS r
            JOIN tc_tournaments AS t ON t.id = r.tournament_id
            ORDER BY r.tournament_id, r.id
            """
        )
    ).mappings().all()

    legacy_rows = [row for row in rows if str(row["confirmation_code"] or "").startswith("reg-")]
    if not legacy_rows:
        return

    # Clear the unique values first so a mixed old/new dataset cannot collide during conversion.
    for row in legacy_rows:
        connection.execute(
            sa.text(
                "UPDATE tc_registrations SET confirmation_code = :temporary_code WHERE id = :id"
            ),
            {"temporary_code": f"legacy-migration-{row['id']}", "id": row["id"]},
        )

    existing_codes = {
        (int(row["tournament_id"]), str(row["confirmation_code"]))
        for row in rows
        if not str(row["confirmation_code"] or "").startswith("reg-")
    }
    sequence_by_tournament: dict[int, int] = {}
    for row in legacy_rows:
        tournament_id = int(row["tournament_id"])
        sequence = sequence_by_tournament.get(tournament_id, 0) + 1
        prefix = _confirmation_prefix(str(row["name"] or ""))
        year = _confirmation_year(row["start_date"])
        code = f"{prefix}-{year}-{sequence:04d}"
        while (tournament_id, code) in existing_codes:
            sequence += 1
            code = f"{prefix}-{year}-{sequence:04d}"
        sequence_by_tournament[tournament_id] = sequence
        existing_codes.add((tournament_id, code))
        connection.execute(
            sa.text(
                "UPDATE tc_registrations SET confirmation_code = :confirmation_code WHERE id = :id"
            ),
            {"confirmation_code": code, "id": row["id"]},
        )


def downgrade() -> None:
    # Legacy UUID values are intentionally not recreated; the new codes are the durable public identifiers.
    pass
