from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.api.deps import SessionLocal
from app.core import models
from app.services.tc_venues import VenueCandidate, build_tournament_location, find_or_create_venue

TEST_USERNAME = "tc_map_test_owner"
TEST_EMAIL = "tc-map-test@example.com"
TEST_PREFIX = "TC Map Test "


def build_squad_times(payload: dict) -> dict[str, list[str]]:
    squad_times: dict[str, list[str]] = {}
    for squad in payload.get("squads", []):
        if not isinstance(squad, dict):
            continue
        date_iso = str(squad.get("dateIso") or "").strip()
        start_time = str(squad.get("startTime") or "").strip()
        if date_iso and start_time:
            squad_times.setdefault(date_iso, []).append(start_time)
    return {date: sorted(set(times)) for date, times in squad_times.items()}


def get_test_owner(db) -> models.User:
    owner = db.query(models.User).filter(models.User.username == TEST_USERNAME).one_or_none()
    if owner is not None:
        return owner

    owner = models.User(
        username=TEST_USERNAME,
        email=TEST_EMAIL,
        first_name="Tournament",
        last_name="Map Testing",
        password="local-test-data-only",
        organization="Tournament Central Map Testing",
        is_active=True,
    )
    db.add(owner)
    db.flush()
    return owner


def import_bundle(bundle_path: Path) -> tuple[int, int, int]:
    bundle = json.loads(bundle_path.read_text(encoding="utf-8"))
    if bundle.get("format") != "tc-map-test-bundle" or bundle.get("version") != 1:
        raise ValueError("Expected a tc-map-test-bundle version 1 file")

    templates = bundle.get("tournaments")
    if not isinstance(templates, list) or not templates:
        raise ValueError("The test bundle has no tournament templates")

    created = 0
    updated = 0
    venues_created_before = 0

    with SessionLocal() as db:
        owner = get_test_owner(db)
        for template in templates:
            if not isinstance(template, dict) or template.get("format") != "tc-tournament-template":
                raise ValueError("Bundle contains an invalid tournament template")
            payload = template.get("payload")
            if not isinstance(payload, dict):
                raise ValueError("Tournament template is missing its payload")

            details = payload.get("details")
            if not isinstance(details, dict):
                raise ValueError("Tournament template is missing details")

            name = str(details.get("name") or "").strip()
            if not name.startswith(TEST_PREFIX):
                raise ValueError(f"Refusing to import non-test tournament: {name or '<unnamed>'}")

            venue_count_before = db.query(models.TcVenue).count()
            venue = find_or_create_venue(
                db,
                VenueCandidate(
                    name=str(details.get("bowlingCenter") or "").strip(),
                    address_line_1=str(details.get("venueAddressLine1") or "").strip() or None,
                    address_line_2=str(details.get("venueAddressLine2") or "").strip() or None,
                    city=str(details.get("city") or "").strip() or None,
                    state=str(details.get("state") or "").strip() or None,
                    zip=str(details.get("venueZip") or "").strip() or None,
                    country=str(details.get("venueCountry") or "US").strip() or "US",
                    latitude=details.get("venueLatitude"),
                    longitude=details.get("venueLongitude"),
                    external_provider=str(details.get("venueExternalProvider") or "").strip() or None,
                    external_place_id=str(details.get("venueExternalPlaceId") or "").strip() or None,
                ),
            )
            venues_created_before += int(db.query(models.TcVenue).count() > venue_count_before)

            tournament = (
                db.query(models.TournamentCentral)
                .filter(models.TournamentCentral.user_id == owner.id, models.TournamentCentral.name == name)
                .one_or_none()
            )
            if tournament is None:
                tournament = models.TournamentCentral(user_id=owner.id, name=name)
                db.add(tournament)
                created += 1
            else:
                updated += 1

            tournament.venue_id = venue.id
            tournament.location = build_tournament_location(venue)
            tournament.start_date = str(details.get("startDateIso") or "").strip() or None
            tournament.end_date = str(details.get("endDateIso") or "").strip() or None
            tournament.squad_times = json.dumps(build_squad_times(payload))
            tournament.is_public = True
            db.flush()

            state = (
                db.query(models.TournamentCentralSetupState)
                .filter(models.TournamentCentralSetupState.tournament_id == tournament.id)
                .one_or_none()
            )
            if state is None:
                state = models.TournamentCentralSetupState(
                    tournament_id=tournament.id,
                    user_id=owner.id,
                    payload=payload,
                    is_published=True,
                )
                db.add(state)
            else:
                state.payload = payload
                state.is_published = True

        db.commit()

    return created, updated, venues_created_before


def main() -> None:
    parser = argparse.ArgumentParser(description="Import a synthetic Tournament Central map test bundle")
    parser.add_argument("bundle", type=Path, help="Path to a tc-map-test-bundle JSON file")
    args = parser.parse_args()

    created, updated, venues_created = import_bundle(args.bundle)
    print(f"Imported TC map test bundle: {created} tournaments created, {updated} updated, {venues_created} venues created.")


if __name__ == "__main__":
    main()
