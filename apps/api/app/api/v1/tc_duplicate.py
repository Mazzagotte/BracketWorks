"""Duplicate a Tournament Central tournament, for organizers who run the same event every year.

The copy keeps the setup (events, divisions, squads, fees, questions, rules), venue, logo, and
documents, moves every date by the same number of days, and starts unpublished with no registrations.
"""

import json
from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...api import deps
from ...core import models
from ...services.tc_setup_validation import PUBLISHED_SNAPSHOT_KEY
from ...services.tournament_access import require_tc_tournament_permission
from .tc_tournaments import _tc_tournament_to_dict

router = APIRouter()

# Date-only fields in the setup payload's details that move with the tournament.
DETAIL_DATE_KEYS = ("startDateIso", "endDateIso", "registrationOpenIso", "registrationCloseIso")


class TcDuplicateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    # New first day (YYYY-MM-DD). Every date in the copy moves by the same number of days.
    start_date: str | None = None
    include_documents: bool = True


def _parse_iso_date(value: Any) -> date | None:
    if not isinstance(value, str) or len(value) < 10:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def _shift(value: Any, days: int) -> Any:
    parsed = _parse_iso_date(value)
    if parsed is None or days == 0:
        return value
    return (parsed + timedelta(days=days)).isoformat() + value[10:]


def _shift_setup_payload(payload: dict, days: int, name: str) -> dict:
    copied = json.loads(json.dumps(payload))
    copied.pop(PUBLISHED_SNAPSHOT_KEY, None)
    details = copied.get("details")
    if isinstance(details, dict):
        for key in DETAIL_DATE_KEYS:
            if key in details:
                details[key] = _shift(details[key], days)
        details["name"] = name
    for squad in copied.get("squads") or []:
        if isinstance(squad, dict) and "dateIso" in squad:
            squad["dateIso"] = _shift(squad["dateIso"], days)
    return copied


def _shift_squad_times(raw: str | None, days: int) -> str:
    try:
        times = json.loads(raw) if raw else {}
    except (TypeError, ValueError):
        times = {}
    if not isinstance(times, dict):
        times = {}
    return json.dumps({_shift(key, days): value for key, value in times.items()})


@router.post("/{tournament_id}/duplicate")
def duplicate_tc_tournament(
    tournament_id: int,
    request: TcDuplicateRequest,
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    source = require_tc_tournament_permission(db, tournament_id, user, "manage_tournament")

    name = request.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Enter a name for the new tournament.")

    days = 0
    if request.start_date:
        new_start = _parse_iso_date(request.start_date)
        if new_start is None:
            raise HTTPException(status_code=400, detail="Start date must be YYYY-MM-DD.")
        old_start = _parse_iso_date(source.start_date)
        if old_start is not None:
            days = (new_start - old_start).days

    copy = models.TournamentCentral(
        user_id=user.id,
        venue_id=source.venue_id,
        name=name,
        location=source.location,
        start_date=_shift(source.start_date, days) if source.start_date else request.start_date,
        end_date=_shift(source.end_date, days) if source.end_date else request.start_date,
        squad_times=_shift_squad_times(source.squad_times, days),
        is_public=False,
        is_published=False,
        logo_blob=source.logo_blob,
        logo_mime_type=source.logo_mime_type,
        logo_file_name=source.logo_file_name,
    )
    db.add(copy)
    db.flush()

    state = db.query(models.TournamentCentralSetupState).filter(
        models.TournamentCentralSetupState.tournament_id == source.id,
    ).first()
    if state is not None and isinstance(state.payload, dict):
        db.add(models.TournamentCentralSetupState(
            tournament_id=copy.id,
            user_id=user.id,
            payload=_shift_setup_payload(state.payload, days, name),
            is_published=False,
        ))

    if request.include_documents:
        documents = db.query(models.TcTournamentDocument).filter(
            models.TcTournamentDocument.tournament_id == source.id,
        ).all()
        for document in documents:
            db.add(models.TcTournamentDocument(
                tournament_id=copy.id,
                user_id=user.id,
                doc_type=document.doc_type,
                file_name=document.file_name,
                mime_type=document.mime_type,
                file_size=document.file_size,
                file_blob=document.file_blob,
            ))

    db.commit()
    db.refresh(copy)
    venue = db.query(models.TcVenue).filter(models.TcVenue.id == copy.venue_id).first() if copy.venue_id else None
    return _tc_tournament_to_dict(copy, venue=venue)
