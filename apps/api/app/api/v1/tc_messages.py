"""Organizer emails to bowlers: bulk messages, resent confirmations, and waitlist promotion."""

import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from ...api import deps
from ...core import models
from ...core.config import settings
from ...services import tc_emails
from ...services.tournament_access import require_tc_tournament_permission

logger = logging.getLogger(__name__)
router = APIRouter()


class MessageAudienceRequest(BaseModel):
    audience: Literal["all", "squad", "unpaid", "waitlisted"]
    squad_config_id: str | None = Field(default=None, max_length=120)


class MessageSendRequest(MessageAudienceRequest):
    subject: str = Field(min_length=1, max_length=150)
    body: str = Field(min_length=1, max_length=5000)

    @field_validator("subject", "body")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Cannot be blank")
        return value


class PromoteRequest(BaseModel):
    notify: bool = True


def _resolve_recipients(db: Session, tournament_id: int, payload: MessageAudienceRequest) -> list[str]:
    squad_config_id = (payload.squad_config_id or "").strip() or None
    if payload.audience == "squad" and not squad_config_id:
        raise HTTPException(status_code=400, detail="Choose a squad.")
    return tc_emails.resolve_audience_emails(db, tournament_id, payload.audience, squad_config_id)


def _get_registration(db: Session, tournament_id: int, registration_id: int) -> models.TcRegistration:
    registration = db.query(models.TcRegistration).filter(
        models.TcRegistration.id == registration_id,
        models.TcRegistration.tournament_id == tournament_id,
    ).first()
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")
    return registration


@router.post("/{tournament_id}/messages/preview")
def preview_tournament_message(
    tournament_id: int,
    payload: MessageAudienceRequest,
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    tournament = require_tc_tournament_permission(db, tournament_id, user, "manage_entries")
    recipients = _resolve_recipients(db, tournament.id, payload)
    return {"recipient_count": len(recipients), "max_recipients": settings.TC_MESSAGE_MAX_RECIPIENTS}


@router.post("/{tournament_id}/messages")
def send_tournament_message(
    tournament_id: int,
    payload: MessageSendRequest,
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    tournament = require_tc_tournament_permission(db, tournament_id, user, "manage_entries")
    recipients = _resolve_recipients(db, tournament.id, payload)
    if not recipients:
        raise HTTPException(status_code=400, detail="No one with an email address matches this audience.")
    limit = settings.TC_MESSAGE_MAX_RECIPIENTS
    if len(recipients) > limit:
        raise HTTPException(
            status_code=400,
            detail=f"This message would go to {len(recipients)} people. You can send to {limit} at a time, so choose a smaller audience.",
        )

    sent, failed = tc_emails.send_organizer_message(
        db, tournament, recipients, subject=payload.subject, body=payload.body,
    )
    # No TC audit table exists yet, so the send is recorded in the application log.
    logger.info(
        "Organizer message sent",
        extra={
            "tournament_id": tournament.id,
            "user_id": user.id,
            "audience": payload.audience,
            "squad_config_id": payload.squad_config_id,
            "subject": payload.subject,
            "sent": sent,
            "failed": failed,
        },
    )
    return {"sent": sent, "failed": failed}


@router.post("/{tournament_id}/registrations/{registration_id}/resend-confirmation")
def resend_registration_confirmation(
    tournament_id: int,
    registration_id: int,
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    tournament = require_tc_tournament_permission(db, tournament_id, user, "manage_entries")
    registration = _get_registration(db, tournament.id, registration_id)
    return {"sent": tc_emails.send_registration_confirmation(db, registration)}


@router.post("/{tournament_id}/registrations/{registration_id}/promote")
def promote_waitlisted_registration(
    tournament_id: int,
    registration_id: int,
    payload: PromoteRequest,
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    tournament = require_tc_tournament_permission(db, tournament_id, user, "manage_entries")
    registration = _get_registration(db, tournament.id, registration_id)
    if registration.status != "waitlisted":
        raise HTTPException(status_code=409, detail="Only waitlisted registrations can be moved off the waitlist.")

    registration.status = "confirmed"
    entries = (
        db.query(models.TcEntry)
        .filter(models.TcEntry.registration_id == registration.id)
        .order_by(models.TcEntry.id.asc())
        .all()
    )
    for entry in entries:
        if entry.status == "waitlisted":
            entry.status = "confirmed"
    db.commit()
    db.refresh(registration)

    notified = False
    if payload.notify:
        try:
            notified = tc_emails.send_waitlist_promotion(db, registration)
        except Exception:
            # The promotion is saved; a failed email must not undo or hide it.
            logger.exception("Could not send waitlist promotion email", extra={"registration_id": registration.id})
    return {
        "ok": True,
        "registration_id": registration.id,
        "confirmation_code": registration.confirmation_code,
        "status": registration.status,
        "payment_status": registration.payment_status,
        "entries": [{"id": entry.id, "status": entry.status} for entry in entries],
        "notified": notified,
    }
