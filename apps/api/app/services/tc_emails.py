"""Tournament Central emails to bowlers: confirmations, waitlist promotions, and organizer messages.

Every email goes to exactly one recipient, so addresses are never shown to each other. Emails are
sent through Resend (the same provider as ``email_service``). When a ``TC_*_TEMPLATE_ID`` setting is
set, that hosted template is used with the variables below; otherwise the built-in HTML and text
body is sent, which needs no provider-side setup beyond ``RESEND_API_KEY`` and a verified
``TC_FROM_EMAIL`` domain (tournamentcentral.app). Sending never raises: failures are logged and reported as ``False`` or counted.
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

from sqlalchemy.orm import Session

from ..core import models
from ..core.config import settings

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

    support_email = _normalize_email(_text(details.get("supportEmail"))) or ""
    organizer_name = _text(details.get("contactName")) or _text(details.get("organizer"))
    return {
        "tournament_name": tournament.name,
        "tournament_dates": dates,
        "tournament_location": location,
        "organizer_name": organizer_name,
        "organizer_email": support_email,
    }


def _organizer_line(facts: dict[str, str]) -> str:
    name = facts["organizer_name"]
    email = facts["organizer_email"]
    if name and email:
        return f"Questions? Contact {name} at {email}."
    if email:
        return f"Questions? Contact the organizer at {email}."
    if name:
        return f"Questions? Contact {name}."
    return ""


def _entry_lines(db: Session, registration: models.TcRegistration) -> list[str]:
    entries = (
        db.query(models.TcEntry)
        .filter(models.TcEntry.registration_id == registration.id)
        .order_by(models.TcEntry.id.asc())
        .all()
    )
    lines: list[str] = []
    for entry in entries:
        squad_parts = [
            part for part in (
                entry.squad_name_snapshot or "",
                _format_date(entry.squad_date_snapshot),
                _format_time(entry.squad_time_snapshot),
            ) if part
        ]
        event = entry.event_name_snapshot or entry.event_config_id
        if entry.division_name_snapshot:
            event = f"{event} ({entry.division_name_snapshot})"
        squad = f", squad: {' '.join(squad_parts)}" if squad_parts else ""
        lines.append(f"{event}{squad} - {_STATUS_LABELS.get(entry.status, entry.status.title())}")
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


# --- Rendering -------------------------------------------------------------------------------


def _render_html(paragraphs: list[str], *, rows: list[tuple[str, str]] | None = None, items: list[str] | None = None) -> str:
    """Small, plain email body. All values are escaped here."""
    parts = ['<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #1f2328;">']
    for paragraph in paragraphs[:1]:
        parts.append(f"<p>{html.escape(paragraph)}</p>")
    if rows:
        parts.append('<table cellpadding="4" cellspacing="0" style="border-collapse: collapse;">')
        for label, value in rows:
            parts.append(
                f'<tr><td style="color: #59636e; padding-right: 16px;">{html.escape(label)}</td>'
                f"<td>{html.escape(value)}</td></tr>"
            )
        parts.append("</table>")
    if items:
        parts.append("<ul>" + "".join(f"<li>{html.escape(item)}</li>" for item in items) + "</ul>")
    for paragraph in paragraphs[1:]:
        parts.append(f"<p>{html.escape(paragraph)}</p>")
    parts.append("</div>")
    return "".join(parts)


def _render_text(paragraphs: list[str], *, rows: list[tuple[str, str]] | None = None, items: list[str] | None = None) -> str:
    lines: list[str] = paragraphs[:1] + [""]
    if rows:
        lines += [f"{label}: {value}" for label, value in rows] + [""]
    if items:
        lines += [f"- {item}" for item in items] + [""]
    for paragraph in paragraphs[1:]:
        lines += [paragraph, ""]
    return "\n".join(lines).strip() + "\n"


def _clean_subject(subject: str) -> str:
    return " ".join(subject.split())[:200]


def _base_message(to: str, subject: str, facts: dict[str, str]) -> dict:
    message: dict = {"from": _from_address(), "to": [to], "subject": _clean_subject(subject)}
    if facts.get("organizer_email"):
        message["reply_to"] = facts["organizer_email"]
    return message


def _with_body(message: dict, *, template_id: str, variables: dict[str, str], text: str, html_body: str) -> dict:
    if template_id:
        message["template"] = {"id": template_id, "variables": variables}
    else:
        message["text"] = text
        message["html"] = html_body
    return message


# --- Registration confirmation ---------------------------------------------------------------


def build_registration_confirmation(db: Session, registration: models.TcRegistration) -> dict | None:
    """The confirmation email for the registration's contact, or None when there is no valid email."""
    to = _normalize_email(registration.contact_email)
    tournament = db.get(models.TournamentCentral, registration.tournament_id)
    if not to or tournament is None:
        return None

    facts = _tournament_facts(db, tournament)
    status = _STATUS_LABELS.get(registration.status, registration.status.title())
    entries = _entry_lines(db, registration)
    side_events = _side_event_lines(db, registration)
    total = _format_money(registration.total_cents, registration.currency)
    first_name = (registration.contact_first_name or "").strip()

    if registration.status == "waitlisted":
        lead = f"You're on the waitlist for {tournament.name}. We'll email you if a spot opens."
    elif registration.status == "confirmed":
        lead = f"You're registered for {tournament.name}."
    else:
        lead = f"We received your registration for {tournament.name}. The organizer will confirm it soon."
    greeting = f"Hi {first_name}, {lead[0].lower()}{lead[1:]}" if first_name else lead

    rows = [
        ("Confirmation code", registration.confirmation_code),
        ("Status", status),
        ("Date", facts["tournament_dates"]),
        ("Location", facts["tournament_location"]),
        *(
            [
                ("Entry fees", _format_money(registration.subtotal_cents, registration.currency)),
                ("Side events and fees", _format_money(registration.fees_cents, registration.currency)),
            ]
            if side_events else []
        ),
        ("Total", total),
    ]
    rows = [(label, value) for label, value in rows if value]
    closing = [line for line in (
        "Keep this email. You'll need your confirmation code if you contact the organizer.",
        _organizer_line(facts),
    ) if line]
    paragraphs = [greeting, *closing]

    message = _base_message(to, f"Registration received: {tournament.name}", facts)
    return _with_body(
        message,
        template_id=settings.TC_REGISTRATION_CONFIRMATION_TEMPLATE_ID.strip(),
        variables={
            **facts,
            "first_name": first_name,
            "confirmation_code": registration.confirmation_code,
            "status": status,
            "total": total,
            "entries": "\n".join(entries),
            "side_events": "\n".join(side_events),
        },
        text=_render_text(paragraphs, rows=rows, items=[*entries, *side_events]),
        html_body=_render_html(paragraphs, rows=rows, items=[*entries, *side_events]),
    )


def send_registration_confirmation(db: Session, registration: models.TcRegistration) -> bool:
    try:
        message = build_registration_confirmation(db, registration)
    except Exception:
        logger.exception("Could not build registration confirmation", extra={"registration_id": registration.id})
        return False
    if message is None:
        return False
    return send_email(message, log_context="tc-registration-confirmation")


# --- Waitlist promotion ----------------------------------------------------------------------


def send_waitlist_promotion(db: Session, registration: models.TcRegistration) -> bool:
    """Tell everyone on the registration that a spot opened. True when at least one email was sent."""
    tournament = db.get(models.TournamentCentral, registration.tournament_id)
    recipients = registration_emails(db, registration)
    if tournament is None or not recipients:
        return False

    facts = _tournament_facts(db, tournament)
    entries = _entry_lines(db, registration)
    rows = [
        (label, value) for label, value in (
            ("Confirmation code", registration.confirmation_code),
            ("Status", "Confirmed"),
            ("Date", facts["tournament_dates"]),
            ("Location", facts["tournament_location"]),
        ) if value
    ]
    paragraphs = [
        f"Good news: a spot opened up and you're now confirmed for {tournament.name}.",
        *[line for line in (_organizer_line(facts),) if line],
    ]
    text = _render_text(paragraphs, rows=rows, items=entries)
    html_body = _render_html(paragraphs, rows=rows, items=entries)
    template_id = settings.TC_WAITLIST_PROMOTION_TEMPLATE_ID.strip()
    variables = {**facts, "confirmation_code": registration.confirmation_code, "entries": "\n".join(entries)}

    messages = [
        _with_body(
            _base_message(email, f"You're off the waitlist: {tournament.name}", facts),
            template_id=template_id,
            variables=variables,
            text=text,
            html_body=html_body,
        )
        for email in recipients
    ]
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
    text = f"{body.strip()}\n\n--\n{footer}\n"
    paragraphs_html = "".join(
        f"<p>{html.escape(paragraph).replace(chr(10), '<br>')}</p>"
        for paragraph in re.split(r"\n\s*\n", body.strip())
        if paragraph.strip()
    )
    html_body = (
        '<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #1f2328;">'
        f"{paragraphs_html}"
        f'<p style="color: #59636e; font-size: 12px;">{html.escape(footer)}</p>'
        "</div>"
    )
    messages = [
        {**_base_message(email, subject, facts), "text": text, "html": html_body}
        for email in recipients
    ]
    return send_email_batch(messages, log_context="tc-organizer-message")
