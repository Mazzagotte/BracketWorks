"""Moving people off a squad's waitlist when a spot opens."""

from __future__ import annotations

import logging

from fastapi import BackgroundTasks
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core import models
from . import tc_emails, tc_registration_changes

logger = logging.getLogger(__name__)


def _published_squads(db: Session, tournament_id: int) -> list[dict]:
    state = db.query(models.TournamentCentralSetupState).filter(
        models.TournamentCentralSetupState.tournament_id == tournament_id,
        models.TournamentCentralSetupState.is_published.is_(True),
    ).first()
    if state is None:
        return []
    payload = state.payload if isinstance(state.payload, dict) else {}
    published = payload.get("_publishedSnapshot")
    squads = (published if isinstance(published, dict) else payload).get("squads")
    return [squad for squad in (squads or []) if isinstance(squad, dict)]


def squad_capacity(db: Session, tournament_id: int, squad_id: str) -> int:
    for squad in _published_squads(db, tournament_id):
        if str(squad.get("id") or "") == squad_id:
            try:
                return int(squad.get("capacity") or 0)
            except (TypeError, ValueError):
                return 0
    return 0


def _bowlers_in(db: Session, entry_ids: list[int]) -> int:
    if not entry_ids:
        return 0
    return int(
        db.query(func.count(models.TcEntryBowler.id))
        .filter(models.TcEntryBowler.entry_id.in_(entry_ids))
        .scalar()
        or 0
    )


Promotion = tuple[models.TcRegistration, list[dict]]


def promote_from_waitlist(
    db: Session, tournament: models.TournamentCentral, squad_id: str | None
) -> list[Promotion]:
    """Confirm waitlisted registrations in a squad, in the order they signed up, while they fit.

    Stops at the first one that doesn't fit, so nobody jumps the line. Saves each move in the
    registration's history. Returns each promoted registration with the organizer's update email;
    the caller commits and sends the emails (``send_promotion_emails``).
    """
    if not squad_id:
        return []
    capacity = squad_capacity(db, tournament.id, squad_id)
    if capacity <= 0:
        return []
    db.flush()
    filled = _bowlers_in(db, [
        row[0] for row in db.query(models.TcEntry.id)
        .join(models.TcRegistration, models.TcRegistration.id == models.TcEntry.registration_id)
        .filter(
            models.TcEntry.tournament_id == tournament.id,
            models.TcEntry.squad_config_id == squad_id,
            models.TcEntry.status.in_(("pending", "confirmed")),
            models.TcRegistration.status.notin_(("cancelled", "refunded", "waitlisted")),
        ).all()
    ])
    waiting = (
        db.query(models.TcEntry, models.TcRegistration)
        .join(models.TcRegistration, models.TcRegistration.id == models.TcEntry.registration_id)
        .filter(
            models.TcEntry.tournament_id == tournament.id,
            models.TcEntry.squad_config_id == squad_id,
            models.TcEntry.status == "waitlisted",
            models.TcRegistration.status == "waitlisted",
        )
        .order_by(models.TcRegistration.submitted_at.asc(), models.TcRegistration.id.asc())
        .all()
    )
    promoted: list[Promotion] = []
    for entry, registration in waiting:
        size = _bowlers_in(db, [entry.id])
        if filled + size > capacity:
            break
        before = tc_registration_changes.snapshot(db, registration)
        registration.status = "confirmed"
        for row in db.query(models.TcEntry).filter(models.TcEntry.registration_id == registration.id).all():
            if row.status == "waitlisted":
                row.status = "confirmed"
        db.flush()
        _, emails = tc_registration_changes.record_changes(db, registration, before, changed_by="waitlist")
        # Bowlers get the "You're off the waitlist" email instead; the organizer gets the update.
        organizer = tc_emails.organizer_notice_recipient(db, tournament)
        filled += size
        promoted.append((registration, [m for m in emails if organizer and m.get("to") == [organizer]]))
    return promoted


def send_promotion_emails(
    background_tasks: BackgroundTasks, db: Session, promoted: list[Promotion]
) -> None:
    """Build the emails now (the database session closes before background tasks run), send later."""
    messages: list[dict] = []
    for registration, organizer_emails in promoted:
        try:
            messages += tc_emails.build_waitlist_promotion_emails(db, registration)
            messages += organizer_emails
        except Exception:
            logger.exception("Could not build waitlist promotion email", extra={"registration_id": registration.id})
    if messages:
        background_tasks.add_task(tc_registration_changes.send_all, messages, log_context="tc-waitlist-promotion")
