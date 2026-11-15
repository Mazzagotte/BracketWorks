"""Bowler "Manage registration" links and the date after which bowlers can no longer make changes.

Every person on a registration gets their own link: the contact (who filled in the form) and each
bowler. A link is ``<registration id>.<person>.<signature>``, where person is ``c`` for the contact
or ``b<bowler id>``, and the signature is an HMAC over those plus the person's ``manage_key``.
Giving someone a new ``manage_key`` (for example when they are swapped off the registration) stops
their old link from working. Nothing secret is stored in the link itself.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import date, datetime, time, timezone
from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.orm import Session

from ..core import models
from ..core.config import settings

_DEFAULT_TIMEZONE = "America/Denver"


def new_manage_key() -> str:
    return secrets.token_hex(16)


def _signature(registration_id: int, person: str, key: str) -> str:
    message = f"tc-manage:{registration_id}:{person}:{key}".encode()
    digest = hmac.new(settings.SECRET_KEY.encode(), message, hashlib.sha256).hexdigest()
    return digest[:40]


def manage_token(
    registration: models.TcRegistration, bowler: Optional[models.TcRegistrationBowler] = None
) -> str:
    """The link token for the contact (no bowler) or for one bowler. Empty when there is no key yet."""
    key = (bowler.manage_key if bowler is not None else registration.manage_key) or ""
    if not key:
        return ""
    person = f"b{bowler.id}" if bowler is not None else "c"
    return f"{registration.id}.{person}.{_signature(registration.id, person, key)}"


def manage_url(token: str) -> str:
    return f"{settings.TC_FRONTEND_URL.rstrip('/')}/registration/manage?token={token}"


def resolve_token(
    db: Session, token: str
) -> Optional[tuple[models.TcRegistration, Optional[models.TcRegistrationBowler]]]:
    """The registration (and bowler, for a bowler's link) a token opens, or None when it is not valid."""
    parts = (token or "").strip().split(".")
    if len(parts) != 3 or not parts[0].isdigit():
        return None
    registration_id, person, signature = int(parts[0]), parts[1], parts[2]
    registration = db.get(models.TcRegistration, registration_id)
    if registration is None:
        return None

    bowler: Optional[models.TcRegistrationBowler] = None
    if person == "c":
        key = registration.manage_key or ""
    elif person.startswith("b") and person[1:].isdigit():
        bowler = db.get(models.TcRegistrationBowler, int(person[1:]))
        if bowler is None or bowler.registration_id != registration.id:
            return None
        key = bowler.manage_key or ""
    else:
        return None
    if not key or not hmac.compare_digest(signature, _signature(registration.id, person, key)):
        return None
    return registration, bowler


# --- When bowlers can make changes -------------------------------------------------------------


def _saved_details(db: Session, tournament_id: int) -> dict:
    state = (
        db.query(models.TournamentCentralSetupState)
        .filter(models.TournamentCentralSetupState.tournament_id == tournament_id)
        .first()
    )
    payload = state.payload if state is not None and isinstance(state.payload, dict) else {}
    details = payload.get("details")
    return details if isinstance(details, dict) else {}


def _zone(name: object) -> ZoneInfo:
    try:
        return ZoneInfo(str(name or _DEFAULT_TIMEZONE).strip() or _DEFAULT_TIMEZONE)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo(_DEFAULT_TIMEZONE)


def _local_moment(day: object, clock: object, default_clock: str, zone: ZoneInfo) -> Optional[datetime]:
    try:
        parsed_day = date.fromisoformat(str(day or "").strip()[:10])
    except ValueError:
        return None
    try:
        parsed_clock = time.fromisoformat((str(clock or "").strip() or default_clock)[:5])
    except ValueError:
        parsed_clock = time.fromisoformat(default_clock)
    return datetime.combine(parsed_day, parsed_clock, tzinfo=zone)


def changes_close_at(db: Session, tournament: models.TournamentCentral) -> Optional[datetime]:
    """When bowlers stop being able to change their registration, in the tournament's time zone.

    The organizer's "Bowlers can make changes until" date and time; when not set, the registration
    close date and time; when that is not set either, the start of the first tournament day.
    None means there is no date to go by, so changes stay open.
    """
    details = _saved_details(db, tournament.id)
    zone = _zone(details.get("timezone"))
    return (
        _local_moment(details.get("bowlerChangesCloseIso"), details.get("bowlerChangesCloseTime"), "23:59", zone)
        or _local_moment(details.get("registrationCloseIso"), details.get("registrationCloseTime"), "23:59", zone)
        or _local_moment(details.get("startDateIso") or tournament.start_date, "", "00:00", zone)
    )


def changes_are_open(db: Session, tournament: models.TournamentCentral, now: Optional[datetime] = None) -> bool:
    closes = changes_close_at(db, tournament)
    return closes is None or (now or datetime.now(timezone.utc)) <= closes


def format_close(moment: Optional[datetime]) -> str:
    """For example "February 20, 2027 at 11:59 PM MST"."""
    if moment is None:
        return ""
    hour = moment.hour % 12 or 12
    suffix = "AM" if moment.hour < 12 else "PM"
    return f"{moment.strftime('%B')} {moment.day}, {moment.year} at {hour}:{moment.strftime('%M')} {suffix} {moment.tzname()}"
