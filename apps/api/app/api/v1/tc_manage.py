"""Bowlers manage their own registration from the link in their confirmation email.

Until the tournament's change cutoff, anyone on a registration can use their link to change bowler
details, swap a bowler for someone else, move to another squad, change side events, or cancel.
After the cutoff the page is read-only and only the organizer can make changes. Every saved change
is recorded and emailed to everyone on the registration and to the organizer.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..deps import get_db
from ...core import models
from ...middleware.rate_limit import rate_limiter
from ...services import tc_emails, tc_manage_links, tc_registration_changes
from ...services.tc_waitlist import promote_from_waitlist, send_promotion_emails
from .public import (
    PublicRegistrationSubmissionForm,
    _clean_email,
    _clean_text,
    _is_question_answered,
    prepare_registration,
)
from ...services.tc_eligibility import normalize_gender

logger = logging.getLogger(__name__)

router = APIRouter()

_LINK_DOESNT_WORK = (
    "This link doesn't work anymore. Ask for a new one with the email address on your registration."
)
_INACTIVE = ("cancelled", "refunded")

# Bowler columns and the registration form field keys they come from.
_BOWLER_FIELDS: tuple[tuple[str, str], ...] = (
    ("first_name", "first_name"),
    ("last_name", "last_name"),
    ("email", "email"),
    ("phone", "phone"),
    ("usbc_number", "usbc_number"),
    ("average", "average"),
    ("date_of_birth", "date_of_birth"),
    ("gender", "gender"),
    ("address", "address"),
    ("city", "city"),
    ("state", "state"),
    ("zip_code", "zip"),
)


class ManageTokenRequest(BaseModel):
    token: str


class ManageUpdateRequest(BaseModel):
    token: str
    form: PublicRegistrationSubmissionForm


class ManageLinksRequest(BaseModel):
    email: str


# --- Helpers -----------------------------------------------------------------------------------


def _resolve(db: Session, token: str) -> tuple[models.TcRegistration, Optional[models.TcRegistrationBowler]]:
    resolved = tc_manage_links.resolve_token(db, token)
    if resolved is None:
        raise HTTPException(status_code=404, detail=_LINK_DOESNT_WORK)
    return resolved


def _tournament(db: Session, registration: models.TcRegistration) -> models.TournamentCentral:
    tournament = db.get(models.TournamentCentral, registration.tournament_id)
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")
    return tournament


def _published_state(db: Session, tournament_id: int) -> models.TournamentCentralSetupState:
    state = db.query(models.TournamentCentralSetupState).filter(
        models.TournamentCentralSetupState.tournament_id == tournament_id,
        models.TournamentCentralSetupState.is_published.is_(True),
    ).first()
    if state is None:
        raise HTTPException(status_code=404, detail="Registration setup not available")
    return state


def _entry(db: Session, registration: models.TcRegistration) -> models.TcEntry:
    entry = (
        db.query(models.TcEntry)
        .filter(models.TcEntry.registration_id == registration.id)
        .order_by(models.TcEntry.id.asc())
        .first()
    )
    if entry is None:
        raise HTTPException(status_code=404, detail="Registration not found")
    return entry


def _linked_bowlers(db: Session, entry: models.TcEntry) -> list[tuple[models.TcEntryBowler, models.TcRegistrationBowler]]:
    return (
        db.query(models.TcEntryBowler, models.TcRegistrationBowler)
        .join(models.TcRegistrationBowler, models.TcRegistrationBowler.id == models.TcEntryBowler.bowler_id)
        .filter(models.TcEntryBowler.entry_id == entry.id)
        .order_by(models.TcEntryBowler.position.asc(), models.TcEntryBowler.id.asc())
        .all()
    )


def _viewer_name(registration: models.TcRegistration, bowler: Optional[models.TcRegistrationBowler]) -> str:
    if bowler is not None:
        return tc_emails._full_name(bowler.first_name, bowler.last_name)
    return tc_emails._full_name(registration.contact_first_name, registration.contact_last_name)


def _require_open(db: Session, registration: models.TcRegistration, tournament: models.TournamentCentral) -> None:
    if registration.status in _INACTIVE:
        raise HTTPException(status_code=409, detail="This registration was cancelled. Contact the organizer to register again.")
    if not tc_manage_links.changes_are_open(db, tournament):
        closed = tc_manage_links.format_close(tc_manage_links.changes_close_at(db, tournament))
        raise HTTPException(
            status_code=403,
            detail=f"Changes closed {closed}. Contact the organizer to change your registration." if closed
            else "Changes are closed. Contact the organizer to change your registration.",
        )


def _bowler_field_values(bowler: models.TcRegistrationBowler) -> dict[str, str]:
    values: dict[str, str] = {}
    for column, key in _BOWLER_FIELDS:
        value = getattr(bowler, column)
        if value is not None and str(value).strip():
            values[key] = str(value)
    return values


def _apply_bowler_values(bowler: models.TcRegistrationBowler, values: dict[str, str]) -> None:
    average = str(values.get("average") or "").strip()
    try:
        average_number: Optional[int] = int(average) if average else None
    except ValueError:
        average_number = None
    bowler.first_name = _clean_text(values.get("first_name"))
    bowler.last_name = _clean_text(values.get("last_name"))
    bowler.email = _clean_email(values.get("email")) or None
    bowler.phone = _clean_text(values.get("phone")) or None
    bowler.usbc_number = _clean_text(values.get("usbc_number")) or None
    bowler.average = average_number
    bowler.date_of_birth = _clean_text(values.get("date_of_birth")) or None
    bowler.gender = normalize_gender(values.get("gender"))
    bowler.address = _clean_text(values.get("address")) or None
    bowler.city = _clean_text(values.get("city")) or None
    bowler.state = _clean_text(values.get("state")) or None
    bowler.zip_code = _clean_text(values.get("zip") or values.get("zip_code")) or None


def _is_swap(bowler: models.TcRegistrationBowler, values: dict[str, str]) -> bool:
    """True when the form put someone else in this bowler's spot."""
    old_name = tc_emails._full_name(bowler.first_name, bowler.last_name).casefold()
    new_name = tc_emails._full_name(values.get("first_name"), values.get("last_name")).casefold()
    return old_name != new_name


def _email_changed(old: Optional[str], new: Optional[str]) -> bool:
    return (tc_emails._normalize_email(old) or "") != (tc_emails._normalize_email(_clean_email(new)) or "")


def _manage_payload(
    db: Session,
    registration: models.TcRegistration,
    viewer: Optional[models.TcRegistrationBowler],
    *,
    viewer_removed: bool = False,
) -> dict[str, Any]:
    tournament = _tournament(db, registration)
    facts = tc_emails._tournament_facts(db, tournament)
    entry = _entry(db, registration)
    links = _linked_bowlers(db, entry)
    bowler_index = {bowler.id: index for index, (_, bowler) in enumerate(links)}

    answers: list[dict[str, Any]] = [{} for _ in links]
    for answer in db.query(models.TcRegistrationAnswer).filter(
        models.TcRegistrationAnswer.registration_id == registration.id,
    ).order_by(models.TcRegistrationAnswer.id.asc()).all():
        index = bowler_index.get(answer.bowler_id, 0)
        if index < len(answers):
            value = answer.answer_json.get("value") if isinstance(answer.answer_json, dict) else None
            if _is_question_answered(value):
                answers[index][answer.question_config_id] = value

    side_events = [
        {
            "feeId": row.fee_config_id,
            "bowlerIndex": bowler_index.get(row.bowler_id) if row.bowler_id is not None else None,
            "quantity": row.quantity,
        }
        for row in db.query(models.TcRegistrationSideEvent).filter(
            models.TcRegistrationSideEvent.registration_id == registration.id,
        ).order_by(models.TcRegistrationSideEvent.id.asc()).all()
    ]

    closes = tc_manage_links.changes_close_at(db, tournament)
    open_for_changes = registration.status not in _INACTIVE and tc_manage_links.changes_are_open(db, tournament)
    token = ""
    if not viewer_removed:
        token = tc_manage_links.manage_token(registration, viewer)
    return {
        "token": token,
        "viewer": {
            "name": "" if viewer_removed else _viewer_name(registration, viewer),
            "removed": viewer_removed,
        },
        "tournament": {
            "id": tournament.id,
            "name": tournament.name,
            "dates": facts["tournament_dates"],
            "location": facts["tournament_location"],
            "url": facts["tournament_url"],
        },
        "organizer": {
            "name": facts["organizer_name"],
            "email": facts["organizer_email"],
            "phone": facts["organizer_phone"],
        },
        "can_edit": open_for_changes and not viewer_removed,
        "changes_close_at": tc_manage_links.format_close(closes),
        "registration": {
            "confirmation_code": registration.confirmation_code,
            "status": registration.status,
            "subtotal_cents": registration.subtotal_cents,
            "fees_cents": registration.fees_cents,
            "total_cents": registration.total_cents,
            "squad_name": (entry.squad_name_snapshot or "").strip(),
            "event_name": (entry.event_name_snapshot or "").strip(),
            "division_name": (entry.division_name_snapshot or "").strip(),
        },
        "form": {
            "eventId": entry.event_config_id,
            "divisionId": entry.division_config_id or "",
            "squadId": entry.squad_config_id or "",
            "notes": registration.notes or "",
            "bowlers": [_bowler_field_values(bowler) for _, bowler in links],
            "bowlerQuestionAnswers": answers,
            "sideEvents": side_events,
        },
    }


def _queue_emails(background_tasks: BackgroundTasks, emails: list[dict]) -> None:
    if emails:
        background_tasks.add_task(tc_registration_changes.send_all, emails)


# --- Endpoints ---------------------------------------------------------------------------------


@router.get("/manage")
def get_managed_registration(token: str, db: Session = Depends(get_db)):
    """The registration a Manage registration link opens, with the form filled in."""
    registration, viewer = _resolve(db, token)
    return _manage_payload(db, registration, viewer)


@router.put("/manage")
def update_managed_registration(
    payload: ManageUpdateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Save a bowler's changes. Runs every registration rule again, then emails everyone."""
    registration, viewer = _resolve(db, payload.token)
    tournament = _tournament(db, registration)
    _require_open(db, registration, tournament)
    state = _published_state(db, tournament.id)
    entry = _entry(db, registration)

    form = payload.form
    if (form.eventId or "") != (entry.event_config_id or ""):
        raise HTTPException(status_code=400, detail="Only the organizer can move a registration to a different event.")
    # Bowlers can't use staff overrides, and they accepted the terms when they registered.
    form.override_eligibility = False
    form.acceptTerms = True

    before = tc_registration_changes.snapshot(db, registration)
    old_squad_id = entry.squad_config_id
    old_status = registration.status
    actor_name = _viewer_name(registration, viewer)

    prepared = prepare_registration(
        db, tournament, state, form, existing_entry=entry, existing_status=registration.status,
    )

    # Bowlers, in their spots on the entry. Someone new in a spot gets a new link; the old one stops working.
    links = _linked_bowlers(db, entry)
    bowler_records: list[models.TcRegistrationBowler] = []
    viewer_removed = False
    for index, values in enumerate(prepared.bowlers):
        if index < len(links):
            _, bowler = links[index]
            swapped = _is_swap(bowler, values)
            if swapped or _email_changed(bowler.email, values.get("email")):
                # Old links stop working. Someone fixing their own email gets a new link back below.
                bowler.manage_key = tc_manage_links.new_manage_key()
            if swapped:
                bowler.user_id = None
                bowler.checked_in_at = None
                bowler.checked_in_by_user_id = None
                if viewer is not None and viewer.id == bowler.id:
                    viewer_removed = True
            _apply_bowler_values(bowler, values)
        else:
            bowler = models.TcRegistrationBowler(
                registration_id=registration.id, tournament_id=tournament.id, first_name="", last_name="",
            )
            _apply_bowler_values(bowler, values)
            db.add(bowler)
            db.flush()
            db.add(models.TcEntryBowler(entry_id=entry.id, bowler_id=bowler.id, position=index + 1))
        bowler_records.append(bowler)
    for link, bowler in links[len(prepared.bowlers):]:
        if viewer is not None and viewer.id == bowler.id:
            viewer_removed = True
        db.query(models.TcRegistrationAnswer).filter(models.TcRegistrationAnswer.bowler_id == bowler.id).delete(synchronize_session=False)
        db.query(models.TcRegistrationSideEvent).filter(models.TcRegistrationSideEvent.bowler_id == bowler.id).delete(synchronize_session=False)
        db.delete(link)
        db.flush()
        db.delete(bowler)

    # The contact is the first bowler, as on the sign-up form. A new contact email cancels the old link.
    new_contact_email = _clean_email(form.email)
    old_contact_name = tc_emails._full_name(registration.contact_first_name, registration.contact_last_name).casefold()
    new_contact_name = tc_emails._full_name(form.firstName, form.lastName).casefold()
    contact_swapped = bool(new_contact_name) and new_contact_name != old_contact_name
    if contact_swapped or _email_changed(registration.contact_email, new_contact_email):
        registration.manage_key = tc_manage_links.new_manage_key()
    if viewer is None and contact_swapped:
        viewer_removed = True
    registration.contact_first_name = _clean_text(form.firstName) or registration.contact_first_name
    registration.contact_last_name = _clean_text(form.lastName) or registration.contact_last_name
    registration.contact_email = new_contact_email or registration.contact_email
    registration.contact_phone = _clean_text(form.phone) or None
    registration.notes = _clean_text(form.notes) or None
    registration.status = prepared.status
    registration.subtotal_cents = prepared.subtotal_cents
    registration.fees_cents = prepared.fees_cents
    registration.total_cents = prepared.total_cents
    registration.updated_at = datetime.now(timezone.utc)

    entry.division_config_id = form.divisionId or None
    entry.division_name_snapshot = _clean_text(prepared.division.get("name")) if prepared.division else None
    entry.squad_config_id = form.squadId or None
    entry.squad_name_snapshot = _clean_text(prepared.squad.get("name")) if prepared.squad else None
    entry.squad_date_snapshot = _clean_text(prepared.squad.get("dateIso")) if prepared.squad else None
    entry.squad_time_snapshot = _clean_text(prepared.squad.get("startTime")) if prepared.squad else None
    entry.status = prepared.status
    entry.entry_fee_cents = prepared.subtotal_cents

    # Answers and side events are saved again from the form.
    db.query(models.TcRegistrationAnswer).filter(
        models.TcRegistrationAnswer.registration_id == registration.id,
    ).delete(synchronize_session=False)
    question_labels = {
        str(question.get("id") or ""): _clean_text(question.get("label"))
        for question in prepared.questions
        if str(question.get("id") or "").strip()
    }
    for index, answer_set in enumerate(prepared.answers):
        bowler = bowler_records[min(index, len(bowler_records) - 1)] if bowler_records else None
        for question_id, value in answer_set.items():
            if not _is_question_answered(value):
                continue
            db.add(models.TcRegistrationAnswer(
                registration_id=registration.id,
                entry_id=entry.id,
                bowler_id=bowler.id if bowler else None,
                question_config_id=question_id,
                question_label_snapshot=question_labels.get(question_id) or question_id,
                answer_json={"value": value},
            ))
    db.query(models.TcRegistrationSideEvent).filter(
        models.TcRegistrationSideEvent.registration_id == registration.id,
    ).delete(synchronize_session=False)
    for line in prepared.side_events:
        index = line.bowler_index
        bowler = bowler_records[index] if index is not None and index < len(bowler_records) else None
        db.add(models.TcRegistrationSideEvent(
            registration_id=registration.id,
            tournament_id=tournament.id,
            bowler_id=bowler.id if bowler else None,
            fee_config_id=line.fee_id,
            name_snapshot=line.name[:255],
            kind=line.kind,
            scoring=line.scoring,
            quantity=line.quantity,
            unit_cents=line.unit_cents,
            total_cents=line.total_cents,
        ))
    db.flush()

    _, emails = tc_registration_changes.record_changes(
        db, registration, before, changed_by="bowler", actor_name=actor_name,
    )

    # Leaving a squad (or its confirmed list) can open a spot for the next person on that waitlist.
    promoted: list = []
    if old_squad_id and old_status == "confirmed" and (old_squad_id != entry.squad_config_id or registration.status != "confirmed"):
        promoted = promote_from_waitlist(db, tournament, old_squad_id)
    db.commit()
    _queue_emails(background_tasks, emails)
    send_promotion_emails(background_tasks, db, promoted)

    db.refresh(registration)
    return _manage_payload(db, registration, viewer if not viewer_removed else None, viewer_removed=viewer_removed)


@router.post("/manage/cancel")
def cancel_managed_registration(
    payload: ManageTokenRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Cancel the whole registration. Frees its spots for the waitlist."""
    registration, viewer = _resolve(db, payload.token)
    tournament = _tournament(db, registration)
    _require_open(db, registration, tournament)
    entry = _entry(db, registration)

    before = tc_registration_changes.snapshot(db, registration)
    was_confirmed = registration.status == "confirmed"
    now = datetime.now(timezone.utc)
    registration.status = "cancelled"
    registration.cancelled_at = now
    registration.updated_at = now
    for row in db.query(models.TcEntry).filter(models.TcEntry.registration_id == registration.id).all():
        row.status = "cancelled"
    db.flush()

    _, emails = tc_registration_changes.record_changes(
        db, registration, before, changed_by="bowler", actor_name=_viewer_name(registration, viewer),
    )
    promoted = promote_from_waitlist(db, tournament, entry.squad_config_id) if was_confirmed and entry.squad_config_id else []
    db.commit()
    _queue_emails(background_tasks, emails)
    send_promotion_emails(background_tasks, db, promoted)

    db.refresh(registration)
    return _manage_payload(db, registration, viewer)


@router.post("/manage-links")
def email_manage_links(
    payload: ManageLinksRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Email someone their Manage registration links. Always answers the same way, so it can't be
    used to find out who is registered."""
    email = tc_emails._normalize_email(payload.email)
    response = {"ok": True}
    if not email:
        return response
    if not rate_limiter.hit(f"tc-manage-links:{email}", limit=3, window_seconds=3600).allowed:
        return response

    contact_ids = [
        row[0] for row in db.query(models.TcRegistration.id).filter(
            models.TcRegistration.contact_email == email,
        ).all()
    ]
    bowler_ids = [
        row[0] for row in db.query(models.TcRegistrationBowler.registration_id).filter(
            models.TcRegistrationBowler.email == email,
        ).all()
    ]
    ids = sorted(set(contact_ids) | set(bowler_ids))
    if not ids:
        return response
    registrations = (
        db.query(models.TcRegistration)
        .filter(models.TcRegistration.id.in_(ids), models.TcRegistration.status.notin_(_INACTIVE))
        .order_by(models.TcRegistration.submitted_at.desc())
        .limit(20)
        .all()
    )
    message = tc_emails.build_manage_links_email(db, email, registrations)
    if message is not None:
        background_tasks.add_task(tc_emails.send_email, message, log_context="tc-manage-links")
    return response
