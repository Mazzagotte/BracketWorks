"""What the organizer dashboard shows about each tournament's registration.

Read from the published setup when there is one, because that is what bowlers see; drafts that
were never published fall back to the saved setup.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core import models
from .tc_manage_links import _local_moment, _zone
from .tc_setup_validation import PUBLISHED_SNAPSHOT_KEY

VISIBILITIES = {"public", "unlisted", "private"}


@dataclass(frozen=True)
class RegistrationSummary:
    visibility: Optional[str]
    registration_opens_at: Optional[datetime]
    registration_closes_at: Optional[datetime]
    spots_total: Optional[int]
    spots_filled: int


def _shown_payload(state: models.TournamentCentralSetupState) -> dict:
    payload = state.payload if isinstance(state.payload, dict) else {}
    snapshot = payload.get(PUBLISHED_SNAPSHOT_KEY)
    return snapshot if isinstance(snapshot, dict) else payload


def _total_spots(squads: object) -> Optional[int]:
    """All squad capacities added up, or None when there are no squads or any squad has no limit."""
    if not isinstance(squads, list):
        return None
    capacities: list[int] = []
    for squad in squads:
        if not isinstance(squad, dict):
            continue
        try:
            capacity = int(squad.get("capacity") or 0)
        except (TypeError, ValueError):
            capacity = 0
        if capacity <= 0:
            return None
        capacities.append(capacity)
    return sum(capacities) or None


def filled_spots_by_tournament(db: Session, tournament_ids: list[int]) -> dict[int, int]:
    """Bowlers holding a squad spot, counted the same way as the waitlist (waitlisted people don't count)."""
    if not tournament_ids:
        return {}
    rows = (
        db.query(models.TcEntry.tournament_id, func.count(models.TcEntryBowler.id))
        .join(models.TcEntryBowler, models.TcEntryBowler.entry_id == models.TcEntry.id)
        .join(models.TcRegistration, models.TcRegistration.id == models.TcEntry.registration_id)
        .filter(
            models.TcEntry.tournament_id.in_(tournament_ids),
            models.TcEntry.status.in_(("pending", "confirmed")),
            models.TcRegistration.status.notin_(("cancelled", "refunded", "waitlisted")),
        )
        .group_by(models.TcEntry.tournament_id)
        .all()
    )
    return {int(tournament_id): int(count) for tournament_id, count in rows}


def registration_summary(state: models.TournamentCentralSetupState, spots_filled: int) -> RegistrationSummary:
    payload = _shown_payload(state)
    details = payload.get("details") if isinstance(payload.get("details"), dict) else {}
    zone = _zone(details.get("timezone"))
    visibility = str(details.get("visibility") or "").strip().lower()
    return RegistrationSummary(
        visibility=visibility if visibility in VISIBILITIES else None,
        registration_opens_at=_local_moment(
            details.get("registrationOpenIso"), details.get("registrationOpenTime"), "00:00", zone
        ),
        registration_closes_at=_local_moment(
            details.get("registrationCloseIso"), details.get("registrationCloseTime"), "23:59", zone
        ),
        spots_total=_total_spots(payload.get("squads")),
        spots_filled=spots_filled,
    )
