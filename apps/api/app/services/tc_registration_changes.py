"""What changed on a registration, saved for the organizer's history and emailed to everyone on it.

Take a ``snapshot`` before changing anything, make the change, then call ``record_changes``. It
compares the two snapshots, saves the differences as a ``TcRegistrationChange``, and returns the
emails to send (to everyone on the registration, anyone who was taken off it, and the organizer).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from sqlalchemy.orm import Session

from ..core import models
from . import tc_emails

logger = logging.getLogger(__name__)

_NONE = "None"


@dataclass
class Snapshot:
    """A registration as people see it: labeled values in display order, and who is on it."""

    rows: list[tuple[str, str]] = field(default_factory=list)
    # email -> (first name, full name), for everyone on the registration who has an email
    people: dict[str, tuple[str, str]] = field(default_factory=dict)


_LOWERCASE_LABELS = {"Email", "Phone", "Average", "Date of birth", "Gender", "Address"}


def _bowler_rows(
    number: int, bowler: models.TcRegistrationBowler, answers: list[tuple[str, str]]
) -> list[tuple[str, str]]:
    """For example ("Bowler 2", "Bo Ray"), ("Bowler 2 email", ...), ("Bowler 2 Shirt size", "M")."""
    _, rows, _ = tc_emails._bowler_section(bowler, answers, number)
    prefix = f"Bowler {number}"
    labeled: list[tuple[str, str]] = []
    for label, value in rows:
        if label == "Name":
            labeled.append((prefix, value))
        else:
            labeled.append((f"{prefix} {label.lower() if label in _LOWERCASE_LABELS else label}", value))
    return labeled


def snapshot(db: Session, registration: models.TcRegistration) -> Snapshot:
    db.flush()
    entry = (
        db.query(models.TcEntry)
        .filter(models.TcEntry.registration_id == registration.id)
        .order_by(models.TcEntry.id.asc())
        .first()
    )
    bowlers = tc_emails._bowlers(db, registration)
    answers = tc_emails._answers_by_bowler(db, registration)
    side_events = tc_emails._side_event_lines(db, registration)

    rows: list[tuple[str, str]] = [
        ("Status", tc_emails._STATUS_LABELS.get(registration.status, registration.status.title())),
    ]
    if entry is not None:
        squad = (entry.squad_name_snapshot or "").strip()
        rows += [
            ("Event", (entry.event_name_snapshot or "").strip()),
            ("Division", (entry.division_name_snapshot or "").strip()),
            ("Squad", squad),
        ]
    rows += [
        ("Contact", tc_emails._full_name(registration.contact_first_name, registration.contact_last_name)),
        ("Contact email", (registration.contact_email or "").strip().lower()),
        ("Contact phone", (registration.contact_phone or "").strip()),
    ]
    for number, bowler in enumerate(bowlers, start=1):
        rows += _bowler_rows(number, bowler, answers.get(bowler.id, []))
    rows += [
        ("Side events and fees", "; ".join(side_events)),
        ("Total due at check-in", tc_emails._format_money(registration.total_cents, registration.currency)),
        ("Notes", (registration.notes or "").strip()),
    ]

    people: dict[str, tuple[str, str]] = {}
    for email, first_name, last_name in [
        (registration.contact_email, registration.contact_first_name, registration.contact_last_name),
        *[(bowler.email, bowler.first_name, bowler.last_name) for bowler in bowlers],
    ]:
        normalized = tc_emails._normalize_email(email)
        if normalized and normalized not in people:
            people[normalized] = ((first_name or "").strip(), tc_emails._full_name(first_name, last_name))
    return Snapshot(rows=rows, people=people)


def diff(before: Snapshot, after: Snapshot) -> list[dict[str, str]]:
    """Each label whose value changed, in the order it appears now (removed labels last)."""
    old = dict(before.rows)
    new = dict(after.rows)
    labels = [label for label, _ in after.rows] + [label for label, _ in before.rows if label not in new]
    changes: list[dict[str, str]] = []
    seen: set[str] = set()
    for label in labels:
        if label in seen:
            continue
        seen.add(label)
        was, now = old.get(label, ""), new.get(label, "")
        if was != now:
            changes.append({"label": label, "before": was or _NONE, "after": now or _NONE})
    return changes


def record_changes(
    db: Session,
    registration: models.TcRegistration,
    before: Snapshot,
    *,
    changed_by: str,
    actor_name: str = "",
) -> tuple[list[dict[str, str]], list[dict]]:
    """Save what changed and build the emails about it. Returns (changes, emails); both empty when
    nothing anyone would see changed. The caller commits and sends the emails."""
    after = snapshot(db, registration)
    changes = diff(before, after)
    if not changes:
        return [], []
    db.add(models.TcRegistrationChange(
        registration_id=registration.id,
        tournament_id=registration.tournament_id,
        changed_by=changed_by,
        actor_name=(actor_name or "").strip()[:255] or None,
        changes_json=changes,
    ))
    # Taken off the registration: their email is gone and so is their name (an email change alone isn't).
    names_now = {full.casefold() for _, full in after.people.values() if full}
    removed = {
        email: first
        for email, (first, full) in before.people.items()
        if email not in after.people and (not full or full.casefold() not in names_now)
    }
    try:
        emails = tc_emails.build_registration_update_emails(
            db, registration, changes, removed=removed, changed_by=changed_by, actor_name=actor_name,
        )
    except Exception:
        # The change is saved either way; a problem building an email must not undo it.
        logger.exception("Could not build registration update emails", extra={"registration_id": registration.id})
        emails = []
    return changes, emails


def send_all(emails: list[dict], *, log_context: str = "tc-registration-update") -> None:
    """Send update emails one by one, after the response. Failures are logged, never raised."""
    for message in emails:
        try:
            tc_emails.send_email(message, log_context=log_context)
        except Exception:
            logger.exception("Could not send registration update email")


def history(db: Session, registration_id: int) -> list[models.TcRegistrationChange]:
    return (
        db.query(models.TcRegistrationChange)
        .filter(models.TcRegistrationChange.registration_id == registration_id)
        .order_by(models.TcRegistrationChange.created_at.desc(), models.TcRegistrationChange.id.desc())
        .all()
    )


def actor_label(change: models.TcRegistrationChange) -> str:
    """Who made a change, as the history list shows it."""
    if change.changed_by == "waitlist":
        return "Moved off the waitlist"
    name = (change.actor_name or "").strip()
    if change.changed_by == "organizer":
        return f"{name} (organizer)" if name else "Organizer"
    return name or "Bowler"


def describe(change: dict[str, str]) -> str:
    return f"{change['label']}: {change['before']} to {change['after']}"


__all__ = [
    "Snapshot",
    "snapshot",
    "diff",
    "record_changes",
    "send_all",
    "history",
    "actor_label",
    "describe",
]
