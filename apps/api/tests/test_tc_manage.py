"""Bowlers managing their own registration, and the change emails and history."""

from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse

import pytest

from app.core import models
from app.middleware.rate_limit import rate_limiter
from app.services import tc_emails, tc_manage_links
from tests.email_helpers import email_text, email_vars, template_id


@pytest.fixture()
def outbox(monkeypatch):
    calls: list[tuple[str, object]] = []
    monkeypatch.setattr(tc_emails, "_post_resend", lambda path, body: calls.append((path, body)) or True)
    return calls


def _messages(outbox) -> list[dict]:
    messages: list[dict] = []
    for path, body in outbox:
        messages.extend(body if path == "/emails/batch" else [body])
    return messages


def _to(outbox, address: str) -> list[dict]:
    return [message for message in _messages(outbox) if message["to"] == [address]]


def _setup(*, close_iso: str = "2099-12-30", capacity: int = 100) -> dict:
    return {
        "details": {
            "name": "Spring Doubles",
            "contactName": "Jamie Smith",
            "bowlingCenter": "Sunset Lanes",
            "city": "Boise",
            "state": "ID",
            "startDateIso": "2099-12-31",
            "endDateIso": "2099-12-31",
            "supportEmail": "director@example.com",
            "registrationOpenIso": "2020-01-01",
            "registrationCloseIso": close_iso,
            "timezone": "America/Denver",
        },
        "events": [{
            "id": "evt-doubles", "name": "Doubles", "enabled": True, "minPlayers": 2, "maxPlayers": 2,
            "requireDivision": False, "requireSquad": True, "connectedDivisionIds": [],
            "connectedSquadIds": ["sq-am", "sq-pm"], "entryFeeCents": 8000,
        }],
        "divisions": [],
        "squads": [
            {"id": "sq-am", "name": "Saturday AM", "dateIso": "2099-12-31", "startTime": "09:00",
             "requiredBowlerCount": 2, "capacity": capacity, "waitlistEnabled": True},
            {"id": "sq-pm", "name": "Saturday PM", "dateIso": "2099-12-31", "startTime": "13:00",
             "requiredBowlerCount": 2, "capacity": 100, "waitlistEnabled": True},
        ],
        "fields": [
            {"key": "first_name", "label": "First name", "mode": "required"},
            {"key": "last_name", "label": "Last name", "mode": "required"},
            {"key": "email", "label": "Email", "mode": "optional"},
            {"key": "phone", "label": "Phone", "mode": "optional"},
        ],
        "questions": [],
        "fees": [],
    }


def _tournament(db_session, owner_id: int, **setup) -> models.TournamentCentral:
    tournament = models.TournamentCentral(
        user_id=owner_id, name="Spring Doubles", location="Boise, ID", start_date="2099-12-31",
        end_date="2099-12-31", squad_times="{}", is_public=True, is_published=True,
    )
    db_session.add(tournament)
    db_session.commit()
    db_session.add(models.TournamentCentralSetupState(
        tournament_id=tournament.id, user_id=owner_id, payload=_setup(**setup), is_published=True,
    ))
    db_session.commit()
    db_session.refresh(tournament)
    return tournament


def _bowlers(first=("Ann", "Lee", "ann@example.com"), second=("Bo", "Ray", "bo@example.com")) -> list[dict]:
    return [
        {"first_name": first[0], "last_name": first[1], "email": first[2], "phone": "208-555-0100"},
        {"first_name": second[0], "last_name": second[1], "email": second[2]},
    ]


def _form(bowlers: list[dict], *, squad: str = "sq-am") -> dict:
    return {
        "firstName": bowlers[0]["first_name"],
        "lastName": bowlers[0]["last_name"],
        "email": bowlers[0].get("email", ""),
        "phone": bowlers[0].get("phone", ""),
        "bowlers": bowlers,
        "eventId": "evt-doubles",
        "divisionId": "",
        "squadId": squad,
        "notes": "",
        "bowlerQuestionAnswers": [{}, {}],
        "fieldValues": bowlers[0],
        "acceptTerms": True,
    }


def _register(api_client, tournament, bowlers=None, **form) -> str:
    response = api_client.post(
        f"/api/v1/public/tc-tournament/{tournament.id}/registration",
        json={"tournamentId": str(tournament.id), "tournamentName": tournament.name,
              "submittedAt": "2026-11-15T12:00:00Z", "form": _form(bowlers or _bowlers(), **form)},
    )
    assert response.status_code == 200, response.text
    return response.json()["registration_id"]


def _token_from(message: dict) -> str:
    match = re.search(r"/registration/manage\?token=([\w.]+)", email_text(message))
    assert match, email_text(message)
    return match.group(1)


def _registration(db_session, code: str) -> models.TcRegistration:
    db_session.expire_all()
    return db_session.query(models.TcRegistration).filter_by(confirmation_code=code).one()


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    rate_limiter._memory_store.clear()
    yield


def test_confirmation_has_a_personal_manage_link_for_each_person(api_client, db_session, make_user, outbox):
    tournament = _tournament(db_session, make_user("manage_links_owner").id)
    _register(api_client, tournament)
    ann_token = _token_from(_to(outbox, "ann@example.com")[0])
    bo_token = _token_from(_to(outbox, "bo@example.com")[0])
    assert ann_token != bo_token
    assert email_vars(_to(outbox, "ann@example.com")[0])["manage_url"].startswith("http")
    assert "Use Manage registration until December 30, 2099 at 11:59 PM MST" in email_text(_to(outbox, "ann@example.com")[0])

    page = api_client.get("/api/v1/public/tc-registration/manage", params={"token": bo_token})
    assert page.status_code == 200
    body = page.json()
    assert body["can_edit"] is True
    assert body["viewer"]["name"] == "Bo Ray"
    assert [bowler["first_name"] for bowler in body["form"]["bowlers"]] == ["Ann", "Bo"]
    assert body["form"]["squadId"] == "sq-am"


def test_a_bad_or_tampered_link_does_not_open_anything(api_client, db_session, make_user, outbox):
    tournament = _tournament(db_session, make_user("manage_bad_owner").id)
    _register(api_client, tournament)
    token = _token_from(_to(outbox, "ann@example.com")[0])
    for bad in ("", "nope", token[:-1] + ("0" if token[-1] != "0" else "1"), token.replace(".c.", ".b1.")):
        response = api_client.get("/api/v1/public/tc-registration/manage", params={"token": bad})
        assert response.status_code == 404


def test_bowler_changes_are_saved_emailed_and_kept_in_history(
    api_client, db_session, make_user, make_auth_headers, outbox
):
    owner = make_user("manage_change_owner")
    tournament = _tournament(db_session, owner.id)
    code = _register(api_client, tournament)
    token = _token_from(_to(outbox, "bo@example.com")[0])
    outbox.clear()

    bowlers = _bowlers()
    bowlers[1]["phone"] = "208-555-0123"
    response = api_client.put("/api/v1/public/tc-registration/manage",
                              json={"token": token, "form": _form(bowlers, squad="sq-pm")})
    assert response.status_code == 200, response.text
    assert response.json()["registration"]["squad_name"] == "Saturday PM"

    for address in ("ann@example.com", "bo@example.com"):
        [update] = _to(outbox, address)
        assert update["subject"] == "Registration updated: Spring Doubles"
        assert "Bo Ray changed registration" in email_text(update)
        assert "Squad: Saturday AM → Saturday PM" in email_text(update)
        assert "Bowler 2 phone: None → 208-555-0123" in email_text(update)
    [organizer] = _to(outbox, "director@example.com")
    assert "Squad: Saturday AM → Saturday PM" in email_text(organizer)

    registration = _registration(db_session, code)
    history = api_client.get(
        f"/api/v1/tc/tournaments/{tournament.id}/registrations/{registration.id}/changes",
        headers=make_auth_headers(owner),
    )
    assert history.status_code == 200
    [change] = history.json()["changes"]
    assert change["who"] == "Bo Ray"
    assert {item["label"] for item in change["items"]} == {"Squad", "Bowler 2 phone"}


def test_swapping_a_bowler_emails_both_and_ends_the_old_link(api_client, db_session, make_user, outbox):
    tournament = _tournament(db_session, make_user("manage_swap_owner").id)
    _register(api_client, tournament)
    ann_token = _token_from(_to(outbox, "ann@example.com")[0])
    bo_token = _token_from(_to(outbox, "bo@example.com")[0])
    outbox.clear()

    response = api_client.put("/api/v1/public/tc-registration/manage", json={
        "token": ann_token, "form": _form(_bowlers(second=("Cy", "Day", "cy@example.com"))),
    })
    assert response.status_code == 200, response.text

    [removed] = _to(outbox, "bo@example.com")
    assert removed["subject"] == "You're no longer on a registration: Spring Doubles"
    [new_bowler] = _to(outbox, "cy@example.com")
    assert "Bowler 2: Bo Ray → Cy Day" in email_text(new_bowler)
    assert _token_from(new_bowler) != bo_token
    assert api_client.get("/api/v1/public/tc-registration/manage", params={"token": bo_token}).status_code == 404
    assert api_client.get(
        "/api/v1/public/tc-registration/manage", params={"token": _token_from(new_bowler)}
    ).json()["viewer"]["name"] == "Cy Day"


def test_fixing_your_own_email_keeps_you_on_with_a_new_link(api_client, db_session, make_user, outbox):
    tournament = _tournament(db_session, make_user("manage_email_owner").id)
    _register(api_client, tournament)
    ann_token = _token_from(_to(outbox, "ann@example.com")[0])
    outbox.clear()

    response = api_client.put("/api/v1/public/tc-registration/manage", json={
        "token": ann_token, "form": _form(_bowlers(first=("Ann", "Lee", "ann.lee@example.com"))),
    })
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["viewer"] == {"name": "Ann Lee", "removed": False}
    assert body["token"] and body["token"] != ann_token
    assert _to(outbox, "ann@example.com") == []  # not told they were removed
    assert len(_to(outbox, "ann.lee@example.com")) == 1


def test_changes_close_at_the_cutoff(api_client, db_session, make_user, outbox):
    tournament = _tournament(db_session, make_user("manage_closed_owner").id)
    _register(api_client, tournament)
    token = _token_from(_to(outbox, "ann@example.com")[0])

    state = db_session.query(models.TournamentCentralSetupState).filter_by(tournament_id=tournament.id).one()
    payload = dict(state.payload)
    payload["details"] = {**payload["details"], "bowlerChangesCloseIso": "2020-01-01"}
    state.payload = payload
    db_session.commit()

    page = api_client.get("/api/v1/public/tc-registration/manage", params={"token": token}).json()
    assert page["can_edit"] is False
    assert page["changes_close_at"] == "January 1, 2020 at 11:59 PM MST"
    response = api_client.put("/api/v1/public/tc-registration/manage", json={"token": token, "form": _form(_bowlers())})
    assert response.status_code == 403
    assert "Contact the organizer" in response.json()["detail"]
    assert api_client.post("/api/v1/public/tc-registration/manage/cancel", json={"token": token}).status_code == 403


def test_bowlers_cannot_change_the_event(api_client, db_session, make_user, outbox):
    tournament = _tournament(db_session, make_user("manage_event_owner").id)
    _register(api_client, tournament)
    token = _token_from(_to(outbox, "ann@example.com")[0])
    form = _form(_bowlers())
    form["eventId"] = "evt-other"
    response = api_client.put("/api/v1/public/tc-registration/manage", json={"token": token, "form": form})
    assert response.status_code == 400
    assert "Only the organizer" in response.json()["detail"]


def test_cancelling_moves_the_next_team_off_the_waitlist(api_client, db_session, make_user, outbox):
    tournament = _tournament(db_session, make_user("manage_cancel_owner").id, capacity=2)
    first = _register(api_client, tournament)
    second = _register(api_client, tournament, bowlers=_bowlers(
        first=("Dee", "Fox", "dee@example.com"), second=("Eli", "Gray", "eli@example.com"),
    ))
    assert _registration(db_session, second).status == "waitlisted"
    token = _token_from(_to(outbox, "ann@example.com")[0])
    outbox.clear()

    response = api_client.post("/api/v1/public/tc-registration/manage/cancel", json={"token": token})
    assert response.status_code == 200, response.text
    assert response.json()["registration"]["status"] == "cancelled"
    assert response.json()["can_edit"] is False
    assert _registration(db_session, first).status == "cancelled"
    assert _registration(db_session, second).status == "confirmed"

    [cancelled] = _to(outbox, "bo@example.com")
    assert cancelled["subject"] == "Registration cancelled: Spring Doubles"
    [promoted] = [m for m in _to(outbox, "dee@example.com") if m["subject"] == "You're off the waitlist: Spring Doubles"]
    assert "Hi Dee," in email_text(promoted)
    assert "Total due at check-in: $80.00" in email_text(promoted)
    assert "Status:" not in email_text(promoted)
    assert template_id(promoted) == "tc-waitlist-promotion" and email_vars(promoted)["manage_url"]
    # Each person gets their own link, and it opens their registration.
    dee_token = _token_from(promoted)
    [eli_email] = [m for m in _to(outbox, "eli@example.com") if "off the waitlist" in m["subject"]]
    assert _token_from(eli_email) != dee_token
    page = api_client.get("/api/v1/public/tc-registration/manage", params={"token": dee_token}).json()
    assert page["registration"]["status"] == "confirmed"


def test_lost_link_email_lists_each_registration(api_client, db_session, make_user, outbox):
    tournament = _tournament(db_session, make_user("manage_lost_owner").id)
    _register(api_client, tournament)
    outbox.clear()

    response = api_client.post("/api/v1/public/tc-registration/manage-links", json={"email": "Bo@Example.com"})
    assert response.json() == {"ok": True}
    [message] = _to(outbox, "bo@example.com")
    assert message["subject"] == "Your Tournament Central registration links"
    token = parse_qs(urlparse(re.search(r"https?://\S+/registration/manage\?\S+", email_text(message)).group(0)).query)["token"][0]
    assert api_client.get("/api/v1/public/tc-registration/manage", params={"token": token}).json()["viewer"]["name"] == "Bo Ray"

    outbox.clear()
    assert api_client.post("/api/v1/public/tc-registration/manage-links", json={"email": "nobody@example.com"}).json() == {"ok": True}
    assert _messages(outbox) == []


def test_organizer_edits_email_the_bowlers(api_client, db_session, make_user, make_auth_headers, outbox):
    owner = make_user("manage_org_owner")
    tournament = _tournament(db_session, owner.id)
    code = _register(api_client, tournament)
    registration = _registration(db_session, code)
    entry = db_session.query(models.TcEntry).filter_by(registration_id=registration.id).one()
    outbox.clear()

    response = api_client.patch(
        f"/api/v1/tc/tournaments/{tournament.id}/entries/{entry.id}",
        json={"notes": "Needs lane 12"},
        headers=make_auth_headers(owner),
    )
    assert response.status_code == 200, response.text
    for address in ("ann@example.com", "bo@example.com"):
        [update] = _to(outbox, address)
        assert "The organizer changed registration" in email_text(update)
        assert "Notes: None → Needs lane 12" in email_text(update)

    outbox.clear()
    response = api_client.delete(
        f"/api/v1/tc/tournaments/{tournament.id}/entries/{entry.id}", headers=make_auth_headers(owner),
    )
    assert response.status_code == 200
    [cancelled] = _to(outbox, "ann@example.com")
    assert cancelled["subject"] == "Registration cancelled: Spring Doubles"


def test_cutoff_falls_back_to_registration_close_then_start_date(db_session, make_user):
    tournament = _tournament(db_session, make_user("manage_cutoff_owner").id, close_iso="2099-06-01")
    assert tc_manage_links.format_close(tc_manage_links.changes_close_at(db_session, tournament)) == "June 1, 2099 at 11:59 PM MDT"

    state = db_session.query(models.TournamentCentralSetupState).filter_by(tournament_id=tournament.id).one()
    payload = dict(state.payload)
    payload["details"] = {**payload["details"], "registrationCloseIso": "", "bowlerChangesCloseIso": ""}
    state.payload = payload
    db_session.commit()
    assert tc_manage_links.format_close(tc_manage_links.changes_close_at(db_session, tournament)) == "December 31, 2099 at 12:00 AM MST"


def test_bots_are_quietly_ignored(api_client, db_session, make_user, outbox):
    tournament = _tournament(db_session, make_user("manage_bot_owner").id)
    for extra in ({"company_website": "http://spam.example"}, {"fill_seconds": 0.4}):
        form = {**_form(_bowlers()), **extra}
        response = api_client.post(
            f"/api/v1/public/tc-tournament/{tournament.id}/registration",
            json={"tournamentId": str(tournament.id), "tournamentName": tournament.name,
                  "submittedAt": "2026-11-15T12:00:00Z", "form": form},
        )
        assert response.status_code == 200
        assert response.json()["registration_id"] == "Received"
    assert db_session.query(models.TcRegistration).filter_by(tournament_id=tournament.id).count() == 0
    assert _messages(outbox) == []

    # A person who took their time gets through.
    _register(api_client, tournament, **{})
    assert db_session.query(models.TcRegistration).filter_by(tournament_id=tournament.id).count() == 1

    outbox.clear()
    api_client.post("/api/v1/public/tc-registration/manage-links",
                    json={"email": "ann@example.com", "company_website": "x"})
    assert _messages(outbox) == []


# The variables each Resend template declares. An email may only send these.
RESEND_TEMPLATE_VARIABLES = {
    "tc-registration-confirmation": {"product_name", "site_url", "logo_url", "footer_note", "title", "greeting", "lead", "manage_url", "tournament_name", "tournament_dates", "tournament_location", "tournament_address", "confirmation_code", "registration_info", "bowlers", "entries", "side_events", "total_due", "fee_details", "closing"},
    "tc-waitlist-promotion": {"product_name", "site_url", "logo_url", "footer_note", "greeting", "lead", "manage_url", "tournament_name", "tournament_dates", "tournament_location", "tournament_address", "confirmation_code", "entries", "side_events", "total_due", "fee_details", "closing"},
    "tc-organizer-new-registration": {"product_name", "site_url", "logo_url", "footer_note", "lead", "registrations_url", "tournament_name", "contact_name", "confirmation_code", "registration_info", "contact_info", "bowler_details", "entries", "side_events", "total_due", "fee_details", "notes", "squad_count", "closing"},
    "tc-registration-updated": {"product_name", "site_url", "logo_url", "footer_note", "greeting", "lead", "manage_url", "tournament_name", "changes", "entries", "side_events", "total_due", "fee_details", "closing", "confirmation_code"},
    "tc-organizer-registration-updated": {"product_name", "site_url", "logo_url", "footer_note", "lead", "registrations_url", "tournament_name", "confirmation_code", "contact_name", "changes", "entries", "side_events", "total_due", "fee_details", "squad_count", "closing"},
    "tc-registration-cancelled": {"product_name", "site_url", "logo_url", "footer_note", "greeting", "lead", "tournament_name", "button_label", "button_url", "changes", "closing"},
    "tc-registration-removed": {"product_name", "site_url", "logo_url", "footer_note", "greeting", "lead", "tournament_name", "tournament_dates", "tournament_location", "tournament_address", "tournament_url", "closing"},
    "tc-registration-links": {"product_name", "site_url", "logo_url", "footer_note", "lead", "registrations", "closing"},
    "tc-organizer-message": {"product_name", "site_url", "logo_url", "footer_note", "message_subject", "tournament_name", "message"},
}


def test_every_email_uses_a_resend_template_and_only_its_declared_values(
    api_client, db_session, make_user, make_auth_headers, outbox
):
    owner = make_user("manage_templates_owner")
    tournament = _tournament(db_session, owner.id, capacity=2)
    _register(api_client, tournament)
    _register(api_client, tournament, bowlers=_bowlers(first=("Dee", "Fox", "dee@example.com"), second=("Eli", "Gray", "eli@example.com")))
    token = _token_from(_to(outbox, "ann@example.com")[0])
    api_client.put("/api/v1/public/tc-registration/manage", json={
        "token": token, "form": _form(_bowlers(second=("Cy", "Day", "cy@example.com"))),
    })
    api_client.post("/api/v1/public/tc-registration/manage-links", json={"email": "cy@example.com"})
    api_client.post("/api/v1/public/tc-registration/manage/cancel", json={"token": token})
    registration = db_session.query(models.TcRegistration).filter_by(tournament_id=tournament.id).first()
    tc_emails.send_organizer_message(db_session, tournament, ["ann@example.com"], subject="Oil pattern", body="Hi <all>")

    used = set()
    for message in _messages(outbox):
        assert "html" not in message and "text" not in message
        template = template_id(message)
        assert template in RESEND_TEMPLATE_VARIABLES, template
        assert set(email_vars(message)) <= RESEND_TEMPLATE_VARIABLES[template], (template, set(email_vars(message)) - RESEND_TEMPLATE_VARIABLES[template])
        used.add(template)
    assert registration is not None
    assert used == set(RESEND_TEMPLATE_VARIABLES)
