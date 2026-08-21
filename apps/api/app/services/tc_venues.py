from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..core import models
from ..core.config import settings


@dataclass
class VenueCandidate:
    name: str
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    external_provider: Optional[str] = None
    external_place_id: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None


def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    normalized = re.sub(r"[^a-z0-9]+", " ", value.lower())
    return re.sub(r"\s+", " ", normalized).strip()


def build_tournament_location(venue: models.TcVenue | VenueCandidate | None) -> str | None:
    if venue is None:
        return None

    name = (venue.name or "").strip()
    city = ((getattr(venue, "city", None) or "").strip())
    state = ((getattr(venue, "state", None) or "").strip())
    parts = [part for part in (name, city, state) if part]
    return ", ".join(parts) if parts else None


def search_internal_venues(db: Session, query: str, *, limit: int = 8) -> list[models.TcVenue]:
    text = query.strip()
    if not text:
        return []

    like_query = f"%{text}%"
    return (
        db.query(models.TcVenue)
        .filter(
            or_(
                models.TcVenue.name.ilike(like_query),
                models.TcVenue.city.ilike(like_query),
                models.TcVenue.state.ilike(like_query),
                models.TcVenue.address_line_1.ilike(like_query),
                models.TcVenue.zip.ilike(like_query),
            )
        )
        .order_by(models.TcVenue.updated_at.desc(), models.TcVenue.id.desc())
        .limit(max(1, min(limit, 25)))
        .all()
    )


def search_external_venues(query: str, *, limit: int = 8) -> list[VenueCandidate]:
    provider = (settings.TC_VENUE_EXTERNAL_PROVIDER or "none").strip().lower()
    if provider != "nominatim":
        return []

    params = urlencode(
        {
            "q": query.strip(),
            "format": "jsonv2",
            "addressdetails": 1,
            "limit": max(1, min(limit, settings.TC_VENUE_EXTERNAL_LIMIT, 25)),
        }
    )
    url = f"https://nominatim.openstreetmap.org/search?{params}"
    request = Request(
        url,
        headers={
            "User-Agent": "BracketWorks-TC/1.0",
            "Accept": "application/json",
        },
        method="GET",
    )

    try:
        with urlopen(request, timeout=settings.TC_VENUE_SEARCH_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception:
        return []

    candidates: list[VenueCandidate] = []
    for row in payload if isinstance(payload, list) else []:
        address = row.get("address") if isinstance(row, dict) else {}
        if not isinstance(address, dict):
            address = {}

        display_name = str(row.get("display_name") or "").strip()
        name = str(
            row.get("name")
            or address.get("amenity")
            or address.get("building")
            or display_name.split(",")[0]
            or ""
        ).strip()
        city = str(address.get("city") or address.get("town") or address.get("village") or "").strip() or None
        state = str(address.get("state") or address.get("state_code") or "").strip() or None
        zip_code = str(address.get("postcode") or "").strip() or None
        country = str(address.get("country_code") or address.get("country") or "").strip().upper() or None

        road = str(address.get("road") or "").strip()
        house_number = str(address.get("house_number") or "").strip()
        address_line_1 = " ".join(part for part in (house_number, road) if part).strip() or None

        lat_raw = row.get("lat")
        lon_raw = row.get("lon")
        try:
            latitude = float(lat_raw) if lat_raw is not None else None
            longitude = float(lon_raw) if lon_raw is not None else None
        except (TypeError, ValueError):
            latitude = None
            longitude = None

        if not name:
            continue

        candidates.append(
            VenueCandidate(
                name=name,
                address_line_1=address_line_1,
                city=city,
                state=state,
                zip=zip_code,
                country=country,
                latitude=latitude,
                longitude=longitude,
                external_provider="nominatim",
                external_place_id=str(row.get("place_id") or "").strip() or None,
            )
        )

    return candidates


def _find_existing_venue(db: Session, candidate: VenueCandidate) -> models.TcVenue | None:
    provider = (candidate.external_provider or "").strip()
    place_id = (candidate.external_place_id or "").strip()
    if provider and place_id:
        existing = (
            db.query(models.TcVenue)
            .filter(
                models.TcVenue.external_provider == provider,
                models.TcVenue.external_place_id == place_id,
            )
            .first()
        )
        if existing is not None:
            return existing

    normalized_name = normalize_text(candidate.name)
    normalized_address = normalize_text(candidate.address_line_1)
    normalized_city = normalize_text(candidate.city)
    normalized_state = normalize_text(candidate.state)

    for venue in db.query(models.TcVenue).all():
        if normalize_text(venue.name) != normalized_name:
            continue
        if normalize_text(venue.address_line_1) != normalized_address:
            continue
        if normalize_text(venue.city) != normalized_city:
            continue
        if normalize_text(venue.state) != normalized_state:
            continue
        return venue

    return None


def find_or_create_venue(db: Session, candidate: VenueCandidate) -> models.TcVenue:
    existing = _find_existing_venue(db, candidate)
    if existing is not None:
        return existing

    venue = models.TcVenue(
        name=candidate.name.strip(),
        address_line_1=(candidate.address_line_1 or None),
        address_line_2=(candidate.address_line_2 or None),
        city=(candidate.city or None),
        state=(candidate.state or None),
        zip=(candidate.zip or None),
        country=(candidate.country or "US"),
        latitude=candidate.latitude,
        longitude=candidate.longitude,
        external_provider=(candidate.external_provider or None),
        external_place_id=(candidate.external_place_id or None),
        phone=(candidate.phone or None),
        website=(candidate.website or None),
    )
    db.add(venue)
    db.flush()
    return venue
