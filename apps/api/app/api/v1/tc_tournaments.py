import json
import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from ...api import deps
from ...core import models, schemas
from ...services.tc_tournament_documents import (
    build_content_disposition,
    normalize_document_kind,
    read_tournament_document_upload,
    sanitize_document_filename,
    validate_tournament_document_upload,
)
from ...services.tc_tournament_logo import validate_tournament_logo_upload
from ...services.tc_venues import build_tournament_location
from ...services.tournament_access import verify_owned_tc_tournament_access

logger = logging.getLogger(__name__)
router = APIRouter()


class TcRegistrationStatusPatch(BaseModel):
    status: str | None = None
    payment_status: str | None = None


class TcEntryStatusPatch(BaseModel):
    status: str | None = None
    entry_number: int | None = None
    event_config_id: str | None = None
    event_name_snapshot: str | None = None
    division_config_id: str | None = None
    division_name_snapshot: str | None = None
    squad_config_id: str | None = None
    squad_name_snapshot: str | None = None
    squad_date_snapshot: str | None = None
    squad_time_snapshot: str | None = None
    entry_fee_cents: int | None = None
    contact_first_name: str | None = None
    contact_last_name: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    notes: str | None = None
    bowlers: list[dict] | None = None


def _serialize_venue(venue: models.TcVenue | None) -> dict | None:
    if venue is None:
        return None

    return schemas.TcVenue.model_validate(venue).model_dump(mode="json")


def _tc_tournament_to_dict(
    tournament: models.TournamentCentral,
    entry_count: int = 0,
    venue: models.TcVenue | None = None,
) -> dict:
    tournament_dict = tournament.__dict__.copy()
    if tournament.squad_times:
        tournament_dict["squad_times"] = json.loads(tournament.squad_times)
    else:
        tournament_dict["squad_times"] = {}

    # Keep compatibility with existing TournamentSummary consumers.
    tournament_dict["entry_count"] = max(entry_count, 0)
    tournament_dict["brackets_configured"] = False
    tournament_dict["has_logo"] = bool(tournament.logo_blob)
    tournament_dict["logo_file_name"] = tournament.logo_file_name
    tournament_dict["logo_mime_type"] = tournament.logo_mime_type
    tournament_dict["venue"] = _serialize_venue(venue)
    return tournament_dict


@router.post("", response_model=schemas.Tournament)
@router.post("/", response_model=schemas.Tournament)
def create_tournament(
    tournament: schemas.TournamentCreate,
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    try:
        venue = None
        if tournament.venue_id is not None:
            venue = db.query(models.TcVenue).filter(models.TcVenue.id == tournament.venue_id).first()
            if venue is None:
                raise HTTPException(status_code=404, detail="Venue not found")

        location = build_tournament_location(venue) if venue else tournament.location

        db_tournament = models.TournamentCentral(
            name=tournament.name,
            venue_id=(venue.id if venue else None),
            location=location,
            start_date=tournament.start_date,
            end_date=tournament.end_date,
            squad_times=json.dumps(tournament.squad_times),
            is_public=tournament.is_public,
            user_id=user.id,
        )
        db.add(db_tournament)
        db.commit()
        db.refresh(db_tournament)
        return _tc_tournament_to_dict(db_tournament, venue=venue)
    except Exception as error:
        db.rollback()
        logger.error(f"Error creating TC tournament: {error}")
        raise HTTPException(status_code=500, detail="Failed to create tournament")


@router.get("", response_model=list[schemas.Tournament])
@router.get("/", response_model=list[schemas.Tournament])
def list_tournaments(
    limit: int | None = Query(default=None, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    query = db.query(models.TournamentCentral).order_by(models.TournamentCentral.id.desc())

    if not getattr(user, "is_admin", False):
        query = query.filter(models.TournamentCentral.user_id == user.id)

    if offset:
        query = query.offset(offset)
    if limit is not None:
        query = query.limit(limit)

    tournaments = query.all()
    tournament_ids = [row.id for row in tournaments]
    venue_ids = [row.venue_id for row in tournaments if row.venue_id is not None]
    venues_by_id: dict[int, models.TcVenue] = {}
    if venue_ids:
        venues = db.query(models.TcVenue).filter(models.TcVenue.id.in_(venue_ids)).all()
        venues_by_id = {venue.id: venue for venue in venues}

    entry_counts_by_tournament: dict[int, int] = {}
    if tournament_ids:
        entry_counts = (
            db.query(models.TcEntry.tournament_id, func.count(models.TcEntry.id))
            .filter(
                models.TcEntry.tournament_id.in_(tournament_ids),
                models.TcEntry.status.in_(("pending", "confirmed", "waitlisted")),
            )
            .group_by(models.TcEntry.tournament_id)
            .all()
        )
        entry_counts_by_tournament = {int(tid): int(count) for tid, count in entry_counts}

    return [
        _tc_tournament_to_dict(
            tournament,
            entry_count=entry_counts_by_tournament.get(tournament.id, 0),
            venue=venues_by_id.get(tournament.venue_id or -1),
        )
        for tournament in tournaments
    ]


@router.get("/{tournament_id}", response_model=schemas.Tournament)
def get_tournament(
    tournament_id: int,
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    tournament = verify_owned_tc_tournament_access(db, tournament_id, user)
    entry_count = int(
        db.query(func.count(models.TcEntry.id))
        .filter(
            models.TcEntry.tournament_id == tournament_id,
            models.TcEntry.status.in_(("pending", "confirmed", "waitlisted")),
        )
        .scalar()
        or 0
    )
    venue = None
    if tournament.venue_id is not None:
        venue = db.query(models.TcVenue).filter(models.TcVenue.id == tournament.venue_id).first()
    return _tc_tournament_to_dict(tournament, entry_count=entry_count, venue=venue)


@router.put("/{tournament_id}", response_model=schemas.Tournament)
def update_tournament(
    tournament_id: int,
    tournament: schemas.TournamentUpdate,
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    try:
        db_tournament = verify_owned_tc_tournament_access(db, tournament_id, user)
        venue = None
        venue_id_was_sent = "venue_id" in tournament.model_fields_set

        if venue_id_was_sent and tournament.venue_id is not None:
            venue = db.query(models.TcVenue).filter(models.TcVenue.id == tournament.venue_id).first()
            if venue is None:
                raise HTTPException(status_code=404, detail="Venue not found")
            db_tournament.venue_id = venue.id
            db_tournament.location = build_tournament_location(venue)
        elif venue_id_was_sent and tournament.venue_id is None:
            db_tournament.venue_id = None

        db_tournament.name = tournament.name
        if tournament.location is not None and not (venue_id_was_sent and tournament.venue_id is not None):
            db_tournament.location = tournament.location
        if tournament.start_date is not None:
            db_tournament.start_date = tournament.start_date
        if tournament.end_date is not None:
            db_tournament.end_date = tournament.end_date
        db_tournament.squad_times = json.dumps(tournament.squad_times)
        if tournament.is_public is not None:
            db_tournament.is_public = tournament.is_public

        db.commit()
        db.refresh(db_tournament)
        entry_count = int(
            db.query(func.count(models.TcEntry.id))
            .filter(
                models.TcEntry.tournament_id == tournament_id,
                models.TcEntry.status.in_(("pending", "confirmed", "waitlisted")),
            )
            .scalar()
            or 0
        )
        if db_tournament.venue_id is not None and venue is None:
            venue = db.query(models.TcVenue).filter(models.TcVenue.id == db_tournament.venue_id).first()
        return _tc_tournament_to_dict(db_tournament, entry_count=entry_count, venue=venue)
    except HTTPException:
        raise
    except Exception as error:
        db.rollback()
        logger.error(f"Error updating TC tournament {tournament_id}: {error}")
        raise HTTPException(status_code=500, detail="Failed to update tournament")


@router.post("/{tournament_id}/logo")
async def upload_tournament_logo(
    tournament_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    tournament = verify_owned_tc_tournament_access(db, tournament_id, user)

    content = await file.read()
    validate_tournament_logo_upload(file.content_type, content)

    try:
        tournament.logo_blob = content
        tournament.logo_mime_type = file.content_type or "application/octet-stream"
        tournament.logo_file_name = file.filename or "logo"
        db.commit()
        db.refresh(tournament)
    except Exception as error:
        db.rollback()
        logger.error(f"Error uploading logo for TC tournament {tournament_id}: {error}")
        raise HTTPException(status_code=500, detail="Failed to upload tournament logo")

    return {
        "ok": True,
        "tournament_id": tournament.id,
        "logo_file_name": tournament.logo_file_name,
        "logo_mime_type": tournament.logo_mime_type,
    }


@router.get("/{tournament_id}/logo")
def get_tournament_logo(
    tournament_id: int,
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    tournament = verify_owned_tc_tournament_access(db, tournament_id, user)
    if not tournament.logo_blob:
        raise HTTPException(status_code=404, detail="Tournament logo not found")

    headers = {}
    if tournament.logo_file_name:
        headers["Content-Disposition"] = f'inline; filename="{tournament.logo_file_name}"'

    return Response(
        content=tournament.logo_blob,
        media_type=tournament.logo_mime_type or "application/octet-stream",
        headers=headers,
    )


@router.delete("/{tournament_id}/logo")
def delete_tournament_logo(
    tournament_id: int,
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    tournament = verify_owned_tc_tournament_access(db, tournament_id, user)

    try:
        tournament.logo_blob = None
        tournament.logo_mime_type = None
        tournament.logo_file_name = None
        db.commit()
    except Exception as error:
        db.rollback()
        logger.error(f"Error deleting logo for TC tournament {tournament_id}: {error}")
        raise HTTPException(status_code=500, detail="Failed to delete tournament logo")

    return {"ok": True}


def _serialize_document(document: models.TcTournamentDocument) -> dict:
    return {
        "id": document.id,
        "tournament_id": document.tournament_id,
        "doc_type": document.doc_type,
        "file_name": document.file_name,
        "mime_type": document.mime_type,
        "file_size": document.file_size,
        "uploaded_at": document.uploaded_at.isoformat(),
    }


@router.get("/{tournament_id}/documents")
def list_tournament_documents(
    tournament_id: int,
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    verify_owned_tc_tournament_access(db, tournament_id, user)

    documents = (
        db.query(models.TcTournamentDocument)
        .filter(models.TcTournamentDocument.tournament_id == tournament_id)
        .order_by(models.TcTournamentDocument.uploaded_at.desc())
        .all()
    )
    return [_serialize_document(document) for document in documents]


@router.post("/{tournament_id}/documents")
async def upload_tournament_document(
    tournament_id: int,
    file: UploadFile = File(...),
    doc_type: str = Form("other"),
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    verify_owned_tc_tournament_access(db, tournament_id, user)

    content = await read_tournament_document_upload(file)
    mime_type = validate_tournament_document_upload(file.content_type, content)

    document = models.TcTournamentDocument(
        tournament_id=tournament_id,
        user_id=user.id,
        doc_type=normalize_document_kind(doc_type),
        file_name=sanitize_document_filename(file.filename),
        mime_type=mime_type,
        file_size=len(content),
        file_blob=content,
    )

    try:
        db.add(document)
        db.commit()
        db.refresh(document)
    except Exception as error:
        db.rollback()
        logger.error(f"Error uploading document for TC tournament {tournament_id}: {error}")
        raise HTTPException(status_code=500, detail="Failed to upload document")

    return _serialize_document(document)


@router.get("/{tournament_id}/documents/{document_id}/download")
def download_tournament_document(
    tournament_id: int,
    document_id: int,
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    verify_owned_tc_tournament_access(db, tournament_id, user)

    document = (
        db.query(models.TcTournamentDocument)
        .filter(
            models.TcTournamentDocument.id == document_id,
            models.TcTournamentDocument.tournament_id == tournament_id,
        )
        .one_or_none()
    )
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")

    headers = {"Content-Disposition": build_content_disposition(document.file_name)}
    return Response(content=document.file_blob, media_type=document.mime_type, headers=headers)


@router.delete("/{tournament_id}/documents/{document_id}")
def delete_tournament_document(
    tournament_id: int,
    document_id: int,
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    verify_owned_tc_tournament_access(db, tournament_id, user)

    document = (
        db.query(models.TcTournamentDocument)
        .filter(
            models.TcTournamentDocument.id == document_id,
            models.TcTournamentDocument.tournament_id == tournament_id,
        )
        .one_or_none()
    )
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        db.delete(document)
        db.commit()
    except Exception as error:
        db.rollback()
        logger.error(f"Error deleting document {document_id} for TC tournament {tournament_id}: {error}")
        raise HTTPException(status_code=500, detail="Failed to delete document")

    return {"ok": True}


@router.get("/{tournament_id}/registrations")
def list_tournament_registrations(
    tournament_id: int,
    status: str | None = Query(default=None),
    event_id: str | None = Query(default=None),
    division_id: str | None = Query(default=None),
    squad_id: str | None = Query(default=None),
    q: str | None = Query(default=None),
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    tournament = verify_owned_tc_tournament_access(db, tournament_id, user)

    query = db.query(models.TcRegistration).filter(
        models.TcRegistration.tournament_id == tournament.id,
    )
    if status:
        query = query.filter(models.TcRegistration.status == status.strip().lower())

    if q and q.strip():
        search_text = f"%{q.strip().lower()}%"
        query = query.filter(
            func.lower(models.TcRegistration.contact_first_name + " " + models.TcRegistration.contact_last_name).like(search_text)
            | func.lower(models.TcRegistration.contact_email).like(search_text)
            | func.lower(models.TcRegistration.confirmation_code).like(search_text)
        )

    registrations = query.order_by(
        models.TcRegistration.submitted_at.desc(),
        models.TcRegistration.id.desc(),
    ).all()

    registration_ids = [row.id for row in registrations]
    entries_by_registration: dict[int, list[models.TcEntry]] = {row.id: [] for row in registrations}
    if registration_ids:
        entries_query = db.query(models.TcEntry).filter(models.TcEntry.registration_id.in_(registration_ids))
        if event_id:
            entries_query = entries_query.filter(models.TcEntry.event_config_id == event_id)
        if division_id:
            entries_query = entries_query.filter(models.TcEntry.division_config_id == division_id)
        if squad_id:
            entries_query = entries_query.filter(models.TcEntry.squad_config_id == squad_id)

        for entry in entries_query.order_by(models.TcEntry.id.asc()).all():
            entries_by_registration.setdefault(entry.registration_id, []).append(entry)

    rows = []
    for registration in registrations:
        registration_entries = entries_by_registration.get(registration.id, [])
        if (event_id or division_id or squad_id) and not registration_entries:
            continue

        rows.append(
            {
                "id": registration.id,
                "confirmation_code": registration.confirmation_code,
                "status": registration.status,
                "payment_status": registration.payment_status,
                "contact_first_name": registration.contact_first_name,
                "contact_last_name": registration.contact_last_name,
                "contact_email": registration.contact_email,
                "contact_phone": registration.contact_phone,
                "notes": registration.notes,
                "submitted_at": registration.submitted_at.isoformat() if registration.submitted_at else None,
                "total_cents": registration.total_cents,
                "currency": registration.currency,
                "entry_count": len(registration_entries),
                "entries": [
                    {
                        "id": entry.id,
                        "event_config_id": entry.event_config_id,
                        "event_name": entry.event_name_snapshot,
                        "division_config_id": entry.division_config_id,
                        "division_name": entry.division_name_snapshot,
                        "squad_config_id": entry.squad_config_id,
                        "squad_name": entry.squad_name_snapshot,
                        "squad_date": entry.squad_date_snapshot,
                        "squad_time": entry.squad_time_snapshot,
                        "status": entry.status,
                        "entry_number": entry.entry_number,
                        "entry_fee_cents": entry.entry_fee_cents,
                        "bowlers": [
                            {
                                "id": bowler.id,
                                "first_name": bowler.first_name,
                                "last_name": bowler.last_name,
                                "email": bowler.email,
                                "phone": bowler.phone,
                                "usbc_number": bowler.usbc_number,
                                "average": bowler.average,
                            }
                            for _, bowler in db.query(models.TcEntryBowler, models.TcRegistrationBowler)
                            .join(models.TcRegistrationBowler, models.TcRegistrationBowler.id == models.TcEntryBowler.bowler_id)
                            .filter(models.TcEntryBowler.entry_id == entry.id)
                            .order_by(models.TcEntryBowler.position.asc())
                            .all()
                        ],
                        "bowler_count": int(
                            db.query(func.count(models.TcEntryBowler.id))
                            .filter(models.TcEntryBowler.entry_id == entry.id)
                            .scalar()
                            or 0
                        ),
                    }
                    for entry in registration_entries
                ],
            }
        )

    return {
        "tournament_id": tournament.id,
        "registrations": rows,
    }


@router.get("/{tournament_id}/entries")
def list_tournament_entries(
    tournament_id: int,
    status: str | None = Query(default=None),
    event_id: str | None = Query(default=None),
    division_id: str | None = Query(default=None),
    squad_id: str | None = Query(default=None),
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    tournament = verify_owned_tc_tournament_access(db, tournament_id, user)

    query = db.query(models.TcEntry).filter(models.TcEntry.tournament_id == tournament.id)
    if status:
        query = query.filter(models.TcEntry.status == status.strip().lower())
    if event_id:
        query = query.filter(models.TcEntry.event_config_id == event_id)
    if division_id:
        query = query.filter(models.TcEntry.division_config_id == division_id)
    if squad_id:
        query = query.filter(models.TcEntry.squad_config_id == squad_id)

    entries = query.order_by(models.TcEntry.created_at.desc(), models.TcEntry.id.desc()).all()

    return {
        "tournament_id": tournament.id,
        "entries": [
            {
                "id": entry.id,
                "registration_id": entry.registration_id,
                "event_config_id": entry.event_config_id,
                "event_name_snapshot": entry.event_name_snapshot,
                "division_config_id": entry.division_config_id,
                "division_name_snapshot": entry.division_name_snapshot,
                "squad_config_id": entry.squad_config_id,
                "squad_name_snapshot": entry.squad_name_snapshot,
                "status": entry.status,
                "entry_fee_cents": entry.entry_fee_cents,
                "created_at": entry.created_at.isoformat() if entry.created_at else None,
            }
            for entry in entries
        ],
    }


@router.get("/{tournament_id}/entries/{entry_id}")
def get_tournament_entry(
    tournament_id: int,
    entry_id: int,
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    tournament = verify_owned_tc_tournament_access(db, tournament_id, user)
    entry = db.query(models.TcEntry).filter(
        models.TcEntry.id == entry_id,
        models.TcEntry.tournament_id == tournament.id,
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    links = (
        db.query(models.TcEntryBowler, models.TcRegistrationBowler)
        .join(models.TcRegistrationBowler, models.TcRegistrationBowler.id == models.TcEntryBowler.bowler_id)
        .filter(models.TcEntryBowler.entry_id == entry.id)
        .order_by(models.TcEntryBowler.position.asc())
        .all()
    )

    return {
        "tournament_id": tournament.id,
        "entry": {
            "id": entry.id,
            "registration_id": entry.registration_id,
            "event_config_id": entry.event_config_id,
            "event_name_snapshot": entry.event_name_snapshot,
            "division_config_id": entry.division_config_id,
            "division_name_snapshot": entry.division_name_snapshot,
            "squad_config_id": entry.squad_config_id,
            "squad_name_snapshot": entry.squad_name_snapshot,
            "status": entry.status,
            "entry_fee_cents": entry.entry_fee_cents,
            "bowlers": [
                {
                    "id": bowler.id,
                    "first_name": bowler.first_name,
                    "last_name": bowler.last_name,
                    "email": bowler.email,
                    "phone": bowler.phone,
                    "usbc_number": bowler.usbc_number,
                    "average": bowler.average,
                    "position": link.position,
                }
                for link, bowler in links
            ],
        },
    }


@router.patch("/{tournament_id}/registrations/{registration_id}")
def patch_tournament_registration(
    tournament_id: int,
    registration_id: int,
    payload: TcRegistrationStatusPatch,
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    tournament = verify_owned_tc_tournament_access(db, tournament_id, user)
    registration = db.query(models.TcRegistration).filter(
        models.TcRegistration.id == registration_id,
        models.TcRegistration.tournament_id == tournament.id,
    ).first()
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")

    allowed_statuses = {"pending", "confirmed", "waitlisted", "cancelled", "refunded"}
    allowed_payment_statuses = {"unpaid", "paid", "refunded"}
    if payload.status is not None:
        next_status = payload.status.strip().lower()
        if next_status not in allowed_statuses:
            raise HTTPException(status_code=400, detail="Invalid registration status")
        registration.status = next_status
    if payload.payment_status is not None:
        next_payment_status = payload.payment_status.strip().lower()
        if next_payment_status not in allowed_payment_statuses:
            raise HTTPException(status_code=400, detail="Invalid payment status")
        registration.payment_status = next_payment_status
    if payload.status is None and payload.payment_status is None:
        raise HTTPException(status_code=400, detail="No registration changes supplied")

    db.commit()
    db.refresh(registration)
    return {
        "ok": True,
        "registration_id": registration.id,
        "status": registration.status,
        "payment_status": registration.payment_status,
    }


@router.patch("/{tournament_id}/entries/{entry_id}")
def patch_tournament_entry(
    tournament_id: int,
    entry_id: int,
    payload: TcEntryStatusPatch,
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    tournament = verify_owned_tc_tournament_access(db, tournament_id, user)
    entry = db.query(models.TcEntry).filter(
        models.TcEntry.id == entry_id,
        models.TcEntry.tournament_id == tournament.id,
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    allowed_statuses = {"pending", "confirmed", "waitlisted", "cancelled"}
    if payload.status is not None:
        next_status = payload.status.strip().lower()
        if next_status not in allowed_statuses:
            raise HTTPException(status_code=400, detail="Invalid entry status")
        entry.status = next_status
    if payload.entry_number is not None and payload.entry_number < 1:
        raise HTTPException(status_code=400, detail="Entry number must be positive")
    if payload.entry_number is not None:
        entry.entry_number = payload.entry_number
    entry_fields = (
        "event_config_id", "event_name_snapshot", "division_config_id", "division_name_snapshot",
        "squad_config_id", "squad_name_snapshot", "squad_date_snapshot", "squad_time_snapshot",
        "entry_fee_cents",
    )
    for field_name in entry_fields:
        value = getattr(payload, field_name)
        if value is not None:
            if field_name == "entry_fee_cents" and value < 0:
                raise HTTPException(status_code=400, detail="Entry fee cannot be negative")
            setattr(entry, field_name, value.strip() if isinstance(value, str) else value)

    if payload.contact_first_name is not None or payload.contact_last_name is not None or payload.contact_email is not None or payload.contact_phone is not None or payload.notes is not None:
        registration = db.query(models.TcRegistration).filter(
            models.TcRegistration.id == entry.registration_id,
            models.TcRegistration.tournament_id == tournament.id,
        ).first()
        if not registration:
            raise HTTPException(status_code=404, detail="Registration not found")
        if payload.contact_first_name is not None:
            registration.contact_first_name = payload.contact_first_name.strip()
        if payload.contact_last_name is not None:
            registration.contact_last_name = payload.contact_last_name.strip()
        if payload.contact_email is not None:
            registration.contact_email = payload.contact_email.strip().lower()
        if payload.contact_phone is not None:
            registration.contact_phone = payload.contact_phone.strip() or None
        if payload.notes is not None:
            registration.notes = payload.notes.strip() or None

    if payload.bowlers is not None:
        links = db.query(models.TcEntryBowler).filter(
            models.TcEntryBowler.entry_id == entry.id,
        ).order_by(models.TcEntryBowler.position.asc()).all()
        if len(payload.bowlers) != len(links):
            raise HTTPException(status_code=400, detail="The edited entry must keep the same number of bowlers")
        for link, bowler_values in zip(links, payload.bowlers):
            bowler = db.get(models.TcRegistrationBowler, link.bowler_id)
            if not bowler:
                continue
            for field_name in ("first_name", "last_name", "email", "phone", "usbc_number"):
                if field_name in bowler_values:
                    value = str(bowler_values.get(field_name) or "").strip()
                    setattr(bowler, field_name, value.lower() if field_name == "email" else value)
            if "average" in bowler_values:
                average = bowler_values.get("average")
                bowler.average = int(average) if average not in (None, "") else None

    if payload.entry_fee_cents is not None:
        db.flush()
        registration = db.query(models.TcRegistration).filter(
            models.TcRegistration.id == entry.registration_id,
            models.TcRegistration.tournament_id == tournament.id,
        ).first()
        if registration:
            subtotal_cents = int(
                db.query(func.coalesce(func.sum(models.TcEntry.entry_fee_cents), 0))
                .filter(models.TcEntry.registration_id == entry.registration_id)
                .scalar()
                or 0
            )
            registration.subtotal_cents = subtotal_cents
            registration.total_cents = subtotal_cents + registration.fees_cents

    has_changes = payload.status is not None or payload.entry_number is not None or any(
        getattr(payload, field_name) is not None
        for field_name in entry_fields + ("contact_first_name", "contact_last_name", "contact_email", "contact_phone", "notes", "bowlers")
    )
    if not has_changes:
        raise HTTPException(status_code=400, detail="No entry changes supplied")

    db.commit()
    db.refresh(entry)
    return {
        "ok": True,
        "entry_id": entry.id,
        "status": entry.status,
        "entry_number": entry.entry_number,
    }


@router.delete("/{tournament_id}/entries/{entry_id}")
def delete_tournament_entry(
    tournament_id: int,
    entry_id: int,
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    tournament = verify_owned_tc_tournament_access(db, tournament_id, user)
    entry = db.query(models.TcEntry).filter(
        models.TcEntry.id == entry_id,
        models.TcEntry.tournament_id == tournament.id,
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    registration = db.query(models.TcRegistration).filter(
        models.TcRegistration.id == entry.registration_id,
        models.TcRegistration.tournament_id == tournament.id,
    ).first()

    db.query(models.TcEntryBowler).filter(
        models.TcEntryBowler.entry_id == entry.id,
    ).delete(synchronize_session=False)
    db.query(models.TcRegistrationAnswer).filter(
        models.TcRegistrationAnswer.entry_id == entry.id,
    ).delete(synchronize_session=False)
    db.delete(entry)
    db.flush()

    remaining_entries = db.query(func.count(models.TcEntry.id)).filter(
        models.TcEntry.registration_id == entry.registration_id,
    ).scalar() or 0
    if registration and remaining_entries == 0:
        db.query(models.TcRegistrationAnswer).filter(
            models.TcRegistrationAnswer.registration_id == registration.id,
        ).delete(synchronize_session=False)
        db.query(models.TcRegistrationBowler).filter(
            models.TcRegistrationBowler.registration_id == registration.id,
        ).delete(synchronize_session=False)
        db.delete(registration)

    db.commit()
    return {"ok": True, "entry_id": entry_id}


@router.delete("/{tournament_id}")
def delete_tournament(
    tournament_id: int,
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    tournament = verify_owned_tc_tournament_access(db, tournament_id, user)

    registration_count = int(
        db.query(func.count(models.TcRegistration.id))
        .filter(models.TcRegistration.tournament_id == tournament_id)
        .scalar()
        or 0
    )
    if registration_count > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete a Tournament Central tournament that has registrations",
        )

    try:
        db.query(models.TournamentCentralSetupState).filter(
            models.TournamentCentralSetupState.tournament_id == tournament_id
        ).delete()
        db.delete(tournament)
        db.commit()
    except Exception as error:
        db.rollback()
        logger.error(f"Error deleting TC tournament {tournament_id}: {error}")
        raise HTTPException(status_code=500, detail="Failed to delete tournament")

    return {"ok": True}
