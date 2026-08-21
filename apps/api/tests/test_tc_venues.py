from __future__ import annotations

from app.core import models


def test_resolve_venue_reuses_external_place_id(api_client, db_session, make_user, make_auth_headers):
    owner = make_user("tc_venue_owner")
    headers = make_auth_headers(owner)

    payload = {
        "name": "Westy's Garden Lanes",
        "address_line_1": "5504 W Alworth St",
        "city": "Boise",
        "state": "ID",
        "zip": "83714",
        "country": "US",
        "latitude": 43.6608,
        "longitude": -116.2571,
        "external_provider": "nominatim",
        "external_place_id": "12345",
    }

    first = api_client.post("/api/v1/tc/venues/resolve", json=payload, headers=headers)
    assert first.status_code == 200
    first_body = first.json()
    assert isinstance(first_body.get("id"), int)

    second = api_client.post("/api/v1/tc/venues/resolve", json=payload, headers=headers)
    assert second.status_code == 200
    second_body = second.json()
    assert second_body["id"] == first_body["id"]

    venues = db_session.query(models.TcVenue).all()
    assert len(venues) == 1


def test_search_returns_internal_matches_first(api_client, db_session, make_user, make_auth_headers):
    owner = make_user("tc_venue_search_owner")
    headers = make_auth_headers(owner)

    venue = models.TcVenue(
        name="Sunset Lanes",
        address_line_1="123 Main St",
        city="Boise",
        state="ID",
        zip="83702",
        country="US",
        latitude=43.615,
        longitude=-116.2023,
    )
    db_session.add(venue)
    db_session.commit()

    response = api_client.get("/api/v1/tc/venues/search?query=Sunset", headers=headers)
    assert response.status_code == 200

    rows = response.json()
    assert isinstance(rows, list)
    assert len(rows) >= 1
    assert rows[0]["source"] == "internal"
    assert rows[0]["venue"]["name"] == "Sunset Lanes"


def test_tc_tournament_uses_venue_and_public_directory_exposes_coordinates(
    api_client,
    make_user,
    make_auth_headers,
):
    owner = make_user("tc_venue_tournament_owner")
    headers = make_auth_headers(owner)

    venue_response = api_client.post(
        "/api/v1/tc/venues/resolve",
        json={
            "name": "Westy's Garden Lanes",
            "address_line_1": "5504 W Alworth St",
            "city": "Boise",
            "state": "ID",
            "zip": "83714",
            "country": "US",
            "latitude": 43.6608,
            "longitude": -116.2571,
        },
        headers=headers,
    )
    assert venue_response.status_code == 200
    venue_id = venue_response.json()["id"]

    create_response = api_client.post(
        "/api/v1/tc/tournaments/",
        json={
            "name": "Treasure Valley Open",
            "venue_id": venue_id,
            "location": None,
            "start_date": "2026-10-10",
            "end_date": "2026-10-11",
            "squad_times": {},
            "is_public": True,
        },
        headers=headers,
    )
    assert create_response.status_code == 200
    created = create_response.json()
    assert created["venue"]["id"] == venue_id
    assert "Boise, ID" in (created["location"] or "")

    directory_response = api_client.get("/api/v1/public/tournaments?source=tc")
    assert directory_response.status_code == 200
    rows = directory_response.json().get("tournaments", [])
    match = next((row for row in rows if row.get("name") == "Treasure Valley Open"), None)
    assert match is not None
    assert match.get("latitude") == 43.6608
    assert match.get("longitude") == -116.2571
    assert match.get("venue", {}).get("name") == "Westy's Garden Lanes"
