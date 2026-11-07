"""Eligibility at sign-up: division average, age, and gender limits, and event rules."""

from __future__ import annotations

import copy
from datetime import date, datetime, timezone

import pytest

from app.core import models
from app.services import tc_emails
from app.services.tc_eligibility import (
    age_on,
    check_registration_eligibility,
    is_valid_usbc_number,
    normalize_gender,
    required_bowler_fields,
)

START = date(2026, 10, 1)


def _check(event_rules=None, division=None, bowlers=None):
    return check_registration_eligibility(
        event={"id": "e", "rules": event_rules} if event_rules is not None else {"id": "e"},
        division=division,
        bowlers=bowlers or [{"first_name": "Ann", "last_name": "Lee"}],
        reference_date=START,
    )


# --- Rules ----------------------------------------------------------------------------------


def test_no_configured_rules_means_no_checks():
    assert _check(division={"id": "d", "name": "Open"}, bowlers=[{"first_name": "Ann"}]) == []
    assert _check(event_rules={"average": {"noAverage": "assigned-average"}, "team": {}}) == []


def test_division_average_limits():
    division = {"id": "d", "name": "Under 180", "minAverage": 120, "maxAverage": 179}
    assert _check(division=division, bowlers=[{"first_name": "Ann", "last_name": "Lee", "average": "185"}]) == [
        "Ann Lee: average 185 is above the Under 180 maximum of 179."
    ]
    assert _check(division=division, bowlers=[{"first_name": "Ann", "last_name": "Lee", "average": "100"}]) == [
        "Ann Lee: average 100 is below the Under 180 minimum of 120."
    ]
    assert _check(division=division, bowlers=[{"first_name": "Ann", "last_name": "Lee", "average": "179"}]) == []
    assert _check(division=division, bowlers=[{"first_name": "Ann", "last_name": "Lee"}]) == [
        "Ann Lee: an average is required for Under 180."
    ]


def test_assigned_average_fills_a_blank_average():
    division = {"id": "d", "name": "Under 180", "maxAverage": 179}
    rules = {"average": {"noAverage": "assigned-average", "assignedAverage": 170}}
    assert _check(event_rules=rules, division=division, bowlers=[{"first_name": "Ann"}]) == []
    rules["average"]["assignedAverage"] = 190
    assert "above" in _check(event_rules=rules, division=division, bowlers=[{"first_name": "Ann"}])[0]


def test_not_eligible_without_average():
    rules = {"average": {"noAverage": "not-eligible", "assignedAverage": 170}}
    assert _check(event_rules=rules, bowlers=[{"first_name": "Ann", "last_name": "Lee"}]) == [
        "Ann Lee: an average is required for this event."
    ]
    assert _check(event_rules=rules, bowlers=[{"first_name": "Ann", "average": "150"}]) == []


def test_age_limits_use_the_first_tournament_day():
    seniors = {"id": "d", "name": "Seniors", "minAge": 50}
    youth = {"id": "d", "name": "Youth", "maxAge": 18}
    assert _check(division=seniors, bowlers=[{"first_name": "Ann", "date_of_birth": "1976-10-01"}]) == []
    assert _check(division=seniors, bowlers=[{"first_name": "Ann", "date_of_birth": "1976-10-02"}]) == [
        "Ann: must be at least 50 on the first day of the tournament for Seniors."
    ]
    assert _check(division=youth, bowlers=[{"first_name": "Ann", "date_of_birth": "2007-10-01"}]) == [
        "Ann: must be 18 or younger on the first day of the tournament for Youth."
    ]
    assert _check(division=youth, bowlers=[{"first_name": "Ann", "date_of_birth": "10/02/2007"}]) == []
    assert _check(division=youth, bowlers=[{"first_name": "Ann"}]) == [
        "Ann: a date of birth is required for Youth."
    ]
    assert age_on(date(2000, 2, 29), date(2026, 2, 28)) == 25


def test_division_gender():
    women = {"id": "d", "name": "Women", "rules": {"gender": "women", "prizeType": "cash"}}
    assert _check(division=women, bowlers=[{"first_name": "Ann", "gender": "F"}]) == []
    assert _check(division=women, bowlers=[{"first_name": "Bob", "gender": "male"}]) == ["Bob: Women is for women only."]
    assert _check(division=women, bowlers=[{"first_name": "Ann"}]) == ["Ann: gender is required for Women."]
    assert _check(division={"id": "d", "name": "Open", "rules": {"gender": "any"}}, bowlers=[{"first_name": "Bob"}]) == []


def test_usbc_required_and_format():
    rules = {"usbcRequired": True}
    assert _check(event_rules=rules, bowlers=[{"first_name": "Ann", "usbc_number": "1234-56789"}]) == []
    assert _check(event_rules=rules, bowlers=[{"first_name": "Ann"}]) == ["Ann: a USBC number is required for this event."]
    assert _check(event_rules=rules, bowlers=[{"first_name": "Ann", "usbc_number": "abc"}]) == [
        "Ann: enter the USBC number like 1234-56789."
    ]
    assert is_valid_usbc_number("123456789")
    assert is_valid_usbc_number("12345 - 6789")
    assert not is_valid_usbc_number("12-34")
    assert not is_valid_usbc_number("1234-567-89")


def test_team_combined_average_cap_and_mixed():
    rules = {"team": {"combinedAverageMax": 400, "mixedRequired": True}}
    pair = [
        {"first_name": "Ann", "last_name": "Lee", "average": "210", "gender": "F"},
        {"first_name": "Bob", "last_name": "Ray", "average": "200", "gender": "F"},
    ]
    assert _check(event_rules=rules, bowlers=pair) == [
        "Combined average 410 is above this event's limit of 400.",
        "This event is mixed: include at least one man and one woman.",
    ]
    pair[1].update(average="190", gender="M")
    assert _check(event_rules=rules, bowlers=pair) == []
    pair[1].pop("gender")
    assert _check(event_rules=rules, bowlers=pair) == ["Bowler 2 (Bob Ray): gender is required for this mixed event."]


def test_gender_normalization_and_required_fields():
    assert [normalize_gender(value) for value in ("M", "female", "Women", "x", None)] == ["M", "F", "F", None, None]
    assert required_bowler_fields(
        {"rules": {"usbcRequired": True, "team": {"mixedRequired": True}}},
        {"minAge": 50, "maxAverage": 200},
    ) == {"usbc_number", "gender", "date_of_birth", "average"}
    assert required_bowler_fields({"rules": {}}, None) == set()


# --- Registration endpoint -----------------------------------------------------------------


def _setup() -> dict:
    return {
        "details": {"name": "Seniors Classic", "startDateIso": "2026-10-01"},
        "events": [{
            "id": "evt-singles", "name": "Singles", "enabled": True, "minPlayers": 1, "maxPlayers": 1,
            "connectedDivisionIds": ["div-seniors"], "connectedSquadIds": ["sq-am"], "entryFeeCents": 5000,
            "rules": {"usbcRequired": True},
        }],
        "divisions": [{
            "id": "div-seniors", "name": "Seniors", "enabled": True, "minAge": 50, "maxAverage": 200,
            "rules": {"gender": "any", "prizeType": "cash"},
        }],
        "squads": [{"id": "sq-am", "name": "AM", "dateIso": "2026-10-01", "startTime": "09:00"}],
        "fields": [
            {"key": "first_name", "label": "First Name", "mode": "required"},
            {"key": "last_name", "label": "Last Name", "mode": "required"},
            {"key": "email", "label": "Email", "mode": "required"},
            {"key": "average", "label": "Average", "mode": "optional"},
            {"key": "date_of_birth", "label": "Date of Birth", "mode": "optional"},
            {"key": "usbc_number", "label": "USBC Number", "mode": "optional"},
        ],
        "questions": [],
    }


def _tournament(db, owner_id: int) -> models.TournamentCentral:
    tournament = models.TournamentCentral(
        user_id=owner_id, name="Seniors Classic", location="Boise, ID", start_date="2026-10-01",
        end_date="2026-10-01", squad_times="{}", is_public=True, is_published=True,
    )
    db.add(tournament)
    db.commit()
    db.refresh(tournament)
    db.add(models.TournamentCentralSetupState(
        tournament_id=tournament.id, user_id=owner_id, payload=copy.deepcopy(_setup()), is_published=True,
    ))
    db.commit()
    return tournament


def _payload(bowler: dict, **form) -> dict:
    return {
        "tournamentId": "1",
        "tournamentName": "Seniors Classic",
        "submittedAt": datetime.now(timezone.utc).isoformat(),
        "form": {
            "firstName": bowler["first_name"], "lastName": bowler["last_name"], "email": bowler["email"],
            "bowlers": [bowler], "eventId": "evt-singles", "divisionId": "div-seniors", "squadId": "sq-am",
            "fieldValues": bowler, "acceptTerms": True, **form,
        },
    }


YOUNG = {"first_name": "Ann", "last_name": "Lee", "email": "ann@example.com", "average": "215", "date_of_birth": "1990-01-01"}
ELIGIBLE = {**YOUNG, "average": "190", "date_of_birth": "1960-05-05", "usbc_number": "1234-56789", "gender": "female"}


@pytest.fixture(autouse=True)
def _no_email(monkeypatch):
    monkeypatch.setattr(tc_emails, "_post_resend", lambda path, body: True)


def _submit(api_client, tournament, body, headers=None):
    return api_client.post(
        f"/api/v1/public/tc-tournament/{tournament.id}/registration", json=body, headers=headers or {},
    )


def test_ineligible_registration_is_rejected_with_every_problem(api_client, db_session, make_user):
    owner = make_user("elig_reject")
    tournament = _tournament(db_session, owner.id)

    response = _submit(api_client, tournament, _payload(YOUNG))

    assert response.status_code == 400
    detail = response.json()["detail"]
    assert "a USBC number is required for this event." in detail
    assert "average 215 is above the Seniors maximum of 200." in detail
    assert "must be at least 50 on the first day of the tournament for Seniors." in detail
    assert db_session.query(models.TcRegistration).count() == 0


def test_eligible_registration_is_saved_with_gender(api_client, db_session, make_user):
    owner = make_user("elig_ok")
    tournament = _tournament(db_session, owner.id)

    response = _submit(api_client, tournament, _payload(ELIGIBLE))

    assert response.status_code == 200, response.text
    bowler = db_session.query(models.TcRegistrationBowler).one()
    assert bowler.gender == "F"


def test_anonymous_override_is_refused(api_client, db_session, make_user):
    owner = make_user("elig_anon")
    tournament = _tournament(db_session, owner.id)

    response = _submit(api_client, tournament, _payload(YOUNG, override_eligibility=True))

    assert response.status_code == 401
    assert db_session.query(models.TcRegistration).count() == 0


def test_signed_in_bowler_cannot_override(api_client, db_session, make_user, make_auth_headers):
    owner = make_user("elig_owner_other")
    stranger = make_user("elig_stranger")
    tournament = _tournament(db_session, owner.id)

    response = _submit(api_client, tournament, _payload(YOUNG, override_eligibility=True), make_auth_headers(stranger))

    assert response.status_code == 403
    assert db_session.query(models.TcRegistration).count() == 0


def test_organizer_can_register_anyway(api_client, db_session, make_user, make_auth_headers):
    owner = make_user("elig_owner")
    tournament = _tournament(db_session, owner.id)

    response = _submit(api_client, tournament, _payload(YOUNG, override_eligibility=True), make_auth_headers(owner))

    assert response.status_code == 200, response.text
    registration = db_session.query(models.TcRegistration).one()
    assert registration.source == "organizer"


def test_custom_gender_question_answers_the_division_gender_rule(api_client, db_session, make_user):
    owner = make_user("elig_gender_question")
    tournament = _tournament(db_session, owner.id)
    state = db_session.query(models.TournamentCentralSetupState).filter_by(tournament_id=tournament.id).one()
    payload = copy.deepcopy(state.payload)
    payload["divisions"][0]["rules"] = {"gender": "women", "prizeType": "cash"}
    payload["questions"] = [{"id": "q-gender", "label": "Gender", "required": True, "enabled": True, "type": "dropdown"}]
    state.payload = payload
    db_session.commit()
    bowler = {key: value for key, value in ELIGIBLE.items() if key != "gender"}

    rejected = _submit(api_client, tournament, _payload(bowler, bowlerQuestionAnswers=[{"q-gender": "Man"}]))
    assert rejected.status_code == 400
    assert "Seniors is for women only." in rejected.json()["detail"]

    accepted = _submit(api_client, tournament, _payload(bowler, bowlerQuestionAnswers=[{"q-gender": "Woman"}]))
    assert accepted.status_code == 200, accepted.text
    assert db_session.query(models.TcRegistrationBowler).one().gender == "F"
