from datetime import datetime, timezone

from app.core import models


def _tc_tournament(db, owner, name="TC Staff Event"):
    tournament = models.TournamentCentral(user_id=owner.id, name=name, is_public=False)
    db.add(tournament)
    db.commit()
    db.refresh(tournament)
    return tournament


def test_tc_owner_can_invite_and_invitee_can_accept_and_access(
    api_client, db_session, auth_identity, make_user, make_auth_headers
):
    tournament = _tc_tournament(db_session, auth_identity.user)
    invitee = make_user("tc_team_invitee")
    invitee.email_verified_at = datetime.now(timezone.utc)
    db_session.commit()
    invitee_headers = make_auth_headers(invitee)

    invited = api_client.post(
        f"/api/v1/tc/tournaments/{tournament.id}/staff-invitations",
        headers=auth_identity.headers,
        json={"email": invitee.email, "role": "entries_manager"},
    )
    assert invited.status_code == 201
    assert invited.json()["email_sent"] is False

    mine = api_client.get("/api/v1/tc/staff-invitations/mine", headers=invitee_headers)
    assert mine.status_code == 200
    assert mine.json()[0]["tournament_name"] == tournament.name

    accepted = api_client.post(
        f"/api/v1/tc/staff-invitations/{invited.json()['id']}/accept",
        headers=invitee_headers,
        json={},
    )
    assert accepted.status_code == 200
    assert db_session.query(models.TcTournamentStaffMember).filter_by(
        tournament_id=tournament.id, user_id=invitee.id, role="entries_manager"
    ).one()

    detail = api_client.get(
        f"/api/v1/tc/tournaments/{tournament.id}",
        headers=invitee_headers,
    )
    assert detail.status_code == 200
    assert detail.json()["name"] == tournament.name

    my_tournaments = api_client.get("/api/v1/tc/tournaments/", headers=invitee_headers)
    assert my_tournaments.status_code == 200
    assert [row["id"] for row in my_tournaments.json()] == [tournament.id]


def test_tc_viewer_can_read_but_cannot_manage_tournament(
    api_client, db_session, auth_identity, make_user, make_auth_headers
):
    tournament = _tc_tournament(db_session, auth_identity.user)
    viewer = make_user("tc_viewer")
    db_session.add(models.TcTournamentStaffMember(
        tournament_id=tournament.id,
        user_id=viewer.id,
        role="viewer",
        invited_by_user_id=auth_identity.user.id,
    ))
    db_session.commit()
    headers = make_auth_headers(viewer)

    listed = api_client.get(f"/api/v1/tc/tournaments/{tournament.id}/staff", headers=headers)
    updated = api_client.put(
        f"/api/v1/tc/tournaments/{tournament.id}",
        headers=headers,
        json={"name": "Changed", "squad_times": {}},
    )

    assert listed.status_code == 200
    assert listed.json()["can_manage_staff"] is False
    assert updated.status_code == 403


def test_tc_entries_manager_can_manage_entries_but_not_tournament_settings(
    api_client, db_session, auth_identity, make_user, make_auth_headers
):
    tournament = _tc_tournament(db_session, auth_identity.user)
    manager = make_user("tc_entries_manager")
    db_session.add(models.TcTournamentStaffMember(
        tournament_id=tournament.id,
        user_id=manager.id,
        role="entries_manager",
        invited_by_user_id=auth_identity.user.id,
    ))
    db_session.commit()
    headers = make_auth_headers(manager)

    entry_update = api_client.patch(
        f"/api/v1/tc/tournaments/{tournament.id}/registrations/999",
        headers=headers,
        json={"status": "confirmed"},
    )
    tournament_update = api_client.put(
        f"/api/v1/tc/tournaments/{tournament.id}",
        headers=headers,
        json={"name": "Changed", "squad_times": {}},
    )

    assert entry_update.status_code == 404
    assert tournament_update.status_code == 403


def test_tc_staff_routes_do_not_treat_a_legacy_tournament_id_as_tc_access(
    api_client, db_session, auth_identity, make_user, make_auth_headers
):
    tc_owner = auth_identity.user
    legacy_owner = make_user("legacy_tournament_owner")
    tc_tournament = _tc_tournament(db_session, tc_owner, "Separate TC record")
    legacy_tournament = models.Tournament(
        user_id=legacy_owner.id,
        name="Legacy record",
        squad_times="{}",
        is_public=False,
    )
    db_session.add(legacy_tournament)
    db_session.commit()
    db_session.refresh(legacy_tournament)

    assert tc_tournament.id == legacy_tournament.id
    response = api_client.get(
        f"/api/v1/tc/tournaments/{tc_tournament.id}/staff",
        headers=make_auth_headers(legacy_owner),
    )
    assert response.status_code == 403
