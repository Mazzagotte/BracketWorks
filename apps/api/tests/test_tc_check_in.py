from datetime import datetime, timezone

from app.core import models


def _tc_tournament(db, owner, name="TC Check-in Event"):
    tournament = models.TournamentCentral(user_id=owner.id, name=name, is_public=False)
    db.add(tournament)
    db.commit()
    db.refresh(tournament)
    return tournament


def _registered_bowler(db, tournament, *, code="CHK-1", first_name="Pat", last_name="Lane"):
    now = datetime.now(timezone.utc)
    registration = models.TcRegistration(
        confirmation_code=code,
        tournament_id=tournament.id,
        contact_first_name=first_name,
        contact_last_name=last_name,
        contact_email=f"{code.lower()}@example.com",
        status="confirmed",
        payment_status="unpaid",
        terms_accepted_at=now,
        submitted_at=now,
    )
    db.add(registration)
    db.flush()
    bowler = models.TcRegistrationBowler(
        registration_id=registration.id,
        tournament_id=tournament.id,
        first_name=first_name,
        last_name=last_name,
        usbc_number="123-456",
    )
    db.add(bowler)
    db.flush()
    entry = models.TcEntry(
        registration_id=registration.id,
        tournament_id=tournament.id,
        event_config_id="evt-singles",
        event_name_snapshot="Singles",
        squad_config_id="sq-am",
        squad_name_snapshot="Morning",
        status="confirmed",
    )
    db.add(entry)
    db.flush()
    db.add(models.TcEntryBowler(entry_id=entry.id, bowler_id=bowler.id, position=1))
    db.commit()
    db.refresh(bowler)
    return bowler


def _add_staff(db, tournament, user, role, invited_by):
    db.add(models.TcTournamentStaffMember(
        tournament_id=tournament.id,
        user_id=user.id,
        role=role,
        invited_by_user_id=invited_by.id,
    ))
    db.commit()


def _check_in_url(tournament_id, bowler_id):
    return f"/api/v1/tc/tournaments/{tournament_id}/bowlers/{bowler_id}/check-in"


def test_owner_can_check_in_and_undo(api_client, db_session, auth_identity):
    tournament = _tc_tournament(db_session, auth_identity.user)
    bowler = _registered_bowler(db_session, tournament)

    checked = api_client.put(
        _check_in_url(tournament.id, bowler.id),
        headers=auth_identity.headers,
        json={"checked_in": True},
    )
    assert checked.status_code == 200
    body = checked.json()
    assert body["bowler_id"] == bowler.id
    assert body["checked_in_at"]
    db_session.expire_all()
    stored = db_session.get(models.TcRegistrationBowler, bowler.id)
    assert stored.checked_in_at is not None
    assert stored.checked_in_by_user_id == auth_identity.user.id

    again = api_client.put(
        _check_in_url(tournament.id, bowler.id),
        headers=auth_identity.headers,
        json={"checked_in": True},
    )
    assert again.json()["checked_in_at"] == body["checked_in_at"]

    undone = api_client.put(
        _check_in_url(tournament.id, bowler.id),
        headers=auth_identity.headers,
        json={"checked_in": False},
    )
    assert undone.status_code == 200
    assert undone.json() == {"bowler_id": bowler.id, "checked_in_at": None}
    db_session.expire_all()
    stored = db_session.get(models.TcRegistrationBowler, bowler.id)
    assert stored.checked_in_at is None
    assert stored.checked_in_by_user_id is None


def test_entries_manager_can_check_in(api_client, db_session, auth_identity, make_user, make_auth_headers):
    tournament = _tc_tournament(db_session, auth_identity.user)
    bowler = _registered_bowler(db_session, tournament)
    manager = make_user("tc_check_in_manager")
    _add_staff(db_session, tournament, manager, "entries_manager", auth_identity.user)

    response = api_client.put(
        _check_in_url(tournament.id, bowler.id),
        headers=make_auth_headers(manager),
        json={"checked_in": True},
    )
    assert response.status_code == 200
    assert response.json()["checked_in_at"]


def test_viewer_scorer_and_other_user_cannot_check_in(
    api_client, db_session, auth_identity, make_user, make_auth_headers
):
    tournament = _tc_tournament(db_session, auth_identity.user)
    bowler = _registered_bowler(db_session, tournament)
    viewer = make_user("tc_check_in_viewer")
    scorer = make_user("tc_check_in_scorer")
    stranger = make_user("tc_check_in_stranger")
    _add_staff(db_session, tournament, viewer, "viewer", auth_identity.user)
    _add_staff(db_session, tournament, scorer, "scorer", auth_identity.user)

    for user in (viewer, scorer, stranger):
        response = api_client.put(
            _check_in_url(tournament.id, bowler.id),
            headers=make_auth_headers(user),
            json={"checked_in": True},
        )
        assert response.status_code == 403

    db_session.expire_all()
    assert db_session.get(models.TcRegistrationBowler, bowler.id).checked_in_at is None


def test_bowler_from_another_tournament_is_not_found(api_client, db_session, auth_identity):
    tournament = _tc_tournament(db_session, auth_identity.user)
    other = _tc_tournament(db_session, auth_identity.user, name="Other TC Event")
    other_bowler = _registered_bowler(db_session, other, code="CHK-OTHER")

    response = api_client.put(
        _check_in_url(tournament.id, other_bowler.id),
        headers=auth_identity.headers,
        json={"checked_in": True},
    )
    assert response.status_code == 404
    db_session.expire_all()
    assert db_session.get(models.TcRegistrationBowler, other_bowler.id).checked_in_at is None


def test_registrations_listing_includes_checked_in_at(api_client, db_session, auth_identity):
    tournament = _tc_tournament(db_session, auth_identity.user)
    bowler = _registered_bowler(db_session, tournament)

    def listed_bowler():
        listing = api_client.get(
            f"/api/v1/tc/tournaments/{tournament.id}/registrations",
            headers=auth_identity.headers,
        )
        assert listing.status_code == 200
        return listing.json()["registrations"][0]["entries"][0]["bowlers"][0]

    assert listed_bowler()["checked_in_at"] is None

    checked = api_client.put(
        _check_in_url(tournament.id, bowler.id),
        headers=auth_identity.headers,
        json={"checked_in": True},
    )
    assert listed_bowler()["checked_in_at"] == checked.json()["checked_in_at"]
