from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ...api import deps
from ...core import models, schemas
from ...services import tc_venues as venue_service

router = APIRouter()


class TcVenueResolveRequest(BaseModel):
    name: str
    address_line_1: str | None = None
    address_line_2: str | None = None
    city: str | None = None
    state: str | None = None
    zip: str | None = None
    country: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    external_provider: str | None = None
    external_place_id: str | None = None
    phone: str | None = None
    website: str | None = None


class TcVenueSearchResponseItem(BaseModel):
    source: str
    venue: schemas.TcVenue | schemas.TcVenueCreate


@router.get("/search", response_model=list[TcVenueSearchResponseItem])
def search_venues(
    query: str = Query(..., min_length=2, max_length=120),
    limit: int = Query(default=8, ge=1, le=25),
    db: Session = Depends(deps.get_db),
    _user: models.User = Depends(deps.get_current_user),
):
    internal_results = venue_service.search_internal_venues(db, query, limit=limit)
    if internal_results:
        return [
            TcVenueSearchResponseItem(
                source="internal",
                venue=schemas.TcVenue.model_validate(venue),
            )
            for venue in internal_results
        ]

    external_results = venue_service.search_external_venues(query, limit=limit)
    return [
        TcVenueSearchResponseItem(
            source="external",
            venue=schemas.TcVenueCreate(
                name=result.name,
                address_line_1=result.address_line_1,
                address_line_2=result.address_line_2,
                city=result.city,
                state=result.state,
                zip=result.zip,
                country=result.country,
                latitude=result.latitude,
                longitude=result.longitude,
                external_provider=result.external_provider,
                external_place_id=result.external_place_id,
                phone=result.phone,
                website=result.website,
            ),
        )
        for result in external_results
    ]


@router.post("/resolve", response_model=schemas.TcVenue)
def resolve_venue(
    payload: TcVenueResolveRequest,
    db: Session = Depends(deps.get_db),
    _user: models.User = Depends(deps.get_current_user),
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Venue name is required")

    candidate = venue_service.VenueCandidate(
        name=name,
        address_line_1=(payload.address_line_1 or None),
        address_line_2=(payload.address_line_2 or None),
        city=(payload.city or None),
        state=(payload.state or None),
        zip=(payload.zip or None),
        country=(payload.country or None),
        latitude=payload.latitude,
        longitude=payload.longitude,
        external_provider=(payload.external_provider or None),
        external_place_id=(payload.external_place_id or None),
        phone=(payload.phone or None),
        website=(payload.website or None),
    )

    try:
        venue = venue_service.find_or_create_venue(db, candidate)
        db.commit()
        db.refresh(venue)
        return venue
    except Exception:
        db.rollback()
        raise
