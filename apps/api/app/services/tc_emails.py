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




def _full_name(first: str | None, last: str | None) -> str:
    return " ".join(f"{first or ''} {last or ''}".split())


def _bowlers(db: Session, registration: models.TcRegistration) -> list[models.TcRegistrationBowler]:
    return (
        db.query(models.TcRegistrationBowler)
        .filter(models.TcRegistrationBowler.registration_id == registration.id)
        .order_by(models.TcRegistrationBowler.id.asc())
        .all()
    )


# --- Rendering -------------------------------------------------------------------------------
#
# A light email in the Tournament Central look: a white card on a gray page, sections split by
# thin lines, one orange button. Tables and inline styles only, so mail apps draw it the same.

_FONT = "Inter, 'Segoe UI', Helvetica, Arial, sans-serif"
_PAGE, _CARD, _BORDER = "#f4f4f5", "#ffffff", "#e4e4e7"
_TEXT, _TEXT2, _ACCENT, _ON_ACCENT, _LINK = "#18181b", "#52525b", "#ff7a00", "#17120c", "#c2410c"

Section = tuple[str, list[tuple[str, str]], list[str]]


def _p(text: str, *, size: int = 15, color: str = _TEXT2, weight: int = 400, bottom: int = 12) -> str:
    return (
        f'<p style="margin-top:0;margin-bottom:{bottom}px;font-family:{_FONT};font-size:{size}px;'
        f'line-height:1.5;font-weight:{weight};color:{color};">{text}</p>'
    )


def _divider() -> str:
    return (
        '<tr><td style="padding-left:28px;padding-right:28px;">'
        '<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>'
        f'<td height="1" bgcolor="{_BORDER}" style="height:1px;line-height:1px;font-size:1px;'
        f'background-color:{_BORDER};">&nbsp;</td></tr></table></td></tr>'
    )


def _cell(inner: str, *, top: int = 20, bottom: int = 20) -> str:
    return (
        f'<tr><td style="padding-top:{top}px;padding-bottom:{bottom}px;padding-left:28px;'
        f'padding-right:28px;">{inner}</td></tr>'
    )


def _render_section_html(heading: str, rows: list[tuple[str, str]], items: list[str]) -> str:
    parts = [_p(html.escape(heading), size=13, color=_TEXT, weight=600, bottom=8)]
    if rows:
        parts.append('<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">')
        for label, value in rows:
            parts.append(
                f'<tr><td valign="top" width="40%" style="padding-top:4px;padding-bottom:4px;padding-right:12px;'
                f'font-family:{_FONT};font-size:14px;line-height:1.5;color:{_TEXT2};">{html.escape(label)}</td>'
                f'<td valign="top" style="padding-top:4px;padding-bottom:4px;font-family:{_FONT};font-size:14px;'
                f'line-height:1.5;font-weight:600;color:{_TEXT};">{html.escape(value)}</td></tr>'
            )
        parts.append("</table>")
    for item in items:
        parts.append(_p(html.escape(item), size=14, color=_TEXT, bottom=4))
    return "".join(parts)


def _render_document(
    *,
    title: str,
    lead: list[str],
    sections: list[Section],
    closing: list[str],
    button: tuple[str, str] | None = None,
    footer: str = "",
) -> tuple[str, str]:
    """The HTML and plain-text bodies of one email. Every value is escaped here."""
    sections = [section for section in sections if section[1] or section[2]]

    logo_url = f"{settings.TC_FRONTEND_URL.rstrip('/')}/email-logo.png"
    header = (
        '<table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>'
        f'<td valign="middle"><img src="{html.escape(logo_url, quote=True)}" alt="" width="40" height="40" '
        'style="display:block;width:40px;height:40px;border:0;outline:none;text-decoration:none;" /></td>'
        f'<td valign="middle" style="padding-left:10px;font-family:{_FONT};font-size:16px;line-height:1.3;'
        f'font-weight:700;color:{_TEXT};">Tournament Central</td></tr></table>'
    )
    body = [
        _cell(header, top=20, bottom=16),
        _divider(),
    ]
    main = _p(html.escape(title), size=24, color=_TEXT, weight=700, bottom=12)
    main += "".join(_p(html.escape(line), bottom=12) for line in lead)
    if button:
        label, url = button
        main += (
            '<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-top:8px;"><tr>'
            f'<td align="center" bgcolor="{_ACCENT}" style="border-radius:8px;background-color:{_ACCENT};">'
            f'<a href="{html.escape(url, quote=True)}" style="display:inline-block;padding-top:12px;padding-bottom:12px;'
            f'padding-left:22px;padding-right:22px;font-family:{_FONT};font-size:15px;line-height:16px;font-weight:600;'
            f'color:{_ON_ACCENT};text-decoration:none;border-radius:8px;">{html.escape(label)}</a></td></tr></table>'
        )
    body.append(_cell(main, top=24, bottom=24))
    for heading, rows, items in sections:
        body.append(_divider())
        body.append(_cell(_render_section_html(heading, rows, items)))
    if closing:
        body.append(_divider())
        body.append(_cell("".join(_p(html.escape(line), size=14, bottom=8) for line in closing), bottom=16))

    footer_html = _p(html.escape(footer), size=12, bottom=0) if footer else ""
    html_body = (
        '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
        '<meta name="color-scheme" content="light"></head>'
        f'<body bgcolor="{_PAGE}" style="margin:0;padding:0;background-color:{_PAGE};">'
        f'<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" bgcolor="{_PAGE}">'
        '<tr><td align="center" style="padding-top:32px;padding-bottom:32px;padding-left:12px;padding-right:12px;">'
        f'<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" bgcolor="{_CARD}" '
        f'style="max-width:600px;background-color:{_CARD};border-top:1px solid {_BORDER};border-bottom:1px solid {_BORDER};'
        f'border-left:1px solid {_BORDER};border-right:1px solid {_BORDER};border-radius:16px;">'
        + "".join(body)
        + '</table><table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" '
        'style="max-width:600px;"><tr><td align="center" style="padding-top:16px;padding-left:28px;padding-right:28px;">'
        + footer_html
        + "</td></tr></table></td></tr></table></body></html>"
    )

    lines: list[str] = [title, ""]
    for line in lead:
        lines += [line, ""]
    if button:
        lines += [f"{button[0]}: {button[1]}", ""]
    for heading, rows, items in sections:
        lines.append(heading)
        lines += [f"{label}: {value}" for label, value in rows]
        lines += [f"- {item}" for item in items]
        lines.append("")
    for line in closing:
        lines += [line, ""]
    if footer:
        lines += ["--", footer]
    return html_body, "\n".join(lines).strip() + "\n"


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


def _tournament_section(facts: dict[str, str]) -> Section:
    rows = [
        ("Tournament", facts["tournament_name"]),
        ("Date", facts["tournament_dates"]),
        ("Location", facts["tournament_location"]),
        ("Address", facts["tournament_address"]),
        ("Organizer", facts["organizer_name"]),
        ("Organizer email", facts["organizer_email"]),
        ("Organizer phone", facts["organizer_phone"]),
    ]
    return ("Tournament", [(label, value) for label, value in rows if value], [])


def _money_rows(registration: models.TcRegistration, has_side_events: bool) -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    if has_side_events:
        rows.append(("Entry fees", _format_money(registration.subtotal_cents, registration.currency)))
        rows.append(("Side events and fees", _format_money(registration.fees_cents, registration.currency)))
    rows.append(("Total", _format_money(registration.total_cents, registration.currency)))
    return rows


# --- Registration confirmation ---------------------------------------------------------------


def _confirmation_recipients(
    db: Session, registration: models.TcRegistration
) -> list[tuple[str, str, bool]]:
    """(email, first name, is the contact) for everyone on the registration, each email once."""
    people: list[tuple[str | None, str, bool]] = [
        (registration.contact_email, (registration.contact_first_name or "").strip(), True),
    ]
    people += [(bowler.email, (bowler.first_name or "").strip(), False) for bowler in _bowlers(db, registration)]
    seen: set[str] = set()
    recipients: list[tuple[str, str, bool]] = []
    for email, first_name, is_contact in people:
        normalized = _normalize_email(email)
        if normalized and normalized not in seen:
            seen.add(normalized)
            recipients.append((normalized, first_name, is_contact))
    return recipients


def build_registration_confirmations(db: Session, registration: models.TcRegistration) -> list[dict]:
    """One confirmation per person on the registration: the contact and every bowler with an email."""
    tournament = db.get(models.TournamentCentral, registration.tournament_id)
    recipients = _confirmation_recipients(db, registration)
    if tournament is None or not recipients:
        return []

    facts = _tournament_facts(db, tournament)
    status = _STATUS_LABELS.get(registration.status, registration.status.title())
    payment = "Paid" if registration.payment_status == "paid" else registration.payment_status.replace("_", " ").capitalize()
    entries = _entry_lines(db, registration)
    side_events = _side_event_lines(db, registration)
    contact_name = _full_name(registration.contact_first_name, registration.contact_last_name)
    bowler_names = [_full_name(bowler.first_name, bowler.last_name) for bowler in _bowlers(db, registration)]

    if registration.status == "waitlisted":
        state_line = "is on the waitlist. We'll email you if a spot opens."
    elif registration.status == "confirmed":
        state_line = "is confirmed."
    else:
        state_line = "was received. The organizer will confirm it soon."

    sections: list[Section] = [
        _tournament_section(facts),
        ("Registration", [(label, value) for label, value in (
            ("Confirmation code", registration.confirmation_code),
            ("Status", status),
            ("Payment", payment),
            ("Registered by", contact_name),
        ) if value], []),
        ("Bowlers", [], [name for name in bowler_names if name]),
        ("Entries", [], entries),
        ("Side events and fees", [], side_events),
        ("Fees", _money_rows(registration, bool(side_events)), []),
    ]
    closing = [line for line in (
        "Keep this email. You'll need your confirmation code if you contact the organizer.",
        _organizer_line(facts),
    ) if line]
    variables = {
        **facts,
        "confirmation_code": registration.confirmation_code,
        "status": status,
        "payment_status": payment,
        "registered_by": contact_name,
        "bowlers": "\n".join(bowler_names),
        "total": _format_money(registration.total_cents, registration.currency),
        "entries": "\n".join(entries),
        "side_events": "\n".join(side_events),
    }
    template_id = settings.TC_REGISTRATION_CONFIRMATION_TEMPLATE_ID.strip()

    messages: list[dict] = []
    for email, first_name, is_contact in recipients:
        if is_contact:
            lead = f"Your registration for {tournament.name} {state_line}"
        else:
            registrant = contact_name or "Someone"
            lead = f"{registrant} registered you for {tournament.name}. The registration {state_line}"
        greeting = f"Hi {first_name}," if first_name else ""
        html_body, text = _render_document(
            title=f"Registration {'confirmed' if registration.status == 'confirmed' else 'received'}",
            lead=[line for line in (greeting, lead) if line],
            sections=sections,
            closing=closing,
            button=("View tournament", facts["tournament_url"]),
            footer=f"You're getting this because you're on a registration for {tournament.name}.",
        )
        message = _base_message(email, f"Registration received: {tournament.name}", facts)
        messages.append(_with_body(
            message,
            template_id=template_id,
            variables={**variables, "first_name": first_name, "lead": lead},
            text=text,
            html_body=html_body,
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
    """Where new-registration emails go, or None when the organizer has them turned off.

    Read from the saved setup, not the published one, so turning them on or off takes effect at once.
    The address is the one set for notifications, else the tournament's contact email, else the
    owner's account email.
    """
    details = _setup_payload(db, tournament.id).get("details")
    details = details if isinstance(details, dict) else {}
    if details.get("registrationNotifications") is not True:
        return None
    owner = db.get(models.User, tournament.user_id)
    return (
        _normalize_email(_text(details.get("registrationNotificationEmail")))
        or _normalize_email(_text(details.get("supportEmail")))
        or _normalize_email(owner.email if owner else None)
    )


def build_organizer_registration_notice(db: Session, registration: models.TcRegistration) -> dict | None:
    """The organizer's email about a new registration, or None when notices are off."""
    tournament = db.get(models.TournamentCentral, registration.tournament_id)
    if tournament is None:
        return None
    recipient = organizer_notice_recipient(db, tournament)
    if not recipient:
        return None

    facts = _tournament_facts(db, tournament)
    status = _STATUS_LABELS.get(registration.status, registration.status.title())
    payment = "Paid" if registration.payment_status == "paid" else registration.payment_status.replace("_", " ").capitalize()
    contact_name = _full_name(registration.contact_first_name, registration.contact_last_name)
    contact_email = _normalize_email(registration.contact_email) or (registration.contact_email or "").strip()
    bowlers = [
        " ".join(part for part in (
            _full_name(bowler.first_name, bowler.last_name),
            f"({bowler.email.strip()})" if (bowler.email or "").strip() else "",
        ) if part)
        for bowler in _bowlers(db, registration)
    ]
    entries = _entry_lines(db, registration)
    side_events = _side_event_lines(db, registration)
    notes = (registration.notes or "").strip()

    html_body, text = _render_document(
        title="New registration",
        lead=[f"{contact_name or 'Someone'} registered for {tournament.name}."],
        sections=[
            ("Registration", [(label, value) for label, value in (
                ("Confirmation code", registration.confirmation_code),
                ("Status", status),
                ("Payment", payment),
            ) if value], []),
            ("Contact", [(label, value) for label, value in (
                ("Name", contact_name),
                ("Email", contact_email),
                ("Phone", (registration.contact_phone or "").strip()),
            ) if value], []),
            ("Bowlers", [], [line for line in bowlers if line]),
            ("Entries", [], entries),
            ("Side events and fees", [], side_events),
            ("Fees", _money_rows(registration, bool(side_events)), []),
            ("Notes", [], [notes] if notes else []),
        ],
        closing=["Reply to this email to reach the person who registered."] if contact_email else [],
        button=("View registrations", organizer_registrations_url(tournament.id)),
        footer=(
            f"You're getting this because new-registration emails are on for {tournament.name}. "
            "Turn them off in the tournament's setup, under Registration emails."
        ),
    )
    message: dict = {
        "from": _from_address(),
        "to": [recipient],
        "subject": _clean_subject(f"New registration: {contact_name or registration.confirmation_code} - {tournament.name}"),
        "text": text,
        "html": html_body,
    }
    if _normalize_email(registration.contact_email):
        message["reply_to"] = _normalize_email(registration.contact_email)
    return message


# --- Waitlist promotion ----------------------------------------------------------------------


def send_waitlist_promotion(db: Session, registration: models.TcRegistration) -> bool:
    """Tell everyone on the registration that a spot opened. True when at least one email was sent."""
    tournament = db.get(models.TournamentCentral, registration.tournament_id)
    recipients = registration_emails(db, registration)
    if tournament is None or not recipients:
        return False

    facts = _tournament_facts(db, tournament)
    entries = _entry_lines(db, registration)
    html_body, text = _render_document(
        title="You're off the waitlist",
        lead=[f"Good news: a spot opened up and you're now confirmed for {tournament.name}."],
        sections=[
            _tournament_section(facts),
            ("Registration", [("Confirmation code", registration.confirmation_code), ("Status", "Confirmed")], []),
            ("Entries", [], entries),
        ],
        closing=[line for line in (_organizer_line(facts),) if line],
        button=("View tournament", facts["tournament_url"]),
        footer=f"You're getting this because you're on a registration for {tournament.name}.",
    )
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
