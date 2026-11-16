from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.core import models
from app.core.config import settings
from app.services import tc_emails
from tests.email_helpers import email_text, email_vars, template_id


@pytest.fixture()
def outbox(monkeypatch):
    """Capture every Resend call instead of sending. Each item is (path, body)."""
    calls: list[tuple[str, object]] = []

    def fake_post(path, body):
        calls.append((path, body))
        return True

    monkeypatch.setattr(tc_emails, "_post_resend", fake_post)
    return calls


def _messages(outbox) -> list[dict]:
    messages: list[dict] = []
    for path, body in outbox:
        messages.extend(body if path == "/emails/batch" else [body])
    return messages


def _setup_payload() -> dict:
    return {
        "details": {
            "name": "Fall Classic",
            "contactName": "Jamie Smith",
            "bowlingCenter": "Sunset Lanes",
            "city": "Boise",
            "state": "ID",
            "startDateIso": "2026-10-01",
            "endDateIso": "2026-10-02",
            "supportEmail": "Director@Example.com",
            "registrationOpenIso": "2026-01-01",
            "registrationCloseIso": "2026-09-30",
        },
        "events": [{
            "id": "evt-singles", "name": "Singles", "enabled": True, "minPlayers": 1, "maxPlayers": 1,
            "requireDivision": True, "requireSquad": True, "connectedDivisionIds": ["div-open"],
            "connectedSquadIds": ["sq-am"], "entryFeeCents": 6000,
        }],
        "divisions": [{"id": "div-open", "name": "Open", "enabled": True}],
        "squads": [{
            "id": "sq-am", "name": "Saturday AM", "dateIso": "2026-10-01", "startTime": "09:00",
            "requiredBowlerCount": 1, "capacity": 100, "waitlistEnabled": True,
        }],
        "fields": [
            {"key": "first_name", "label": "First name", "mode": "required"},
            {"key": "last_name", "label": "Last name", "mode": "required"},
            {"key": "email", "label": "Email", "mode": "required"},
        ],
        "questions": [],
    }


def _tournament(db_session, owner_id: int) -> models.TournamentCentral:
    tournament = models.TournamentCentral(
        user_id=owner_id, name="Fall Classic", location="Boise, ID", start_date="2026-10-01",
        end_date="2026-10-02", squad_times="{}", is_public=True, is_published=True,
    )
    db_session.add(tournament)
    db_session.commit()
    db_session.add(models.TournamentCentralSetupState(
        tournament_id=tournament.id, user_id=owner_id, payload=_setup_payload(), is_published=True,
    ))
    db_session.commit()
    db_session.refresh(tournament)
    return tournament


def _registration(
    db_session,
    tournament: models.TournamentCentral,
    code: str,
    *,
    contact_email: str,
    status: str = "confirmed",
    payment_status: str = "unpaid",
    bowler_emails: tuple[str | None, ...] = (),
    squad_id: str = "sq-am",
    entry_status: str | None = None,
) -> models.TcRegistration:
    now = datetime.now(timezone.utc)
    registration = models.TcRegistration(
        confirmation_code=code, tournament_id=tournament.id, contact_first_name="Pat",
        contact_last_name=code, contact_email=contact_email, status=status, payment_status=payment_status,
        subtotal_cents=6000, fees_cents=0, total_cents=6000, currency="USD", terms_accepted_at=now,
        submitted_at=now, source="public",
    )
    db_session.add(registration)
    db_session.flush()
    entry = models.TcEntry(
        registration_id=registration.id, tournament_id=tournament.id, event_config_id="evt-singles",
        event_name_snapshot="Singles", division_config_id="div-open", division_name_snapshot="Open",
        squad_config_id=squad_id, squad_name_snapshot="Saturday AM" if squad_id == "sq-am" else "Sunday PM",
        squad_date_snapshot="2026-10-01", squad_time_snapshot="09:00", status=entry_status or status,
        entry_fee_cents=6000,
    )
    db_session.add(entry)
    db_session.flush()
    for position, email in enumerate(bowler_emails, start=1):
        bowler = models.TcRegistrationBowler(
            registration_id=registration.id, tournament_id=tournament.id, first_name="Bowler",
            last_name=str(position), email=email,
        )
        db_session.add(bowler)
        db_session.flush()
        db_session.add(models.TcEntryBowler(entry_id=entry.id, bowler_id=bowler.id, position=position))
    db_session.commit()
    db_session.refresh(registration)
    return registration


@pytest.fixture()
def roster(db_session, make_user):
    owner = make_user("tc_messages_owner")
    tournament = _tournament(db_session, owner.id)
    _registration(db_session, tournament, "FC-1", contact_email="Alex@Example.com",
                  bowler_emails=("alex@example.com", "sam@example.com"))
    _registration(db_session, tournament, "FC-2", contact_email="sam@EXAMPLE.com", payment_status="paid",
                  squad_id="sq-pm")
    _registration(db_session, tournament, "FC-3", contact_email="wait@example.com", status="waitlisted")
    _registration(db_session, tournament, "FC-4", contact_email="gone@example.com", status="cancelled")
    _registration(db_session, tournament, "FC-5", contact_email="refund@example.com", status="refunded",
                  payment_status="refunded")
    _registration(db_session, tournament, "FC-6", contact_email="pending@example.com", status="pending",
                  bowler_emails=(None, "", "not-an-email"))
    return owner, tournament


@pytest.mark.parametrize(
    ("body", "expected"),
    [
        ({"audience": "all"}, 4),  # alex, sam, wait, pending; cancelled and refunded excluded
        ({"audience": "unpaid"}, 4),  # alex, sam (bowler on FC-1), wait, pending
        ({"audience": "waitlisted"}, 1),
        ({"audience": "squad", "squad_config_id": "sq-pm"}, 1),
        ({"audience": "squad", "squad_config_id": "sq-am"}, 4),
        ({"audience": "squad", "squad_config_id": "sq-none"}, 0),
    ],
)
def test_preview_counts_unique_recipients(api_client, make_auth_headers, roster, body, expected):
    owner, tournament = roster
    response = api_client.post(
        f"/api/v1/tc/tournaments/{tournament.id}/messages/preview",
        headers=make_auth_headers(owner),
        json=body,
    )
    assert response.status_code == 200
    assert response.json()["recipient_count"] == expected


def test_audience_emails_are_deduplicated_case_insensitively(db_session, roster):
    _, tournament = roster
    emails = tc_emails.resolve_audience_emails(db_session, tournament.id, "all")
    assert emails == ["alex@example.com", "sam@example.com", "wait@example.com", "pending@example.com"]


def test_squad_audience_requires_a_squad(api_client, make_auth_headers, roster):
    owner, tournament = roster
    response = api_client.post(
        f"/api/v1/tc/tournaments/{tournament.id}/messages/preview",
        headers=make_auth_headers(owner),
        json={"audience": "squad"},
    )
    assert response.status_code == 400


def test_send_message_sends_one_private_email_per_recipient(api_client, make_auth_headers, roster, outbox):
    owner, tournament = roster
    response = api_client.post(
        f"/api/v1/tc/tournaments/{tournament.id}/messages",
        headers=make_auth_headers(owner),
        json={"audience": "all", "subject": "Lane draw\nis posted", "body": "Hi all,\n\nSee you <Saturday>."},
    )
    assert response.status_code == 200
    assert response.json() == {"sent": 4, "failed": 0}
    messages = _messages(outbox)
    assert sorted(message["to"][0] for message in messages) == [
        "alex@example.com", "pending@example.com", "sam@example.com", "wait@example.com",
    ]
    for message in messages:
        assert len(message["to"]) == 1
        assert "cc" not in message and "bcc" not in message
        assert message["subject"] == "Lane draw is posted"
        assert message["reply_to"] == "director@example.com"
        assert "See you <Saturday>." in email_text(message)
        assert "&lt;Saturday&gt;" in message["template"]["variables"]["message"]


def test_send_message_reports_failures(api_client, make_auth_headers, roster, monkeypatch):
    owner, tournament = roster
    monkeypatch.setattr(tc_emails, "_post_resend", lambda path, body: False)
    response = api_client.post(
        f"/api/v1/tc/tournaments/{tournament.id}/messages",
        headers=make_auth_headers(owner),
        json={"audience": "waitlisted", "subject": "Update", "body": "Hello"},
    )
    assert response.status_code == 200
    assert response.json() == {"sent": 0, "failed": 1}


def test_send_message_rejects_audiences_over_the_limit(api_client, make_auth_headers, roster, outbox, monkeypatch):
    owner, tournament = roster
    monkeypatch.setattr(settings, "TC_MESSAGE_MAX_RECIPIENTS", 2)
    response = api_client.post(
        f"/api/v1/tc/tournaments/{tournament.id}/messages",
        headers=make_auth_headers(owner),
        json={"audience": "all", "subject": "Update", "body": "Hello"},
    )
    assert response.status_code == 400
    assert outbox == []


@pytest.mark.parametrize("body", [
    {"audience": "all", "subject": "", "body": "Hello"},
    {"audience": "all", "subject": "Hi", "body": "   "},
    {"audience": "all", "subject": "x" * 151, "body": "Hello"},
    {"audience": "all", "subject": "Hi", "body": "x" * 5001},
    {"audience": "everyone", "subject": "Hi", "body": "Hello"},
])
def test_send_message_validates_input(api_client, make_auth_headers, roster, outbox, body):
    owner, tournament = roster
    response = api_client.post(
        f"/api/v1/tc/tournaments/{tournament.id}/messages",
        headers=make_auth_headers(owner),
        json=body,
    )
    assert response.status_code == 422
    assert outbox == []


@pytest.mark.parametrize("role", ["viewer", "scorer", None])
def test_messages_require_manage_entries_permission(api_client, db_session, make_user, make_auth_headers, roster, outbox, role):
    owner, tournament = roster
    other = make_user(f"tc_messages_{role or 'stranger'}")
    if role:
        db_session.add(models.TcTournamentStaffMember(
            tournament_id=tournament.id, user_id=other.id, role=role, invited_by_user_id=owner.id,
        ))
        db_session.commit()
    registration = db_session.query(models.TcRegistration).filter_by(confirmation_code="FC-3").one()
    headers = make_auth_headers(other)
    base = f"/api/v1/tc/tournaments/{tournament.id}"
    assert api_client.post(f"{base}/messages/preview", headers=headers, json={"audience": "all"}).status_code == 403
    assert api_client.post(
        f"{base}/messages", headers=headers, json={"audience": "all", "subject": "Hi", "body": "Hello"},
    ).status_code == 403
    assert api_client.post(f"{base}/registrations/{registration.id}/resend-confirmation", headers=headers).status_code == 403
    assert api_client.post(
        f"{base}/registrations/{registration.id}/promote", headers=headers, json={"notify": True},
    ).status_code == 403
    assert outbox == []
    db_session.refresh(registration)
    assert registration.status == "waitlisted"


def test_entries_manager_can_preview(api_client, db_session, make_user, make_auth_headers, roster):
    owner, tournament = roster
    manager = make_user("tc_messages_manager")
    db_session.add(models.TcTournamentStaffMember(
        tournament_id=tournament.id, user_id=manager.id, role="entries_manager", invited_by_user_id=owner.id,
    ))
    db_session.commit()
    response = api_client.post(
        f"/api/v1/tc/tournaments/{tournament.id}/messages/preview",
        headers=make_auth_headers(manager),
        json={"audience": "waitlisted"},
    )
    assert response.status_code == 200
    assert response.json()["recipient_count"] == 1


def test_promote_confirms_registration_and_entries_and_notifies(api_client, db_session, make_auth_headers, roster, outbox):
    owner, tournament = roster
    registration = _registration(
        db_session, tournament, "FC-7", contact_email="next@example.com", status="waitlisted",
        bowler_emails=("NEXT@example.com", "partner@example.com"),
    )
    response = api_client.post(
        f"/api/v1/tc/tournaments/{tournament.id}/registrations/{registration.id}/promote",
        headers=make_auth_headers(owner),
        json={"notify": True},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "confirmed"
    assert payload["notified"] is True
    assert [entry["status"] for entry in payload["entries"]] == ["confirmed"]
    db_session.expire_all()
    assert db_session.get(models.TcRegistration, registration.id).status == "confirmed"
    assert {entry.status for entry in db_session.query(models.TcEntry).filter_by(registration_id=registration.id)} == {"confirmed"}
    messages = _messages(outbox)
    assert sorted(message["to"][0] for message in messages) == ["next@example.com", "partner@example.com"]
    assert "off the waitlist" in messages[0]["subject"]
    assert "FC-7" in email_text(messages[0])


def test_promote_without_notify_sends_nothing(api_client, db_session, make_auth_headers, roster, outbox):
    owner, tournament = roster
    registration = db_session.query(models.TcRegistration).filter_by(confirmation_code="FC-3").one()
    response = api_client.post(
        f"/api/v1/tc/tournaments/{tournament.id}/registrations/{registration.id}/promote",
        headers=make_auth_headers(owner),
        json={"notify": False},
    )
    assert response.status_code == 200
    assert response.json()["notified"] is False
    assert outbox == []


def test_promote_still_succeeds_when_email_fails(api_client, db_session, make_auth_headers, roster, monkeypatch):
    owner, tournament = roster

    def broken(*_args, **_kwargs):
        raise RuntimeError("provider down")

    monkeypatch.setattr(tc_emails, "_post_resend", broken)
    registration = db_session.query(models.TcRegistration).filter_by(confirmation_code="FC-3").one()
    response = api_client.post(
        f"/api/v1/tc/tournaments/{tournament.id}/registrations/{registration.id}/promote",
        headers=make_auth_headers(owner),
        json={"notify": True},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "confirmed"
    assert response.json()["notified"] is False


@pytest.mark.parametrize("code", ["FC-1", "FC-4", "FC-6"])
def test_promote_rejects_registrations_that_are_not_waitlisted(api_client, db_session, make_auth_headers, roster, outbox, code):
    owner, tournament = roster
    registration = db_session.query(models.TcRegistration).filter_by(confirmation_code=code).one()
    previous_status = registration.status
    response = api_client.post(
        f"/api/v1/tc/tournaments/{tournament.id}/registrations/{registration.id}/promote",
        headers=make_auth_headers(owner),
        json={"notify": True},
    )
    assert response.status_code == 409
    db_session.expire_all()
    assert db_session.get(models.TcRegistration, registration.id).status == previous_status
    assert outbox == []


def test_promote_and_resend_are_scoped_to_the_tournament(api_client, db_session, make_user, make_auth_headers, roster, outbox):
    owner, tournament = roster
    other_owner = make_user("tc_messages_other_owner")
    other_tournament = _tournament(db_session, other_owner.id)
    registration = db_session.query(models.TcRegistration).filter_by(confirmation_code="FC-3").one()
    base = f"/api/v1/tc/tournaments/{other_tournament.id}/registrations/{registration.id}"
    headers = make_auth_headers(other_owner)
    assert api_client.post(f"{base}/promote", headers=headers, json={"notify": True}).status_code == 404
    assert api_client.post(f"{base}/resend-confirmation", headers=headers).status_code == 404
    assert outbox == []


def test_resend_confirmation_sends_details_to_everyone_on_the_registration(
    api_client, db_session, make_auth_headers, roster, outbox
):
    owner, tournament = roster
    registration = db_session.query(models.TcRegistration).filter_by(confirmation_code="FC-1").one()
    response = api_client.post(
        f"/api/v1/tc/tournaments/{tournament.id}/registrations/{registration.id}/resend-confirmation",
        headers=make_auth_headers(owner),
    )
    assert response.status_code == 200
    assert response.json() == {"sent": True}
    messages = _messages(outbox)
    # The contact, then each bowler with a new address: alex@ is both, so it gets one email.
    assert [message["to"] for message in messages] == [["alex@example.com"], ["sam@example.com"]]
    for message in messages:
        assert message["from"] == "Tournament Central <no-reply@tournamentcentral.app>"
        assert message["reply_to"] == "director@example.com"
    text = email_text(messages[0])
    for expected in (
        "FC-1", "Fall Classic", "October 1, 2026 to October 2, 2026", "Sunset Lanes, Boise, ID",
        "Singles (Open), squad: Saturday AM October 1, 2026 9:00 AM", "Total due at check-in: $60.00",
        "Questions? Contact Jamie Smith at director@example.com", "Bowler 1", "Bowler 2",
        f"/?tournament=tc-{tournament.id}",
    ):
        assert expected in text
    for removed in ("Payment", "Status:", "- Confirmed", "Organizer email:"):
        assert removed not in text
    assert "Your registration for Fall Classic is confirmed." in text
    assert "Pat FC-1 registered you for Fall Classic." in email_text(messages[1])


def test_resend_confirmation_reports_failure(api_client, db_session, make_auth_headers, roster, monkeypatch):
    owner, tournament = roster
    monkeypatch.setattr(tc_emails, "_post_resend", lambda path, body: False)
    registration = db_session.query(models.TcRegistration).filter_by(confirmation_code="FC-1").one()
    response = api_client.post(
        f"/api/v1/tc/tournaments/{tournament.id}/registrations/{registration.id}/resend-confirmation",
        headers=make_auth_headers(owner),
    )
    assert response.status_code == 200
    assert response.json() == {"sent": False}


def test_waitlisted_confirmation_says_waitlist(db_session, roster):
    _, tournament = roster
    registration = db_session.query(models.TcRegistration).filter_by(confirmation_code="FC-3").one()
    message = tc_emails.build_registration_confirmation(db_session, registration)
    assert message is not None
    assert "waitlist" in email_text(message)
    assert "Status: Waitlisted" in email_text(message)


def test_configured_template_id_is_used(db_session, roster, monkeypatch):
    _, tournament = roster
    monkeypatch.setattr(settings, "TC_REGISTRATION_CONFIRMATION_TEMPLATE_ID", "tc-confirmation")
    registration = db_session.query(models.TcRegistration).filter_by(confirmation_code="FC-1").one()
    message = tc_emails.build_registration_confirmation(db_session, registration)
    assert message["template"]["id"] == "tc-confirmation"
    assert message["template"]["variables"]["confirmation_code"] == "FC-1"
    assert "html" not in message


def _public_submission() -> dict:
    bowler = {"first_name": "Riley", "last_name": "Lane", "email": "Riley@Example.com"}
    return {
        "tournamentId": "1",
        "tournamentName": "Fall Classic",
        "submittedAt": datetime.now(timezone.utc).isoformat(),
        "form": {
            "firstName": "Riley", "lastName": "Lane", "email": "Riley@Example.com", "phone": "", "usbcNumber": "",
            "bowlers": [bowler], "eventId": "evt-singles", "divisionId": "div-open", "squadId": "sq-am",
            "notes": "", "questionAnswers": {}, "bowlerQuestionAnswers": [{}], "fieldValues": bowler,
            "acceptTerms": True,
        },
    }


def test_public_submission_sends_confirmation(api_client, db_session, make_user, outbox):
    owner = make_user("tc_messages_public")
    tournament = _tournament(db_session, owner.id)
    response = api_client.post(f"/api/v1/public/tc-tournament/{tournament.id}/registration", json=_public_submission())
    assert response.status_code == 200
    code = response.json()["registration_id"]
    messages = [message for message in _messages(outbox) if message["to"] == ["riley@example.com"]]
    assert len(messages) == 1
    message = messages[0]
    assert code in email_text(message)
    assert "Registration confirmed" in email_text(message)
    assert "Status:" not in email_text(message)


def _set_notice_details(db_session, tournament, **details) -> None:
    state = db_session.query(models.TournamentCentralSetupState).filter_by(tournament_id=tournament.id).one()
    payload = dict(state.payload)
    payload["details"] = {**payload["details"], **details}
    state.payload = payload
    db_session.commit()


def test_public_submission_emails_the_organizer_by_default(api_client, db_session, make_user, outbox):
    owner = make_user("tc_notice_on")
    tournament = _tournament(db_session, owner.id)
    response = api_client.post(f"/api/v1/public/tc-tournament/{tournament.id}/registration", json=_public_submission())
    assert response.status_code == 200
    code = response.json()["registration_id"]
    notices = [message for message in _messages(outbox) if message["to"] == ["director@example.com"]]
    assert len(notices) == 1
    notice = notices[0]
    assert notice["subject"] == "New registration: Riley Lane - Fall Classic"
    assert notice["reply_to"] == "riley@example.com"
    for expected in (code, "Riley Lane", "riley@example.com", "Singles (Open)", "$60.00", "Bowler 1",
                     f"/organizer/tournaments/{tournament.id}/registrations"):
        assert expected in email_text(notice)


def test_old_off_setting_does_not_stop_the_organizer_email(db_session, make_user):
    owner = make_user("tc_notice_legacy")
    tournament = _tournament(db_session, owner.id)
    _set_notice_details(db_session, tournament, registrationNotifications=False)
    assert tc_emails.organizer_notice_recipient(db_session, tournament) == "director@example.com"


def test_public_submission_skips_the_organizer_when_turned_off(api_client, db_session, make_user, outbox):
    owner = make_user("tc_notice_off")
    tournament = _tournament(db_session, owner.id)
    _set_notice_details(db_session, tournament, registrationNotificationsOff=True)
    response = api_client.post(f"/api/v1/public/tc-tournament/{tournament.id}/registration", json=_public_submission())
    assert response.status_code == 200
    assert [message["to"] for message in _messages(outbox)] == [["riley@example.com"]]


def test_organizer_notice_lists_every_sign_up_detail(db_session, make_user):
    owner = make_user("tc_notice_full")
    tournament = _tournament(db_session, owner.id)
    now = datetime.now(timezone.utc)
    registration = models.TcRegistration(
        confirmation_code="FULL-0001", tournament_id=tournament.id, contact_first_name="Ann",
        contact_last_name="Lee", contact_email="ann@example.com", contact_phone="208-555-0100",
        status="confirmed", payment_status="unpaid", subtotal_cents=8000, fees_cents=0, total_cents=8000,
        notes="Lefty, needs lane 12", terms_accepted_at=now, submitted_at=now,
    )
    db_session.add(registration)
    db_session.flush()
    ann = models.TcRegistrationBowler(
        registration_id=registration.id, tournament_id=tournament.id, first_name="Ann", last_name="Lee",
        email="ann@example.com", phone="208-555-0100", usbc_number="123-4567", average=187,
        date_of_birth="1990-04-02", gender="F", address="1 Main St", city="Boise", state="ID", zip_code="83702",
    )
    bo = models.TcRegistrationBowler(
        registration_id=registration.id, tournament_id=tournament.id, first_name="Bo", last_name="Ray",
    )
    db_session.add_all([ann, bo])
    db_session.flush()
    entry = models.TcEntry(
        registration_id=registration.id, tournament_id=tournament.id, event_config_id="doubles",
        event_name_snapshot="Doubles", squad_config_id="sat-9", squad_name_snapshot="Saturday, February 27, 2027 - 9:00 AM",
        squad_date_snapshot="2027-02-27", squad_time_snapshot="09:00", status="confirmed", entry_fee_cents=8000,
    )
    db_session.add(entry)
    db_session.flush()
    db_session.add_all([
        models.TcEntryBowler(entry_id=entry.id, bowler_id=ann.id, position=1),
        models.TcEntryBowler(entry_id=entry.id, bowler_id=bo.id, position=2),
        models.TcRegistrationAnswer(registration_id=registration.id, entry_id=entry.id, bowler_id=ann.id,
                                    question_config_id="shirt", question_label_snapshot="Shirt size",
                                    answer_json={"value": "M"}),
        models.TcRegistrationAnswer(registration_id=registration.id, entry_id=entry.id, bowler_id=ann.id,
                                    question_config_id="shirt", question_label_snapshot="Shirt size",
                                    answer_json={"value": "M"}),
    ])
    db_session.commit()

    text = email_text(tc_emails.build_organizer_registration_notice(db_session, registration))
    for expected in (
        "registered 2 bowlers", "Phone: 208-555-0100", "Bowler 1", "USBC number: 123-4567", "Average: 187",
        "Date of birth: April 2, 1990", "Gender: Female", "Address: 1 Main St, Boise, ID 83702",
        "Bowler 2: Bo Ray", "Lefty, needs lane 12",
        "Doubles, squad: Saturday, February 27, 2027 - 9:00 AM for Ann Lee and Bo Ray",
        "Saturday, February 27, 2027 - 9:00 AM: 2 bowlers", "Total due at check-in: $80.00",
    ):
        assert expected in text, expected
    assert text.count("Shirt size: M") == 1
    # Ann registered herself with the same email and phone, so the Contact section doesn't repeat her.
    notice_vars = email_vars(tc_emails.build_organizer_registration_notice(db_session, registration))
    assert notice_vars["contact_info"] == "Same as the bowler with this name below"
    assert notice_vars["registration_info"] == ""
    for removed in ("Submitted", "Status:", "Payment", "- Confirmed"):
        assert removed not in text, removed


def test_organizer_notice_address_falls_back_in_order(db_session, make_user):
    owner = make_user("tc_notice_fallback")
    tournament = _tournament(db_session, owner.id)
    _set_notice_details(db_session, tournament, registrationNotificationsOff=True)
    assert tc_emails.organizer_notice_recipient(db_session, tournament) is None

    _set_notice_details(db_session, tournament, registrationNotificationsOff=False,
                        registrationNotificationEmail="Inbox@Example.com")
    assert tc_emails.organizer_notice_recipient(db_session, tournament) == "inbox@example.com"

    _set_notice_details(db_session, tournament, registrationNotificationEmail="", supportEmail="")
    assert tc_emails.organizer_notice_recipient(db_session, tournament) == owner.email.lower()


def test_public_submission_succeeds_when_sending_raises(api_client, db_session, make_user, monkeypatch):
    owner = make_user("tc_messages_public_fail")
    tournament = _tournament(db_session, owner.id)

    def broken(*_args, **_kwargs):
        raise RuntimeError("provider down")

    monkeypatch.setattr(tc_emails, "_post_resend", broken)
    response = api_client.post(f"/api/v1/public/tc-tournament/{tournament.id}/registration", json=_public_submission())
    assert response.status_code == 200
    assert db_session.query(models.TcRegistration).filter_by(tournament_id=tournament.id).count() == 1


def test_public_submission_succeeds_when_building_the_email_raises(api_client, db_session, make_user, monkeypatch):
    owner = make_user("tc_messages_public_build_fail")
    tournament = _tournament(db_session, owner.id)

    def broken(*_args, **_kwargs):
        raise RuntimeError("bad template data")

    monkeypatch.setattr(tc_emails, "build_registration_confirmation", broken)
    response = api_client.post(f"/api/v1/public/tc-tournament/{tournament.id}/registration", json=_public_submission())
    assert response.status_code == 200
    assert db_session.query(models.TcRegistration).filter_by(tournament_id=tournament.id).count() == 1


def test_organizer_notice_shows_contact_and_squad_capacity_when_useful(db_session, make_user):
    owner = make_user("tc_notice_capacity")
    tournament = _tournament(db_session, owner.id)
    state = db_session.query(models.TournamentCentralSetupState).filter_by(tournament_id=tournament.id).one()
    payload = dict(state.payload)
    payload["squads"] = [{"id": "sat-am", "name": "Saturday AM", "capacity": 40}]
    state.payload = payload
    db_session.commit()

    now = datetime.now(timezone.utc)
    registration = models.TcRegistration(
        confirmation_code="CAP-0001", tournament_id=tournament.id, contact_first_name="Pat",
        contact_last_name="Parent", contact_email="pat@example.com", contact_phone="208-555-0199",
        status="waitlisted", payment_status="unpaid", subtotal_cents=3000, fees_cents=0, total_cents=3000,
        terms_accepted_at=now, submitted_at=now,
    )
    db_session.add(registration)
    db_session.flush()
    kid = models.TcRegistrationBowler(
        registration_id=registration.id, tournament_id=tournament.id, first_name="Kit", last_name="Parent",
    )
    db_session.add(kid)
    db_session.flush()
    entry = models.TcEntry(
        registration_id=registration.id, tournament_id=tournament.id, event_config_id="singles",
        event_name_snapshot="Singles", squad_config_id="sat-am", squad_name_snapshot="Saturday AM",
        status="waitlisted", entry_fee_cents=3000,
    )
    db_session.add(entry)
    db_session.flush()
    db_session.add(models.TcEntryBowler(entry_id=entry.id, bowler_id=kid.id, position=1))
    db_session.commit()

    text = email_text(tc_emails.build_organizer_registration_notice(db_session, registration))
    assert email_vars(tc_emails.build_organizer_registration_notice(db_session, registration))["contact_info"] == (
        "Name: Pat Parent\nEmail: pat@example.com\nPhone: 208-555-0199"
    )
    for expected in ("Status: Waitlisted",
                     "Singles, squad: Saturday AM - Waitlisted", "Saturday AM: 0 of 40 spots filled, 1 on the waitlist"):
        assert expected in text, expected

    confirmation = email_text(tc_emails.build_registration_confirmation(db_session, registration))
    assert "Registered by: Pat Parent" in confirmation
    assert "Status: Waitlisted" in confirmation
