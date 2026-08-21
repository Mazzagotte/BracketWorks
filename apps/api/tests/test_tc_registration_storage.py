from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.core import models


def _base_setup_payload(*, waitlist_enabled: bool = True, capacity: int = 100, deadline_iso: str | None = None) -> dict:
    return {
        "events": [
            {
                "id": "evt-singles",
                "name": "Singles",
                "enabled": True,
                "minPlayers": 1,
                "maxPlayers": 1,
                "requireDivision": True,
                "requireSquad": True,
                "connectedDivisionIds": ["div-open"],
                "connectedSquadIds": ["sq-am"],
                "entryFeeCents": 6000,
            },
            {
                "id": "evt-doubles",
                "name": "Doubles",
                "enabled": True,
                "minPlayers": 2,
                "maxPlayers": 2,
                "requireDivision": True,
                "requireSquad": True,
                "connectedDivisionIds": ["div-open"],
                "connectedSquadIds": ["sq-am"],
                "entryFeeCents": 9000,
            },
        ],
        "divisions": [
            {"id": "div-open", "name": "Open", "enabled": True},
        ],
        "squads": [
            {
                "id": "sq-am",
                "name": "Saturday AM",
                "dateIso": "2026-10-01",
                "startTime": "09:00",
                "requiredBowlerCount": 1,
                "capacity": capacity,
                "waitlistEnabled": waitlist_enabled,
                "registrationDeadlineIso": deadline_iso,
            }
        ],
        "fields": [
            {"key": "first_name", "label": "First Name", "mode": "required"},
            {"key": "last_name", "label": "Last Name", "mode": "required"},
            {"key": "email", "label": "Email", "mode": "required"},
            {"key": "phone", "label": "Phone", "mode": "optional"},
        ],
        "questions": [
            {"id": "q-shirt", "label": "Shirt Size", "required": False, "enabled": True},
        ],
    }


def _create_tc_tournament_with_setup(db_session, owner_id: int, *, setup_payload: dict) -> models.TournamentCentral:
    tournament = models.TournamentCentral(
        user_id=owner_id,
        name="TC Local Event",
        location="Boise, ID",
        start_date="2026-10-01",
        end_date="2026-10-02",
        squad_times="{}",
        is_public=True,
    )
    db_session.add(tournament)
    db_session.commit()
    db_session.refresh(tournament)

    setup_state = models.TournamentCentralSetupState(
        tournament_id=tournament.id,
        user_id=owner_id,
        payload=setup_payload,
        is_published=True,
    )
    db_session.add(setup_state)
    db_session.commit()
    return tournament


def _registration_payload(*, event_id: str = "evt-singles", division_id: str = "div-open", squad_id: str = "sq-am", accept_terms: bool = True, bowlers: list[dict] | None = None, bowler_answers: list[dict] | None = None) -> dict:
    roster = bowlers or [
        {
            "first_name": "James",
            "last_name": "Mazzagotte",
            "email": "james@example.com",
            "phone": "2081112222",
            "usbc_number": "123456",
            "average": "190",
        }
    ]
    return {
        "tournamentId": "1",
        "tournamentName": "TC Local Event",
        "submittedAt": datetime.now(timezone.utc).isoformat(),
        "form": {
            "firstName": roster[0].get("first_name", ""),
            "lastName": roster[0].get("last_name", ""),
            "email": roster[0].get("email", ""),
            "phone": roster[0].get("phone", ""),
            "usbcNumber": roster[0].get("usbc_number", ""),
            "bowlers": roster,
            "eventId": event_id,
            "divisionId": division_id,
            "squadId": squad_id,
            "notes": "Please place us together",
            "questionAnswers": (bowler_answers or [{}])[0],
            "bowlerQuestionAnswers": bowler_answers or [{}],
            "fieldValues": roster[0],
            "acceptTerms": accept_terms,
        },
    }


def test_public_registration_is_stored_relationally_and_not_in_setup_payload(api_client, db_session, make_user):
    owner = make_user("tc_owner_storage")
    tournament = _create_tc_tournament_with_setup(db_session, owner.id, setup_payload=_base_setup_payload())

    response = api_client.post(
        f"/api/v1/public/tc-tournament/{tournament.id}/registration",
        json=_registration_payload(),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "confirmed"
    assert "registration_id" in payload
    assert payload["registration_id"] == "TLE-2026-0001"

    registrations = db_session.query(models.TcRegistration).filter_by(tournament_id=tournament.id).all()
    assert len(registrations) == 1
    assert registrations[0].confirmation_code == payload["registration_id"]

    entries = db_session.query(models.TcEntry).filter_by(tournament_id=tournament.id).all()
    assert len(entries) == 1

    bowlers = db_session.query(models.TcRegistrationBowler).filter_by(tournament_id=tournament.id).all()
    assert len(bowlers) == 1

    setup_state = db_session.query(models.TournamentCentralSetupState).filter_by(tournament_id=tournament.id).first()
    setup_payload = setup_state.payload if setup_state else {}
    assert "public_registration_submissions" not in setup_payload


def test_doubles_registration_requires_two_bowlers(api_client, db_session, make_user):
    owner = make_user("tc_owner_doubles")
    setup_payload = _base_setup_payload()
    setup_payload["squads"][0]["requiredBowlerCount"] = 2
    tournament = _create_tc_tournament_with_setup(db_session, owner.id, setup_payload=setup_payload)

    response = api_client.post(
        f"/api/v1/public/tc-tournament/{tournament.id}/registration",
        json=_registration_payload(event_id="evt-doubles"),
    )

    assert response.status_code == 400
    assert "requires 2 bowler forms" in response.json()["detail"]
    assert db_session.query(models.TcRegistration).filter_by(tournament_id=tournament.id).count() == 0


def test_required_custom_question_is_enforced(api_client, db_session, make_user):
    owner = make_user("tc_owner_question")
    setup_payload = _base_setup_payload()
    setup_payload["questions"] = [
        {"id": "q-usbc", "label": "USBC Member?", "required": True, "enabled": True}
    ]
    tournament = _create_tc_tournament_with_setup(db_session, owner.id, setup_payload=setup_payload)

    response = api_client.post(
        f"/api/v1/public/tc-tournament/{tournament.id}/registration",
        json=_registration_payload(bowler_answers=[{}]),
    )

    assert response.status_code == 400
    assert "USBC Member? is required" in response.json()["detail"]


def test_invalid_event_id_is_rejected(api_client, db_session, make_user):
    owner = make_user("tc_owner_bad_event")
    tournament = _create_tc_tournament_with_setup(db_session, owner.id, setup_payload=_base_setup_payload())

    response = api_client.post(
        f"/api/v1/public/tc-tournament/{tournament.id}/registration",
        json=_registration_payload(event_id="evt-unknown"),
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Selected event is invalid"


def test_event_and_squad_relationship_is_enforced(api_client, db_session, make_user):
    owner = make_user("tc_owner_event_squad")
    setup_payload = _base_setup_payload()
    setup_payload["events"][0]["connectedSquadIds"] = ["sq-other"]
    tournament = _create_tc_tournament_with_setup(db_session, owner.id, setup_payload=setup_payload)

    response = api_client.post(
        f"/api/v1/public/tc-tournament/{tournament.id}/registration",
        json=_registration_payload(),
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Selected squad is not available for this event"


def test_terms_must_be_accepted(api_client, db_session, make_user):
    owner = make_user("tc_owner_terms")
    tournament = _create_tc_tournament_with_setup(db_session, owner.id, setup_payload=_base_setup_payload())

    response = api_client.post(
        f"/api/v1/public/tc-tournament/{tournament.id}/registration",
        json=_registration_payload(accept_terms=False),
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Tournament terms must be accepted"


def test_registration_deadline_is_enforced(api_client, db_session, make_user):
    owner = make_user("tc_owner_deadline")
    past_date = (datetime.now(timezone.utc) - timedelta(days=1)).date().isoformat()
    tournament = _create_tc_tournament_with_setup(
        db_session,
        owner.id,
        setup_payload=_base_setup_payload(deadline_iso=past_date),
    )

    response = api_client.post(
        f"/api/v1/public/tc-tournament/{tournament.id}/registration",
        json=_registration_payload(),
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Registration deadline has passed for this squad"


def test_capacity_without_waitlist_blocks_registration(api_client, db_session, make_user):
    owner = make_user("tc_owner_capacity_block")
    tournament = _create_tc_tournament_with_setup(
        db_session,
        owner.id,
        setup_payload=_base_setup_payload(waitlist_enabled=False, capacity=1),
    )

    first = api_client.post(
        f"/api/v1/public/tc-tournament/{tournament.id}/registration",
        json=_registration_payload(),
    )
    second = api_client.post(
        f"/api/v1/public/tc-tournament/{tournament.id}/registration",
        json=_registration_payload(),
    )

    assert first.status_code == 200
    assert second.status_code == 409
    assert second.json()["detail"] == "This squad is full"


def test_capacity_with_waitlist_marks_waitlisted(api_client, db_session, make_user):
    owner = make_user("tc_owner_capacity_waitlist")
    tournament = _create_tc_tournament_with_setup(
        db_session,
        owner.id,
        setup_payload=_base_setup_payload(waitlist_enabled=True, capacity=1),
    )

    first = api_client.post(
        f"/api/v1/public/tc-tournament/{tournament.id}/registration",
        json=_registration_payload(),
    )
    second = api_client.post(
        f"/api/v1/public/tc-tournament/{tournament.id}/registration",
        json=_registration_payload(),
    )

    assert first.status_code == 200
    assert first.json()["status"] == "confirmed"
    assert second.status_code == 200
    assert second.json()["status"] == "waitlisted"


def test_setup_save_does_not_overwrite_relational_registrations(api_client, db_session, make_user, make_auth_headers):
    owner = make_user("tc_owner_setup_save")
    tournament = _create_tc_tournament_with_setup(db_session, owner.id, setup_payload=_base_setup_payload())

    create_response = api_client.post(
        f"/api/v1/public/tc-tournament/{tournament.id}/registration",
        json=_registration_payload(),
    )
    assert create_response.status_code == 200

    headers = make_auth_headers(owner)
    save_response = api_client.put(
        f"/api/v1/tc/organizer-setup/{tournament.id}",
        headers=headers,
        json={"payload": {"events": [], "divisions": [], "squads": [], "fields": [], "questions": []}, "is_published": True},
    )
    assert save_response.status_code == 200

    assert db_session.query(models.TcRegistration).filter_by(tournament_id=tournament.id).count() == 1


def test_tc_tournament_entry_count_reflects_relational_entries(api_client, db_session, make_user, make_auth_headers):
    owner = make_user("tc_owner_entry_count")
    tournament = _create_tc_tournament_with_setup(db_session, owner.id, setup_payload=_base_setup_payload())

    create_response = api_client.post(
        f"/api/v1/public/tc-tournament/{tournament.id}/registration",
        json=_registration_payload(),
    )
    assert create_response.status_code == 200

    list_response = api_client.get(
        "/api/v1/tc/tournaments/",
        headers=make_auth_headers(owner),
    )
    assert list_response.status_code == 200

    rows = list_response.json()
    tournament_row = next(row for row in rows if row["id"] == tournament.id)
    assert tournament_row["entry_count"] == 1


def test_organizer_cannot_access_another_organizers_registrations(api_client, db_session, make_user, make_auth_headers):
    owner = make_user("tc_owner_a")
    other = make_user("tc_owner_b")
    tournament = _create_tc_tournament_with_setup(db_session, owner.id, setup_payload=_base_setup_payload())

    create_response = api_client.post(
        f"/api/v1/public/tc-tournament/{tournament.id}/registration",
        json=_registration_payload(),
    )
    assert create_response.status_code == 200

    response = api_client.get(
        f"/api/v1/tc/organizer-setup/{tournament.id}/registrations",
        headers=make_auth_headers(other),
    )

    assert response.status_code == 403


def test_tournament_delete_is_blocked_when_registrations_exist(api_client, db_session, make_user, make_auth_headers):
    owner = make_user("tc_owner_delete_block")
    tournament = _create_tc_tournament_with_setup(db_session, owner.id, setup_payload=_base_setup_payload())

    create_response = api_client.post(
        f"/api/v1/public/tc-tournament/{tournament.id}/registration",
        json=_registration_payload(),
    )
    assert create_response.status_code == 200

    response = api_client.delete(
        f"/api/v1/tc/tournaments/{tournament.id}",
        headers=make_auth_headers(owner),
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Cannot delete a Tournament Central tournament that has registrations"


def test_organizer_can_edit_mark_paid_and_delete_individual_entry(api_client, db_session, make_user, make_auth_headers):
    owner = make_user("tc_owner_entry_actions")
    tournament = _create_tc_tournament_with_setup(db_session, owner.id, setup_payload=_base_setup_payload())

    create_response = api_client.post(
        f"/api/v1/public/tc-tournament/{tournament.id}/registration",
        json=_registration_payload(),
    )
    assert create_response.status_code == 200

    entry = db_session.query(models.TcEntry).filter_by(tournament_id=tournament.id).first()
    registration = db_session.query(models.TcRegistration).filter_by(tournament_id=tournament.id).first()
    assert entry is not None
    assert registration is not None
    entry_id = entry.id
    registration_id = registration.id
    headers = make_auth_headers(owner)

    edit_response = api_client.patch(
        f"/api/v1/tc/tournaments/{tournament.id}/entries/{entry_id}",
        headers=headers,
        json={
            "status": "confirmed",
            "entry_number": 12,
            "event_name_snapshot": "Corrected Singles",
            "entry_fee_cents": 7500,
            "contact_first_name": "Updated",
            "contact_email": "updated@example.com",
            "notes": "Director correction",
            "bowlers": [{
                "first_name": "Updated",
                "last_name": "Mazzagotte",
                "email": "updated@example.com",
                "phone": "2089998888",
                "usbc_number": "999999",
                "average": 200,
            }],
        },
    )
    assert edit_response.status_code == 200
    assert edit_response.json()["entry_number"] == 12
    db_session.expire_all()
    assert db_session.get(models.TcEntry, entry_id).event_name_snapshot == "Singles"
    assert db_session.get(models.TcEntry, entry_id).entry_fee_cents == 7500
    assert db_session.get(models.TcRegistration, registration_id).contact_first_name == "Updated"
    assert db_session.get(models.TcRegistration, registration_id).notes == "Director correction"
    assert db_session.get(models.TcRegistration, registration_id).total_cents == 7500
    updated_bowler = db_session.query(models.TcRegistrationBowler).filter_by(registration_id=registration_id).first()
    assert updated_bowler.email == "updated@example.com"
    assert updated_bowler.average == 200

    paid_response = api_client.patch(
        f"/api/v1/tc/tournaments/{tournament.id}/registrations/{registration_id}",
        headers=headers,
        json={"payment_status": "paid"},
    )
    assert paid_response.status_code == 200
    assert paid_response.json()["payment_status"] == "paid"

    delete_response = api_client.delete(
        f"/api/v1/tc/tournaments/{tournament.id}/entries/{entry_id}",
        headers=headers,
    )
    assert delete_response.status_code == 200
    db_session.expire_all()
    assert db_session.get(models.TcEntry, entry_id) is None
    assert db_session.get(models.TcRegistration, registration_id) is None


def test_entry_edit_derives_snapshots_from_same_tournament_setup(api_client, db_session, make_user, make_auth_headers):
    owner = make_user("tc_owner_authoritative_snapshots")
    tournament = _create_tc_tournament_with_setup(db_session, owner.id, setup_payload=_base_setup_payload())
    assert api_client.post(
        f"/api/v1/public/tc-tournament/{tournament.id}/registration",
        json=_registration_payload(),
    ).status_code == 200
    entry = db_session.query(models.TcEntry).filter_by(tournament_id=tournament.id).one()

    response = api_client.patch(
        f"/api/v1/tc/tournaments/{tournament.id}/entries/{entry.id}",
        headers=make_auth_headers(owner),
        json={
            "event_config_id": "evt-doubles",
            "event_name_snapshot": "Client supplied wrong event",
            "division_config_id": "div-open",
            "division_name_snapshot": "Client supplied wrong division",
            "squad_config_id": "sq-am",
            "squad_name_snapshot": "Client supplied wrong squad",
            "squad_date_snapshot": "1999-01-01",
            "squad_time_snapshot": "23:59",
        },
    )

    assert response.status_code == 200
    db_session.expire_all()
    updated = db_session.get(models.TcEntry, entry.id)
    assert updated.event_name_snapshot == "Doubles"
    assert updated.division_name_snapshot == "Open"
    assert updated.squad_name_snapshot == "Saturday AM"
    assert updated.squad_date_snapshot == "2026-10-01"
    assert updated.squad_time_snapshot == "09:00"


def test_entry_edit_rejects_config_id_from_another_tournament(api_client, db_session, make_user, make_auth_headers):
    owner = make_user("tc_owner_cross_tournament_config")
    tournament = _create_tc_tournament_with_setup(db_session, owner.id, setup_payload=_base_setup_payload())
    foreign_payload = _base_setup_payload()
    foreign_payload["squads"][0]["id"] = "sq-foreign"
    _create_tc_tournament_with_setup(db_session, owner.id, setup_payload=foreign_payload)
    assert api_client.post(
        f"/api/v1/public/tc-tournament/{tournament.id}/registration",
        json=_registration_payload(),
    ).status_code == 200
    entry = db_session.query(models.TcEntry).filter_by(tournament_id=tournament.id).one()

    response = api_client.patch(
        f"/api/v1/tc/tournaments/{tournament.id}/entries/{entry.id}",
        headers=make_auth_headers(owner),
        json={"squad_config_id": "sq-foreign", "squad_name_snapshot": "Foreign squad"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Selected squad does not belong to this tournament"


def test_scoped_tournament_and_setup_summary_enforce_ownership(api_client, db_session, make_user, make_auth_headers):
    owner = make_user("tc_owner_scoped_load")
    outsider = make_user("tc_outsider_scoped_load")
    tournament = _create_tc_tournament_with_setup(db_session, owner.id, setup_payload=_base_setup_payload())

    tournament_response = api_client.get(
        f"/api/v1/tc/tournaments/{tournament.id}",
        headers=make_auth_headers(owner),
    )
    summary_response = api_client.get(
        f"/api/v1/tc/tournaments/{tournament.id}/setup-summary",
        headers=make_auth_headers(owner),
    )
    outsider_response = api_client.get(
        f"/api/v1/tc/tournaments/{tournament.id}/setup-summary",
        headers=make_auth_headers(outsider),
    )

    assert tournament_response.status_code == 200
    assert summary_response.status_code == 200
    assert summary_response.json()["tournament_id"] == tournament.id
    assert outsider_response.status_code in (403, 404)
