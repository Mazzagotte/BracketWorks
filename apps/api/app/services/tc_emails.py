"""Tournament Central emails: registration confirmations, organizer notices, change and waitlist
emails, lost-link emails, and organizer messages.

Every email is a hosted template in Resend (see ``TEMPLATES``); the design and wording live there,
not here. This module only decides who gets which email and fills in the template's values. Every
email goes to exactly one recipient, so addresses are never shown to each other. Sending never
raises: failures are logged and reported as ``False`` or counted.
"""

from __future__ import annotations

import html
import json
import logging
import os
import re
from datetime import date, datetime
from typing import Iterable, Literal
from urllib import error as url_error
from urllib import request as url_request

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core import models
from ..core.config import settings
from . import tc_manage_links

logger = logging.getLogger(__name__)

Audience = Literal["all", "squad", "unpaid", "waitlisted"]

RESEND_API_BASE = "https://api.resend.com"
RESEND_BATCH_LIMIT = 100
INACTIVE_REGISTRATION_STATUSES = ("cancelled", "refunded")
_EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_STATUS_LABELS = {
    "confirmed": "Confirmed",
    "pending": "Pending",
    "waitlisted": "Waitlisted",
    "cancelled": "Cancelled",
    "refunded": "Refunded",
}


# --- Transport -------------------------------------------------------------------------------


def _from_address() -> str:
    return f"{settings.TC_FROM_NAME} <{settings.TC_FROM_EMAIL}>"


def _post_resend(path: str, body: dict | list) -> bool:
    """POST to the Resend API. Returns True on a 2xx response."""
    api_key = os.getenv("RESEND_API_KEY", settings.RESEND_API_KEY).strip()
    if not api_key:
        logger.error("RESEND_API_KEY is not configured; email not sent", extra={"context": path})
        return False

    request = url_request.Request(
        f"{RESEND_API_BASE}{path}",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "BracketWorks/1.0",
        },
        method="POST",
    )
    try:
        with url_request.urlopen(request, timeout=15) as response:
            status_code = getattr(response, "status", None) or response.getcode()
            return 200 <= status_code < 300
    except url_error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")
        logger.error("Resend send failed", extra={"context": path, "status_code": exc.code, "details": details})
        return False


def send_email(message: dict, *, log_context: str) -> bool:
    """Send one email. Never raises."""
    try:
        sent = bool(_post_resend("/emails", message))
    except Exception:
        logger.exception("Unexpected error while sending email", extra={"context": log_context})
        return False
    if not sent:
        logger.warning("Email not sent", extra={"context": log_context})
    return sent


def send_email_batch(messages: list[dict], *, log_context: str) -> tuple[int, int]:
    """Send separate one-recipient emails in batches of 100. Returns (sent, failed). Never raises."""
    sent = 0
    failed = 0
    for start in range(0, len(messages), RESEND_BATCH_LIMIT):
        chunk = messages[start:start + RESEND_BATCH_LIMIT]
        try:
            ok = bool(_post_resend("/emails/batch", chunk))
        except Exception:
            logger.exception("Unexpected error while sending email batch", extra={"context": log_context})
            ok = False
        if ok:
            sent += len(chunk)
        else:
            failed += len(chunk)
    if failed:
        logger.warning("Some emails were not sent", extra={"context": log_context, "sent": sent, "failed": failed})
    return sent, failed


# --- Recipients ------------------------------------------------------------------------------


def _normalize_email(value: str | None) -> str | None:
    email = (value or "").strip().lower()
    return email if _EMAIL_PATTERN.match(email) else None


def _unique_emails(values: Iterable[str | None]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        email = _normalize_email(value)
        if email and email not in seen:
            seen.add(email)
            result.append(email)
    return result


def registration_emails(db: Session, registration: models.TcRegistration) -> list[str]:
    """The contact email, then any bowler emails, de-duplicated without regard to case."""
    bowler_emails = [
        email
        for (email,) in db.query(models.TcRegistrationBowler.email)
        .filter(models.TcRegistrationBowler.registration_id == registration.id)
        .order_by(models.TcRegistrationBowler.id.asc())
        .all()
    ]
    return _unique_emails([registration.contact_email, *bowler_emails])


def resolve_audience_emails(
    db: Session,
    tournament_id: int,
    audience: Audience,
    squad_config_id: str | None = None,
) -> list[str]:
    """Unique recipient emails for an organizer message audience.

    Cancelled and refunded registrations are never included. "waitlisted" targets waitlisted
    registrations only; "squad" targets registrations with an active entry in that squad.
    """
    query = db.query(models.TcRegistration).filter(models.TcRegistration.tournament_id == tournament_id)
    if audience == "waitlisted":
        query = query.filter(models.TcRegistration.status == "waitlisted")
    else:
        query = query.filter(models.TcRegistration.status.notin_(INACTIVE_REGISTRATION_STATUSES))
    if audience == "unpaid":
        query = query.filter(models.TcRegistration.payment_status == "unpaid")
    if audience == "squad":
        squad_registration_ids = (
            db.query(models.TcEntry.registration_id)
            .filter(
                models.TcEntry.tournament_id == tournament_id,
                models.TcEntry.squad_config_id == (squad_config_id or ""),
                models.TcEntry.status != "cancelled",
            )
        )
        query = query.filter(models.TcRegistration.id.in_(squad_registration_ids))

    registrations = query.order_by(models.TcRegistration.id.asc()).all()
    if not registrations:
        return []

    bowler_emails: dict[int, list[str | None]] = {}
    for registration_id, email in (
        db.query(models.TcRegistrationBowler.registration_id, models.TcRegistrationBowler.email)
        .filter(models.TcRegistrationBowler.registration_id.in_([row.id for row in registrations]))
        .order_by(models.TcRegistrationBowler.id.asc())
        .all()
    ):
        bowler_emails.setdefault(registration_id, []).append(email)

    return _unique_emails(
        email
        for registration in registrations
        for email in [registration.contact_email, *bowler_emails.get(registration.id, [])]
    )


# --- Tournament facts ------------------------------------------------------------------------


def _setup_details(db: Session, tournament_id: int) -> dict:
    state = db.query(models.TournamentCentralSetupState).filter(
        models.TournamentCentralSetupState.tournament_id == tournament_id,
    ).first()
    payload = state.payload if state is not None and isinstance(state.payload, dict) else {}
    snapshot = payload.get("_publishedSnapshot")
    source = snapshot if isinstance(snapshot, dict) else payload
    details = source.get("details")
    return details if isinstance(details, dict) else {}


def _text(value: object) -> str:
    return str(value).strip() if isinstance(value, (str, int, float)) else ""


def _format_date(value: str | None) -> str:
    raw = (value or "").strip()
    try:
        parsed = date.fromisoformat(raw[:10])
    except ValueError:
        return raw
    return f"{parsed.strftime('%B')} {parsed.day}, {parsed.year}"


def _format_time(value: str | None) -> str:
    raw = (value or "").strip()
    try:
        parsed = datetime.strptime(raw[:5], "%H:%M")
    except ValueError:
        return raw
    hour = parsed.hour % 12 or 12
    return f"{hour}:{parsed.strftime('%M')} {'AM' if parsed.hour < 12 else 'PM'}"


def _format_money(cents: int | None, currency: str | None) -> str:
    amount = (cents or 0) / 100
    prefix = "$" if (currency or "USD").upper() == "USD" else f"{(currency or '').upper()} "
    return f"{prefix}{amount:,.2f}"


def _setup_payload(db: Session, tournament_id: int) -> dict:
    state = db.query(models.TournamentCentralSetupState).filter(
        models.TournamentCentralSetupState.tournament_id == tournament_id,
    ).first()
    return state.payload if state is not None and isinstance(state.payload, dict) else {}


def tournament_url(tournament_id: int) -> str:
    """The tournament's public page on Tournament Central."""
    return f"{settings.TC_FRONTEND_URL.rstrip('/')}/?tournament=tc-{tournament_id}"


def organizer_registrations_url(tournament_id: int) -> str:
    return f"{settings.TC_FRONTEND_URL.rstrip('/')}/organizer/tournaments/{tournament_id}/registrations"


def _tournament_facts(db: Session, tournament: models.TournamentCentral) -> dict[str, str]:
    details = _setup_details(db, tournament.id)
    start = _format_date(_text(details.get("startDateIso")) or tournament.start_date)
    end = _format_date(_text(details.get("endDateIso")) or tournament.end_date)
    dates = start if not end or end == start else f"{start} to {end}" if start else end

    center = _text(details.get("bowlingCenter"))
    city = _text(details.get("city"))
    state = _text(details.get("state"))
    place = ", ".join(part for part in (center, city, state) if part)
    location = place or (tournament.location or "").strip()

    street = ", ".join(
        part for part in (_text(details.get("venueAddressLine1")), _text(details.get("venueAddressLine2"))) if part
    )
    region = " ".join(part for part in (state, _text(details.get("venueZip"))) if part)
    locality = ", ".join(part for part in (city, region) if part)
    address = ", ".join(part for part in (street, locality) if part) if street else ""

    support_email = _normalize_email(_text(details.get("supportEmail"))) or ""
    organizer_name = _text(details.get("contactName")) or _text(details.get("organizer"))
    return {
        "tournament_name": tournament.name,
        "tournament_dates": dates,
        "tournament_location": location,
        "tournament_address": address,
        "tournament_url": tournament_url(tournament.id),
        "organizer_name": organizer_name,
        "organizer_email": support_email,
        "organizer_phone": _text(details.get("supportPhone")),
    }


def _organizer_line(facts: dict[str, str]) -> str:
    """The one place the bowler email gives the organizer's contact info."""
    name = facts["organizer_name"] or "the organizer"
    ways = " or ".join(part for part in (facts["organizer_email"], facts["organizer_phone"]) if part)
    if ways:
        return f"Questions? Contact {name} at {ways}."
    if facts["organizer_name"]:
        return f"Questions? Contact {name}."
    return ""


def _entry_lines(db: Session, registration: models.TcRegistration, *, with_bowlers: bool = False) -> list[str]:
    """One line per entry, for example "Singles (Open), squad: Saturday 9:00 AM - Confirmed".

    With with_bowlers, the line also names who bowls in it ("... for Ann Lee and Bo Ray").
    """
    entries = (
        db.query(models.TcEntry)
        .filter(models.TcEntry.registration_id == registration.id)
        .order_by(models.TcEntry.id.asc())
        .all()
    )
    names_by_entry: dict[int, list[str]] = {}
    if with_bowlers and entries:
        rows = (
            db.query(models.TcEntryBowler, models.TcRegistrationBowler)
            .join(models.TcRegistrationBowler, models.TcRegistrationBowler.id == models.TcEntryBowler.bowler_id)
            .filter(models.TcEntryBowler.entry_id.in_([entry.id for entry in entries]))
            .order_by(models.TcEntryBowler.entry_id.asc(), models.TcEntryBowler.position.asc())
            .all()
        )
        for link, bowler in rows:
            name = _full_name(bowler.first_name, bowler.last_name)
            if name:
                names_by_entry.setdefault(link.entry_id, []).append(name)
    lines: list[str] = []
    for entry in entries:
        squad_name = (entry.squad_name_snapshot or "").strip()
        squad_parts = [squad_name] if squad_name else []
        # Squad names usually already hold the date and time; only add them when they are missing.
        for part in (_format_date(entry.squad_date_snapshot), _format_time(entry.squad_time_snapshot)):
            if part and part not in squad_name:
                squad_parts.append(part)
        event = entry.event_name_snapshot or entry.event_config_id
        if entry.division_name_snapshot:
            event = f"{event} ({entry.division_name_snapshot})"
        squad = f", squad: {' '.join(squad_parts)}" if squad_parts else ""
        names = names_by_entry.get(entry.id, [])
        who = f" for {', '.join(names[:-1])} and {names[-1]}" if len(names) > 1 else f" for {names[0]}" if names else ""
        state = "" if entry.status == "confirmed" else f" - {_STATUS_LABELS.get(entry.status, entry.status.title())}"
        lines.append(f"{event}{squad}{who}{state}")
    return lines


def _side_event_lines(db: Session, registration: models.TcRegistration) -> list[str]:
    """One line per side event or fee, for example "Brackets x5 for Ann Lee: $25.00"."""
    rows = (
        db.query(models.TcRegistrationSideEvent)
        .filter(models.TcRegistrationSideEvent.registration_id == registration.id)
        .order_by(models.TcRegistrationSideEvent.id.asc())
        .all()
    )
    if not rows:
        return []
    bowler_ids = [row.bowler_id for row in rows if row.bowler_id is not None]
    names: dict[int, str] = {}
    if bowler_ids:
        for bowler in (
            db.query(models.TcRegistrationBowler)
            .filter(models.TcRegistrationBowler.id.in_(bowler_ids))
            .all()
        ):
            names[bowler.id] = " ".join(f"{bowler.first_name or ''} {bowler.last_name or ''}".split())
    lines: list[str] = []
    for row in rows:
        label = f"{row.name_snapshot} x{row.quantity}" if row.quantity > 1 else row.name_snapshot
        who = names.get(row.bowler_id) if row.bowler_id is not None else None
        if who:
            label = f"{label} for {who}"
        lines.append(f"{label}: {_format_money(row.total_cents, registration.currency)}")
    return lines


def _full_name(first: str | None, last: str | None) -> str:
    return " ".join(f"{first or ''} {last or ''}".split())


def _bowlers(db: Session, registration: models.TcRegistration) -> list[models.TcRegistrationBowler]:
    return (
        db.query(models.TcRegistrationBowler)
        .filter(models.TcRegistrationBowler.registration_id == registration.id)
        .order_by(models.TcRegistrationBowler.id.asc())
        .all()
    )


# --- Resend templates --------------------------------------------------------------------------
#
# Every Tournament Central email is a hosted template in Resend (the design lives there, not in
# this code). The code only fills in values. Variables are inserted as-is by Resend's
# triple-brace syntax, so every value is HTML-escaped here; lists are sent as lines of text that
# the templates show one per line.

TEMPLATES = {
    "confirmation": "tc-registration-confirmation",
    "waitlist_promotion": "tc-waitlist-promotion",
    "organizer_new_registration": "tc-organizer-new-registration",
    "registration_updated": "tc-registration-updated",
    "organizer_registration_updated": "tc-organizer-registration-updated",
    "registration_cancelled": "tc-registration-cancelled",
    "registration_removed": "tc-registration-removed",
    "registration_links": "tc-registration-links",
    "organizer_message": "tc-organizer-message",
}

# Shown in a list section that has nothing in it.
_NONE = "None"

# Kept for the parts of the app that describe a bowler as (title, label/value rows, extra lines).
Section = tuple[str, list[tuple[str, str]], list[str]]


def _template_id(kind: str) -> str:
    overrides = {
        "confirmation": settings.TC_REGISTRATION_CONFIRMATION_TEMPLATE_ID,
        "waitlist_promotion": settings.TC_WAITLIST_PROMOTION_TEMPLATE_ID,
    }
    return (overrides.get(kind) or "").strip() or TEMPLATES[kind]


def _escape(value: object) -> str:
    return html.escape(str(value if value is not None else ""), quote=False)


def _lines(values: Iterable[str], *, blank_between: bool = False) -> str:
    items = [value for value in values if value]
    return ("\n\n" if blank_between else "\n").join(items) or _NONE


def _row_lines(rows: Iterable[tuple[str, str]]) -> str:
    return "\n".join(f"{label}: {value}" for label, value in rows if value)


def _site_vars(footer_note: str) -> dict[str, str]:
    site = settings.TC_FRONTEND_URL.rstrip("/")
    return {
        "product_name": "Tournament Central",
        "site_url": site,
        "logo_url": f"{site}/email-logo.png",
        "footer_note": footer_note,
    }


def _template_message(
    to: str,
    subject: str,
    kind: str,
    variables: dict[str, object],
    *,
    reply_to: str | None = None,
) -> dict:
    message: dict = {
        "from": _from_address(),
        "to": [to],
        "subject": _clean_subject(subject),
        "template": {
            "id": _template_id(kind),
            "variables": {key: _escape(value) for key, value in variables.items()},
        },
    }
    if reply_to:
        message["reply_to"] = reply_to
    return message


def _clean_subject(subject: str) -> str:
    return " ".join(subject.split())[:200]


def _tournament_vars(facts: dict[str, str]) -> dict[str, str]:
    return {
        "tournament_name": facts["tournament_name"],
        "tournament_dates": facts["tournament_dates"],
        "tournament_location": facts["tournament_location"],
        "tournament_address": facts["tournament_address"],
    }


def _fee_vars(registration: models.TcRegistration, side_events: list[str]) -> dict[str, str]:
    """Total due (Tournament Central never takes entry money; bowlers pay at the center) and, when
    there are side events, how it adds up."""
    details = ""
    if side_events:
        details = _row_lines([
            ("Entry fees", _format_money(registration.subtotal_cents, registration.currency)),
            ("Side events and fees", _format_money(registration.fees_cents, registration.currency)),
        ])
    return {
        "total_due": _format_money(registration.total_cents, registration.currency),
        "fee_details": details,
        "side_events": _lines(side_events),
    }


def _registration_vars(db: Session, registration: models.TcRegistration) -> dict[str, str]:
    """Entries, side events and fees: shared by every email about a registration."""
    side_events = _side_event_lines(db, registration)
    return {
        "confirmation_code": registration.confirmation_code,
        "entries": _lines(_entry_lines(db, registration)),
        **_fee_vars(registration, side_events),
    }


def _bowler_footer(tournament: models.TournamentCentral) -> str:
    return f"You're getting this because you're on a registration for {tournament.name}."


def _organizer_footer(tournament: models.TournamentCentral) -> str:
    return (
        f"You're getting this because new-registration emails are on for {tournament.name}. "
        "Turn them off in the tournament's setup, under Registration emails."
    )


def _greeting(first_name: str) -> str:
    return f"Hi {first_name}," if first_name else "Hi there,"


# --- Registration confirmation ---------------------------------------------------------------


def _confirmation_recipients(
    db: Session, registration: models.TcRegistration
) -> list[tuple[str, str, bool, str]]:
    """(email, first name, is the contact, manage link) for everyone on the registration, each email once."""
    people: list[tuple[str | None, str, bool, str]] = [(
        registration.contact_email,
        (registration.contact_first_name or "").strip(),
        True,
        tc_manage_links.manage_token(registration),
    )]
    people += [
        (bowler.email, (bowler.first_name or "").strip(), False, tc_manage_links.manage_token(registration, bowler))
        for bowler in _bowlers(db, registration)
    ]
    seen: set[str] = set()
    recipients: list[tuple[str, str, bool, str]] = []
    for email, first_name, is_contact, token in people:
        normalized = _normalize_email(email)
        if normalized and normalized not in seen:
            seen.add(normalized)
            recipients.append((normalized, first_name, is_contact, tc_manage_links.manage_url(token) if token else ""))
    return recipients


def _changes_line(db: Session, tournament: models.TournamentCentral) -> str:
    """When bowlers can still change their registration, for the closing lines."""
    if not tc_manage_links.changes_are_open(db, tournament):
        return "Changes are closed. Contact the organizer to change your registration."
    closes = tc_manage_links.format_close(tc_manage_links.changes_close_at(db, tournament))
    if closes:
        return f"Need to change something? Use Manage registration until {closes}."
    return "Need to change something? Use Manage registration."


def build_registration_confirmations(db: Session, registration: models.TcRegistration) -> list[dict]:
    """One confirmation per person on the registration: the contact and every bowler with an email."""
    tournament = db.get(models.TournamentCentral, registration.tournament_id)
    recipients = _confirmation_recipients(db, registration)
    if tournament is None or not recipients:
        return []

    facts = _tournament_facts(db, tournament)
    status = _STATUS_LABELS.get(registration.status, registration.status.title())
    contact_name = _full_name(registration.contact_first_name, registration.contact_last_name)
    bowler_names = [_full_name(bowler.first_name, bowler.last_name) for bowler in _bowlers(db, registration)]

    if registration.status == "waitlisted":
        state_line = "is on the waitlist. We'll email you if a spot opens."
        title = "You're on the waitlist"
    elif registration.status == "confirmed":
        state_line = "is confirmed."
        title = "Registration confirmed"
    else:
        state_line = "was received. The organizer will confirm it soon."
        title = "Registration received"

    contact_bowls = contact_name.casefold() in {name.casefold() for name in bowler_names}
    shared = {
        **_site_vars(_bowler_footer(tournament)),
        **_tournament_vars(facts),
        **_registration_vars(db, registration),
        "title": title,
        "registration_info": _row_lines([
            ("Status", "" if registration.status == "confirmed" else status),
            ("Registered by", "" if contact_bowls else contact_name),
        ]),
        "bowlers": _lines(bowler_names),
        "closing": _lines([
            _changes_line(db, tournament),
            "Keep this email. You'll need your confirmation code if you contact the organizer.",
            _organizer_line(facts),
            f"Tournament page: {facts['tournament_url']}",
        ], blank_between=True),
    }

    messages: list[dict] = []
    for email, first_name, is_contact, manage_url in recipients:
        if is_contact:
            lead = f"Your registration for {tournament.name} {state_line}"
        else:
            lead = f"{contact_name or 'Someone'} registered you for {tournament.name}. The registration {state_line}"
        messages.append(_template_message(
            email,
            f"Registration received: {tournament.name}",
            "confirmation",
            {**shared, "greeting": _greeting(first_name), "lead": lead, "manage_url": manage_url or facts["tournament_url"]},
            reply_to=facts.get("organizer_email") or None,
        ))
    return messages


def build_registration_confirmation(db: Session, registration: models.TcRegistration) -> dict | None:
    """The contact's confirmation, or None when there is no valid email."""
    messages = build_registration_confirmations(db, registration)
    return messages[0] if messages else None


def send_registration_confirmation(db: Session, registration: models.TcRegistration) -> bool:
    """Send the confirmation to everyone on the registration. True when at least one was sent."""
    try:
        messages = build_registration_confirmations(db, registration)
    except Exception:
        logger.exception("Could not build registration confirmation", extra={"registration_id": registration.id})
        return False
    if not messages:
        return False
    sent, _ = send_email_batch(messages, log_context="tc-registration-confirmation")
    return sent > 0


# --- New registration notice for the organizer -----------------------------------------------


def organizer_notice_recipient(db: Session, tournament: models.TournamentCentral) -> str | None:
    """Where new-registration emails go, or None when the organizer turned them off.

    They are on by default. Read from the saved setup, not the published one, so turning them on or
    off takes effect at once. The address is the one set for notifications, else the tournament's
    contact email, else the owner's account email.
    """
    details = _setup_payload(db, tournament.id).get("details")
    details = details if isinstance(details, dict) else {}
    if details.get("registrationNotificationsOff") is True:
        return None
    owner = db.get(models.User, tournament.user_id)
    return (
        _normalize_email(_text(details.get("registrationNotificationEmail")))
        or _normalize_email(_text(details.get("supportEmail")))
        or _normalize_email(owner.email if owner else None)
    )


_GENDER_LABELS = {"M": "Male", "F": "Female"}


def _answer_text(value: object) -> str:
    """A registration question's answer as one line of text."""
    if isinstance(value, dict):
        value = value.get("value")
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, (list, tuple)):
        return ", ".join(part for part in (_answer_text(item) for item in value) if part)
    return _text(value)


def _answers_by_bowler(db: Session, registration: models.TcRegistration) -> dict[int | None, list[tuple[str, str]]]:
    """Each bowler's answers to the organizer's questions, once per question (they repeat per entry)."""
    rows = (
        db.query(models.TcRegistrationAnswer)
        .filter(models.TcRegistrationAnswer.registration_id == registration.id)
        .order_by(models.TcRegistrationAnswer.id.asc())
        .all()
    )
    answers: dict[int | None, list[tuple[str, str]]] = {}
    seen: set[tuple[int | None, str]] = set()
    for row in rows:
        key = (row.bowler_id, row.question_config_id)
        text = _answer_text(row.answer_json)
        if key in seen or not text:
            continue
        seen.add(key)
        answers.setdefault(row.bowler_id, []).append((row.question_label_snapshot or row.question_config_id, text))
    return answers


def _bowler_section(bowler: models.TcRegistrationBowler, answers: list[tuple[str, str]], number: int) -> Section:
    """Everything the bowler filled in on the form."""
    street = (bowler.address or "").strip()
    region = " ".join(part for part in ((bowler.state or "").strip(), (bowler.zip_code or "").strip()) if part)
    locality = ", ".join(part for part in ((bowler.city or "").strip(), region) if part)
    address = ", ".join(part for part in (street, locality) if part)
    gender = (bowler.gender or "").strip()
    rows = [
        ("Name", _full_name(bowler.first_name, bowler.last_name)),
        ("Email", (bowler.email or "").strip()),
        ("Phone", (bowler.phone or "").strip()),
        ("USBC number", (bowler.usbc_number or "").strip()),
        ("Average", str(bowler.average) if bowler.average is not None else ""),
        ("Date of birth", _format_date(bowler.date_of_birth) if bowler.date_of_birth else ""),
        ("Gender", _GENDER_LABELS.get(gender.upper(), gender)),
        ("Address", address),
        *answers,
    ]
    return (f"Bowler {number}", [(label, value) for label, value in rows if value], [])


def _digits(value: str | None) -> str:
    return "".join(ch for ch in (value or "") if ch.isdigit())


def _contact_is_a_bowler(registration: models.TcRegistration, bowlers: list[models.TcRegistrationBowler]) -> bool:
    """True when the person who registered is one of the bowlers and their section already shows
    the contact's email and phone, so a separate Contact section would only repeat it."""
    name = _full_name(registration.contact_first_name, registration.contact_last_name).casefold()
    email = _normalize_email(registration.contact_email)
    phone = _digits(registration.contact_phone)
    for bowler in bowlers:
        same_person = (
            (email and _normalize_email(bowler.email) == email)
            or (name and _full_name(bowler.first_name, bowler.last_name).casefold() == name)
        )
        if (
            same_person
            and (not email or _normalize_email(bowler.email) == email)
            and (not phone or _digits(bowler.phone) == phone)
        ):
            return True
    return False


def _squad_count_lines(db: Session, registration: models.TcRegistration) -> list[str]:
    """How full each squad on this registration is now, for example "Saturday 9:00 AM: 24 of 40 spots filled"."""
    squads = (
        db.query(models.TcEntry.squad_config_id, models.TcEntry.squad_name_snapshot)
        .filter(models.TcEntry.registration_id == registration.id, models.TcEntry.squad_config_id.isnot(None))
        .order_by(models.TcEntry.id.asc())
        .all()
    )
    capacities: dict[str, int] = {}
    for squad in _setup_payload(db, registration.tournament_id).get("squads") or []:
        if isinstance(squad, dict) and squad.get("id") is not None:
            try:
                capacities[str(squad["id"])] = int(squad.get("capacity") or 0)
            except (TypeError, ValueError):
                pass

    lines: list[str] = []
    seen: set[str] = set()
    for squad_id, squad_name in squads:
        if squad_id in seen:
            continue
        seen.add(squad_id)
        counts = dict(
            db.query(models.TcEntry.status, func.count(models.TcEntryBowler.id))
            .join(models.TcEntryBowler, models.TcEntryBowler.entry_id == models.TcEntry.id)
            .filter(
                models.TcEntry.tournament_id == registration.tournament_id,
                models.TcEntry.squad_config_id == squad_id,
                models.TcEntry.status.in_(("pending", "confirmed", "waitlisted")),
            )
            .group_by(models.TcEntry.status)
            .all()
        )
        filled = counts.get("pending", 0) + counts.get("confirmed", 0)
        capacity = capacities.get(squad_id, 0)
        line = f"{(squad_name or 'Squad').strip()}: "
        line += f"{filled} of {capacity} spots filled" if capacity > 0 else f"{filled} bowler{'s' if filled != 1 else ''}"
        if counts.get("waitlisted"):
            line += f", {counts['waitlisted']} on the waitlist"
        lines.append(line)
    return lines


def _contact_lines(registration: models.TcRegistration, bowlers: list[models.TcRegistrationBowler]) -> str:
    """The Contact section: who registered, unless they are a bowler already listed with the same details."""
    if _contact_is_a_bowler(registration, bowlers):
        return "Same as the bowler with this name below"
    contact_email = _normalize_email(registration.contact_email) or (registration.contact_email or "").strip()
    return _row_lines([
        ("Name", _full_name(registration.contact_first_name, registration.contact_last_name)),
        ("Email", contact_email),
        ("Phone", (registration.contact_phone or "").strip()),
    ]) or _NONE


def _bowler_detail_lines(db: Session, registration: models.TcRegistration, bowlers: list[models.TcRegistrationBowler]) -> str:
    """Every bowler's sign-up details, one block per bowler, plus answers not tied to a bowler."""
    answers = _answers_by_bowler(db, registration)
    blocks: list[str] = []
    for number, bowler in enumerate(bowlers, start=1):
        _, rows, _ = _bowler_section(bowler, answers.get(bowler.id, []), number)
        name = next((value for label, value in rows if label == "Name"), "")
        lines = [f"Bowler {number}: {name}" if name else f"Bowler {number}"]
        lines += [f"{label}: {value}" for label, value in rows if label != "Name"]
        blocks.append("\n".join(lines))
    if answers.get(None):
        blocks.append("\n".join(["Other answers", *(f"{label}: {value}" for label, value in answers[None])]))
    return _lines(blocks, blank_between=True)


def build_organizer_registration_notice(db: Session, registration: models.TcRegistration) -> dict | None:
    """The organizer's email about a new registration, with everything on the sign-up, or None when off."""
    tournament = db.get(models.TournamentCentral, registration.tournament_id)
    if tournament is None:
        return None
    recipient = organizer_notice_recipient(db, tournament)
    if not recipient:
        return None

    status = _STATUS_LABELS.get(registration.status, registration.status.title())
    contact_name = _full_name(registration.contact_first_name, registration.contact_last_name)
    contact_email = _normalize_email(registration.contact_email)
    bowlers = _bowlers(db, registration)
    bowler_count = f"{len(bowlers)} bowler{'s' if len(bowlers) != 1 else ''}"
    entries = _entry_lines(db, registration, with_bowlers=len(bowlers) > 1)
    side_events = _side_event_lines(db, registration)
    variables = {
        **_site_vars(_organizer_footer(tournament)),
        **_fee_vars(registration, side_events),
        "lead": f"{contact_name or 'Someone'} registered {bowler_count} for {tournament.name}.",
        "registrations_url": organizer_registrations_url(tournament.id),
        "tournament_name": tournament.name,
        "contact_name": contact_name or registration.confirmation_code,
        "confirmation_code": registration.confirmation_code,
        "registration_info": _row_lines([("Status", "" if registration.status == "confirmed" else status)]),
        "contact_info": _contact_lines(registration, bowlers),
        "bowler_details": _bowler_detail_lines(db, registration, bowlers),
        "entries": _lines(entries),
        "notes": (registration.notes or "").strip() or _NONE,
        "squad_count": _lines(_squad_count_lines(db, registration)),
        "closing": "Reply to this email to reach the person who registered." if contact_email else "",
    }
    return _template_message(
        recipient,
        f"New registration: {contact_name or registration.confirmation_code} - {tournament.name}",
        "organizer_new_registration",
        variables,
        reply_to=contact_email,
    )


# --- Registration changes --------------------------------------------------------------------


def _change_lines(changes: list[dict[str, str]]) -> str:
    return _lines(f"{change['label']}: {change['before']} \u2192 {change['after']}" for change in changes)


def build_registration_update_emails(
    db: Session,
    registration: models.TcRegistration,
    changes: list[dict[str, str]],
    *,
    removed: dict[str, str],
    changed_by: str,
    actor_name: str = "",
) -> list[dict]:
    """Emails about a change: everyone on the registration, anyone just taken off it, and the organizer.

    ``removed`` is email -> first name for people who were on the registration before the change.
    """
    tournament = db.get(models.TournamentCentral, registration.tournament_id)
    if tournament is None or not changes:
        return []
    facts = _tournament_facts(db, tournament)
    cancelled = registration.status in INACTIVE_REGISTRATION_STATUSES
    code = registration.confirmation_code
    actor = (actor_name or "").strip()
    verb = "cancelled" if cancelled else "changed"
    if changed_by == "organizer":
        lead = f"The organizer {verb} registration {code} for {tournament.name}."
    elif changed_by == "waitlist":
        lead = f"Registration {code} for {tournament.name} was {verb}."
    else:
        lead = f"{actor or 'Someone on the registration'} {verb} registration {code} for {tournament.name}."
    title = "Registration cancelled" if cancelled else "Registration updated"
    reply_to = facts.get("organizer_email") or None
    change_lines = _change_lines(changes)

    messages: list[dict] = []
    for email, first_name, _is_contact, manage_url in _confirmation_recipients(db, registration):
        if cancelled:
            messages.append(_template_message(
                email, f"{title}: {tournament.name}", "registration_cancelled",
                {
                    **_site_vars(_bowler_footer(tournament)),
                    "tournament_name": tournament.name,
                    "greeting": _greeting(first_name),
                    "lead": lead,
                    "button_label": "View tournament",
                    "button_url": facts["tournament_url"],
                    "changes": change_lines,
                    "closing": _organizer_line(facts),
                },
                reply_to=reply_to,
            ))
        else:
            messages.append(_template_message(
                email, f"{title}: {tournament.name}", "registration_updated",
                {
                    **_site_vars(_bowler_footer(tournament)),
                    **_registration_vars(db, registration),
                    "tournament_name": tournament.name,
                    "greeting": _greeting(first_name),
                    "lead": lead,
                    "manage_url": manage_url or facts["tournament_url"],
                    "changes": change_lines,
                    "closing": _lines([_changes_line(db, tournament), _organizer_line(facts)], blank_between=True),
                },
                reply_to=reply_to,
            ))

    for email, first_name in removed.items():
        messages.append(_template_message(
            email, f"You're no longer on a registration: {tournament.name}", "registration_removed",
            {
                **_site_vars(f"You're getting this because you were on a registration for {tournament.name}."),
                **_tournament_vars(facts),
                "tournament_url": facts["tournament_url"],
                "greeting": _greeting(first_name),
                "lead": f"You were taken off registration {code} for {tournament.name}. Your old Manage registration link no longer works.",
                "closing": _lines(["If this is a mistake, contact the organizer.", _organizer_line(facts)], blank_between=True),
            },
            reply_to=reply_to,
        ))

    recipient = organizer_notice_recipient(db, tournament)
    if recipient:
        contact_name = _full_name(registration.contact_first_name, registration.contact_last_name)
        organizer_lead = lead if changed_by != "organizer" else (
            f"{actor or 'A staff member'} {verb} registration {code} for {tournament.name}."
        )
        contact_email = _normalize_email(registration.contact_email)
        closing = "Reply to this email to reach the person who registered." if contact_email else ""
        subject = f"{title}: {contact_name or code} - {tournament.name}"
        if cancelled:
            messages.append(_template_message(
                recipient, subject, "registration_cancelled",
                {
                    **_site_vars(_organizer_footer(tournament)),
                    "tournament_name": tournament.name,
                    "greeting": "Hi there,",
                    "lead": organizer_lead,
                    "button_label": "View registrations",
                    "button_url": organizer_registrations_url(tournament.id),
                    "changes": change_lines,
                    "closing": closing,
                },
                reply_to=contact_email,
            ))
        else:
            messages.append(_template_message(
                recipient, subject, "organizer_registration_updated",
                {
                    **_site_vars(_organizer_footer(tournament)),
                    **_registration_vars(db, registration),
                    "tournament_name": tournament.name,
                    "lead": organizer_lead,
                    "registrations_url": organizer_registrations_url(tournament.id),
                    "contact_name": contact_name or code,
                    "changes": change_lines,
                    "squad_count": _lines(_squad_count_lines(db, registration)),
                    "closing": closing,
                },
                reply_to=contact_email,
            ))
    return messages


def build_manage_links_email(db: Session, email: str, registrations: list[models.TcRegistration]) -> dict | None:
    """One email listing a Manage registration link for each of this person's registrations."""
    normalized = _normalize_email(email)
    if not normalized or not registrations:
        return None
    blocks: list[str] = []
    for registration in registrations:
        tournament = db.get(models.TournamentCentral, registration.tournament_id)
        if tournament is None:
            continue
        token = ""
        if _normalize_email(registration.contact_email) == normalized:
            token = tc_manage_links.manage_token(registration)
        else:
            for bowler in _bowlers(db, registration):
                if _normalize_email(bowler.email) == normalized:
                    token = tc_manage_links.manage_token(registration, bowler)
                    break
        if token:
            blocks.append(f"{tournament.name} ({registration.confirmation_code})\n{tc_manage_links.manage_url(token)}")
    if not blocks:
        return None
    return _template_message(
        normalized,
        "Your Tournament Central registration links",
        "registration_links",
        {
            **_site_vars("You're getting this because someone asked for registration links for this email address."),
            "lead": "Here are the links to manage your Tournament Central registrations. Each one only works for you.",
            "registrations": _lines(blocks, blank_between=True),
            "closing": "If you didn't ask for this email, you can ignore it.",
        },
    )


# --- Waitlist promotion ----------------------------------------------------------------------


def build_waitlist_promotion_emails(db: Session, registration: models.TcRegistration) -> list[dict]:
    """Emails telling everyone on the registration that a spot opened, each with their own
    Manage registration link."""
    tournament = db.get(models.TournamentCentral, registration.tournament_id)
    recipients = _confirmation_recipients(db, registration)
    if tournament is None or not recipients:
        return []

    facts = _tournament_facts(db, tournament)
    shared = {
        **_site_vars(_bowler_footer(tournament)),
        **_tournament_vars(facts),
        **_registration_vars(db, registration),
        "lead": f"Good news: a spot opened up and you're now confirmed for {tournament.name}.",
        "closing": _lines([
            _changes_line(db, tournament),
            _organizer_line(facts),
            f"Tournament page: {facts['tournament_url']}",
        ], blank_between=True),
    }
    return [
        _template_message(
            email,
            f"You're off the waitlist: {tournament.name}",
            "waitlist_promotion",
            {**shared, "greeting": _greeting(first_name), "manage_url": manage_url or facts["tournament_url"]},
            reply_to=facts.get("organizer_email") or None,
        )
        for email, first_name, _is_contact, manage_url in recipients
    ]


def send_waitlist_promotion(db: Session, registration: models.TcRegistration) -> bool:
    """Tell everyone on the registration that a spot opened. True when at least one email was sent."""
    messages = build_waitlist_promotion_emails(db, registration)
    if not messages:
        return False
    sent, _ = send_email_batch(messages, log_context="tc-waitlist-promotion")
    return sent > 0


# --- Organizer messages ----------------------------------------------------------------------


def send_organizer_message(
    db: Session,
    tournament: models.TournamentCentral,
    recipients: list[str],
    *,
    subject: str,
    body: str,
) -> tuple[int, int]:
    """Send the organizer's message to each recipient separately. Returns (sent, failed)."""
    facts = _tournament_facts(db, tournament)
    footer = (
        f"You're getting this because you registered for {tournament.name}. Reply to this email to reach the organizer."
        if facts["organizer_email"]
        else f"You're getting this because you registered for {tournament.name}."
    )
    variables = {
        **_site_vars(footer),
        "tournament_name": tournament.name,
        "message_subject": subject.strip(),
        "message": body.strip(),
    }
    messages = [
        _template_message(email, subject, "organizer_message", variables, reply_to=facts.get("organizer_email") or None)
        for email in recipients
    ]
    return send_email_batch(messages, log_context="tc-organizer-message")
