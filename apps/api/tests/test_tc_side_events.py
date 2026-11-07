"""Side events and fees bought at registration: server pricing, scope, quantities, listing, and email."""

from __future__ import annotations

import copy
from datetime import datetime, timezone

import pytest

from app.core import models
from app.services import tc_emails
from app.services.tc_side_events import SideEventError, price_side_events


BRACKETS = {
    "id": "fee-brackets",
    "name": "Handicap brackets",
    "amountCents": 500,
    "required": False,
    "enabled": True,
    "displayOrder": 1,
    "eventIds": [],
    "divisionIds": [],
    "squadIds": [],
    "sideEvent": {
        "kind": "brackets",
        "allowQuantity": True,
        "maxQuantity": 10,
        "per": "bowler",
        "brackets": {"scoring": "handicap", "size": 8, "firstPlaceCents": 3000, "secondPlaceCents": 1000},
    },
}
HIGH_GAME = {
    "id": "fee-high-game",
    "name": "High game",
    "amountCents": 1000,
    "required": False,
    "enabled": True,
    "displayOrder": 2,
    "eventIds": [],
    "divisionIds": [],
    "squadIds": [],
    "sideEvent": {"kind": "high-game-pot", "allowQuantity": False, "maxQuantity": None, "per": "bowler"},
}
LINEAGE = {
    "id": "fee-lineage",
    "name": "Lineage",
    "amountCents": 200,
    "required": True,
    "enabled": True,
    "displayOrder": 3,
    "eventIds": [],
    "divisionIds": [],
    "squadIds": [],
    "sideEvent": {"kind": "fee", "allowQuantity": False, "maxQuantity": None, "per": "registration"},
}


def _setup(fees: list[dict] | None = None) -> dict:
    return {
        "details": {"name": "Fall Classic", "startDateIso": "2026-10-01", "endDateIso": "2026-10-02"},
        "events": [
            {
                "id": "evt-singles", "name": "Singles", "enabled": True, "minPlayers": 1, "maxPlayers": 1,
                "requireDivision": True, "requireSquad": True, "connectedDivisionIds": ["div-open"],
                "connectedSquadIds": ["sq-am"], "entryFeeCents": 6000,
            },
            {
                "id": "evt-doubles", "name": "Doubles", "enabled": True, "minPlayers": 2, "maxPlayers": 2,
                "requireDivision": True, "requireSquad": True, "connectedDivisionIds": ["div-open"],
                "connectedSquadIds": ["sq-am"], "entryFeeCents": 9000,
            },
        ],
        "divisions": [{"id": "div-open", "name": "Open", "enabled": True}],
        "squads": [{"id": "sq-am", "name": "Saturday AM", "dateIso": "2026-10-01", "startTime": "09:00", "capacity": 100}],
        "fields": [
            {"key": "first_name", "label": "First Name", "mode": "required"},
            {"key": "last_name", "label": "Last Name", "mode": "required"},
            {"key": "email", "label": "Email", "mode": "required"},
        ],
        "questions": [],
        "fees": copy.deepcopy(fees if fees is not None else [BRACKETS, HIGH_GAME, LINEAGE]),
    }


def _tournament(db, owner_id: int, setup: dict) -> models.TournamentCentral:
    tournament = models.TournamentCentral(
        user_id=owner_id, name="Fall Classic", location="Boise, ID", start_date="2026-10-01",
        end_date="2026-10-02", squad_times="{}", is_public=True, is_published=True,
    )
    db.add(tournament)
    db.commit()
    db.refresh(tournament)
    db.add(models.TournamentCentralSetupState(
        tournament_id=tournament.id, user_id=owner_id, payload=setup, is_published=True,
    ))
    db.commit()
    return tournament


def _payload(*, event_id: str = "evt-singles", bowlers: list[dict] | None = None, side_events=None, **form) -> dict:
    roster = bowlers or [{"first_name": "James", "last_name": "Mazz", "email": "james@example.com"}]
    body = {
        "tournamentId": "1",
        "tournamentName": "Fall Classic",
        "submittedAt": datetime.now(timezone.utc).isoformat(),
        "form": {
            "firstName": roster[0]["first_name"],
            "lastName": roster[0]["last_name"],
            "email": roster[0]["email"],
            "bowlers": roster,
            "eventId": event_id,
            "divisionId": "div-open",
            "squadId": "sq-am",
            "fieldValues": roster[0],
            "acceptTerms": True,
            **form,
        },
    }
    if side_events is not None:
        body["form"]["side_events"] = side_events
    return body


DOUBLES = [
    {"first_name": "Ann", "last_name": "Lee", "email": "ann@example.com"},
    {"first_name": "Bob", "last_name": "Ray", "email": "bob@example.com"},
]


@pytest.fixture()
def outbox(monkeypatch):
    sent: list[dict] = []
    monkeypatch.setattr(tc_emails, "_post_resend", lambda path, body: sent.append(body) or True)
    return sent


def _submit(api_client, tournament, body, headers=None):
    return api_client.post(
        f"/api/v1/public/tc-tournament/{tournament.id}/registration", json=body, headers=headers or {},
    )


def test_server_prices_side_events_and_ignores_client_amounts(api_client, db_session, make_user, outbox):
    owner = make_user("se_pricing")
    tournament = _tournament(db_session, owner.id, _setup())

    response = _submit(api_client, tournament, _payload(side_events=[
        {"fee_id": "fee-brackets", "bowler_index": 0, "quantity": 5, "unit_cents": 1, "total_cents": 1},
        {"fee_id": "fee-high-game", "bowler_index": 0, "quantity": 1},
    ]))

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["subtotal_cents"] == 6000
    assert body["fees_cents"] == 2500 + 1000 + 200
    assert body["total_cents"] == 6000 + 3700
    assert [(line["fee_id"], line["bowler_index"], line["quantity"], line["total_cents"]) for line in body["side_events"]] == [
        ("fee-brackets", 0, 5, 2500),
        ("fee-high-game", 0, 1, 1000),
        ("fee-lineage", None, 1, 200),
    ]

    registration = db_session.query(models.TcRegistration).filter_by(tournament_id=tournament.id).one()
    assert (registration.subtotal_cents, registration.fees_cents, registration.total_cents) == (6000, 3700, 9700)
    entry = db_session.query(models.TcEntry).filter_by(registration_id=registration.id).one()
    assert entry.entry_fee_cents == 6000
    bowler = db_session.query(models.TcRegistrationBowler).filter_by(registration_id=registration.id).one()
    rows = db_session.query(models.TcRegistrationSideEvent).filter_by(registration_id=registration.id).order_by(models.TcRegistrationSideEvent.id).all()
    assert [(row.kind, row.scoring, row.bowler_id, row.quantity, row.unit_cents) for row in rows] == [
        ("brackets", "handicap", bowler.id, 5, 500),
        ("high-game-pot", None, bowler.id, 1, 1000),
        ("fee", None, None, 1, 200),
    ]


def test_registration_without_side_events_keeps_old_totals(api_client, db_session, make_user, outbox):
    owner = make_user("se_backcompat")
    tournament = _tournament(db_session, owner.id, _setup(fees=[]))

    response = _submit(api_client, tournament, _payload())

    assert response.status_code == 200
    assert response.json()["fees_cents"] == 0
    assert response.json()["side_events"] == []
    registration = db_session.query(models.TcRegistration).filter_by(tournament_id=tournament.id).one()
    assert (registration.subtotal_cents, registration.fees_cents, registration.total_cents) == (6000, 0, 6000)


def test_required_fees_are_added_per_bowler_and_per_registration(api_client, db_session, make_user, outbox):
    owner = make_user("se_required")
    per_bowler = {**copy.deepcopy(HIGH_GAME), "id": "fee-expo", "name": "Expo fee", "required": True, "amountCents": 300}
    tournament = _tournament(db_session, owner.id, _setup(fees=[per_bowler, LINEAGE]))

    response = _submit(api_client, tournament, _payload(event_id="evt-doubles", bowlers=DOUBLES))

    assert response.status_code == 200, response.text
    lines = response.json()["side_events"]
    assert [(line["fee_id"], line["bowler_index"]) for line in lines] == [
        ("fee-expo", 0), ("fee-expo", 1), ("fee-lineage", None),
    ]
    assert response.json()["fees_cents"] == 300 * 2 + 200
    assert response.json()["total_cents"] == 9000 + 800


@pytest.mark.parametrize(
    ("fees", "side_events", "message"),
    [
        ([{**BRACKETS, "eventIds": ["evt-doubles"]}], [{"fee_id": "fee-brackets", "bowler_index": 0, "quantity": 1}], "isn't offered"),
        ([{**BRACKETS, "divisionIds": ["div-senior"]}], [{"fee_id": "fee-brackets", "bowler_index": 0, "quantity": 1}], "isn't offered"),
        ([{**BRACKETS, "squadIds": ["sq-pm"]}], [{"fee_id": "fee-brackets", "bowler_index": 0, "quantity": 1}], "isn't offered"),
        ([{**BRACKETS, "enabled": False}], [{"fee_id": "fee-brackets", "bowler_index": 0, "quantity": 1}], "no longer offered"),
        ([BRACKETS], [{"fee_id": "missing", "bowler_index": 0, "quantity": 1}], "no longer offered"),
        ([BRACKETS], [{"fee_id": "fee-brackets", "bowler_index": 0, "quantity": 11}], "between 1 and 10"),
        ([BRACKETS], [{"fee_id": "fee-brackets", "bowler_index": 0, "quantity": 0}], "between 1 and 10"),
        ([HIGH_GAME], [{"fee_id": "fee-high-game", "bowler_index": 0, "quantity": 2}], "only be bought once"),
        ([BRACKETS], [{"fee_id": "fee-brackets", "bowler_index": None, "quantity": 2}], "which bowler"),
        ([BRACKETS], [{"fee_id": "fee-brackets", "bowler_index": 1, "quantity": 2}], "which bowler"),
        (
            [BRACKETS],
            [
                {"fee_id": "fee-brackets", "bowler_index": 0, "quantity": 2},
                {"fee_id": "fee-brackets", "bowler_index": 0, "quantity": 3},
            ],
            "picked twice",
        ),
    ],
)
def test_invalid_side_events_are_rejected(api_client, db_session, make_user, outbox, fees, side_events, message):
    owner = make_user("se_invalid")
    tournament = _tournament(db_session, owner.id, _setup(fees=fees))

    response = _submit(api_client, tournament, _payload(side_events=side_events))

    assert response.status_code == 400
    assert message in response.json()["detail"]
    assert db_session.query(models.TcRegistration).filter_by(tournament_id=tournament.id).count() == 0


def test_quantity_without_maximum_is_capped():
    fee = {**copy.deepcopy(BRACKETS), "sideEvent": {"kind": "brackets", "allowQuantity": True, "maxQuantity": None}}
    lines = price_side_events([fee], [{"fee_id": "fee-brackets", "bowler_index": 0, "quantity": 99}],
                              event_id="e", division_id="", squad_id="", bowler_count=1)
    assert lines[0].total_cents == 99 * 500
    with pytest.raises(SideEventError):
        price_side_events([fee], [{"fee_id": "fee-brackets", "bowler_index": 0, "quantity": 100}],
                          event_id="e", division_id="", squad_id="", bowler_count=1)


def test_legacy_fee_without_side_event_settings_is_a_per_registration_fee():
    fee = {"id": "f1", "name": "Processing", "amountCents": 150, "required": True, "enabled": True}
    lines = price_side_events([fee], [], event_id="e", division_id="", squad_id="", bowler_count=3)
    assert [(line.kind, line.bowler_index, line.total_cents) for line in lines] == [("fee", None, 150)]


def test_config_lists_enabled_fees_with_side_event_settings(api_client, db_session, make_user):
    owner = make_user("se_config")
    legacy = {"id": "fee-old", "name": "Old fee", "amountCents": 100, "required": False, "enabled": True}
    disabled = {**copy.deepcopy(HIGH_GAME), "id": "fee-off", "enabled": False}
    tournament = _tournament(db_session, owner.id, _setup(fees=[BRACKETS, legacy, disabled]))

    response = api_client.get(f"/api/v1/public/tc-tournament/{tournament.id}/registration")

    assert response.status_code == 200
    fees = response.json()["fees"]
    assert [fee["id"] for fee in fees] == ["fee-brackets", "fee-old"]
    assert fees[0]["sideEvent"]["brackets"]["firstPlaceCents"] == 3000
    assert fees[1]["sideEvent"] == {"kind": "fee", "allowQuantity": False, "maxQuantity": None, "per": "registration", "brackets": None}
    assert response.json()["start_date"] == "2026-10-01"


def test_organizer_listing_includes_side_events_per_bowler(api_client, db_session, make_user, make_auth_headers, outbox):
    owner = make_user("se_listing")
    tournament = _tournament(db_session, owner.id, _setup())
    _submit(api_client, tournament, _payload(event_id="evt-doubles", bowlers=DOUBLES, side_events=[
        {"fee_id": "fee-brackets", "bowler_index": 1, "quantity": 3},
    ]))

    response = api_client.get(f"/api/v1/tc/tournaments/{tournament.id}/registrations", headers=make_auth_headers(owner))

    assert response.status_code == 200
    registration = response.json()["registrations"][0]
    bowlers = registration["entries"][0]["bowlers"]
    side_events = registration["side_events"]
    assert registration["fees_cents"] == 1500 + 200
    assert [(item["name"], item["bowler_id"], item["quantity"], item["total_cents"]) for item in side_events] == [
        ("Handicap brackets", bowlers[1]["id"], 3, 1500),
        ("Lineage", None, 1, 200),
    ]


def test_confirmation_email_lists_side_events(api_client, db_session, make_user, outbox):
    owner = make_user("se_email")
    tournament = _tournament(db_session, owner.id, _setup())
    _submit(api_client, tournament, _payload(side_events=[
        {"fee_id": "fee-brackets", "bowler_index": 0, "quantity": 5},
        {"fee_id": "fee-high-game", "bowler_index": 0, "quantity": 1},
    ]))

    registration = db_session.query(models.TcRegistration).filter_by(tournament_id=tournament.id).one()
    message = tc_emails.build_registration_confirmation(db_session, registration)

    assert message is not None
    text = message["text"]
    assert "- Handicap brackets x5 for James Mazz: $25.00" in text
    assert "- High game for James Mazz: $10.00" in text
    assert "- Lineage: $2.00" in text
    assert "Side events and fees: $37.00" in text
    assert "Total: $97.00" in text
    assert "Handicap brackets x5" in message["html"]


def test_deleting_the_last_entry_removes_side_events(api_client, db_session, make_user, make_auth_headers, outbox):
    owner = make_user("se_delete")
    tournament = _tournament(db_session, owner.id, _setup())
    _submit(api_client, tournament, _payload(side_events=[{"fee_id": "fee-brackets", "bowler_index": 0, "quantity": 2}]))
    entry = db_session.query(models.TcEntry).filter_by(tournament_id=tournament.id).one()

    response = api_client.delete(
        f"/api/v1/tc/tournaments/{tournament.id}/entries/{entry.id}", headers=make_auth_headers(owner),
    )

    assert response.status_code == 200
    db_session.expire_all()
    assert db_session.query(models.TcRegistrationSideEvent).filter_by(tournament_id=tournament.id).count() == 0
