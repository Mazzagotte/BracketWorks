from app.core import models


def _tournament(db, owner):
    tournament = models.Tournament(user_id=owner.id, name="Team Event", squad_times="{}", is_public=False)
    db.add(tournament)
    db.commit()
    db.refresh(tournament)
    return tournament


def test_owner_can_invite_and_matching_user_can_accept(api_client, db_session, auth_identity, make_user, make_auth_headers):
    tournament = _tournament(db_session, auth_identity.user)
    scorer = make_user("staff_scorer")
    invite_response = api_client.post(
        f"/api/v1/tournament-staff/{tournament.id}/invitations",
        headers=auth_identity.headers,
        json={"email": scorer.email, "role": "scorer"},
    )
    assert invite_response.status_code == 201

    scorer_headers = make_auth_headers(scorer)
    mine = api_client.get("/api/v1/tournament-staff/invitations/mine", headers=scorer_headers)
    assert mine.status_code == 200
    assert mine.json()[0]["tournament_name"] == "Team Event"

    accepted = api_client.post(
        f"/api/v1/tournament-staff/invitations/{invite_response.json()['id']}/accept",
        headers=scorer_headers,
    )
    assert accepted.status_code == 200
    member = db_session.query(models.TournamentStaffMember).filter_by(
        tournament_id=tournament.id, user_id=scorer.id
    ).one()
    assert member.role == "scorer"


def test_scorer_can_write_scores_but_cannot_manage_entries(api_client, db_session, auth_identity, make_user, make_auth_headers):
    tournament = _tournament(db_session, auth_identity.user)
    scorer = make_user("score_operator")
    membership = models.TournamentStaffMember(
        tournament_id=tournament.id, user_id=scorer.id, role="scorer", invited_by_user_id=auth_identity.user.id
    )
    squad = models.TournamentSquad(tournament_id=tournament.id, date="2026-08-21", time="6:00 PM")
    db_session.add_all([membership, squad])
    db_session.flush()
    player = models.TournamentPlayer(
        tournament_id=tournament.id, squad_id=squad.id, user_id=auth_identity.user.id,
        full_name="Score Target", average=180, amount_paid=0,
    )
    db_session.add(player)
    db_session.commit()
    headers = make_auth_headers(scorer)

    score = api_client.post("/api/v1/scores/", headers=headers, json={
        "player_id": player.id, "tournament_id": tournament.id, "squad_id": squad.id, "game1_scratch": 201,
    })
    assert score.status_code == 200
    entry = api_client.patch(f"/api/v1/bowlers/{player.id}", headers=headers, json={"average": 190})
    assert entry.status_code == 403


def test_entries_manager_can_edit_entries_but_not_scores(api_client, db_session, auth_identity, make_user, make_auth_headers):
    tournament = _tournament(db_session, auth_identity.user)
    manager = make_user("entry_operator")
    db_session.add(models.TournamentStaffMember(
        tournament_id=tournament.id, user_id=manager.id, role="entries_manager", invited_by_user_id=auth_identity.user.id
    ))
    db_session.commit()
    headers = make_auth_headers(manager)
    created = api_client.post("/api/v1/bowlers", headers=headers, json={
        "tournament_id": tournament.id, "full_name": "Managed Player", "average": 175,
    })
    assert created.status_code == 200
    created_player = db_session.get(models.TournamentPlayer, created.json()["id"])
    assert created_player.user_id == auth_identity.user.id
    score = api_client.post("/api/v1/scores/", headers=headers, json={
        "player_id": created.json()["id"], "tournament_id": tournament.id, "squad_id": 1, "game1_scratch": 200,
    })
    assert score.status_code == 403


def test_viewer_can_read_activity_but_cannot_invite(api_client, db_session, auth_identity, make_user, make_auth_headers):
    tournament = _tournament(db_session, auth_identity.user)
    viewer = make_user("staff_viewer")
    db_session.add(models.TournamentStaffMember(
        tournament_id=tournament.id, user_id=viewer.id, role="viewer", invited_by_user_id=auth_identity.user.id
    ))
    db_session.commit()
    headers = make_auth_headers(viewer)
    assert api_client.get(f"/api/v1/tournament-activity/{tournament.id}", headers=headers).status_code == 200
    denied = api_client.post(
        f"/api/v1/tournament-staff/{tournament.id}/invitations", headers=headers,
        json={"email": "newstaff@example.com", "role": "scorer"},
    )
    assert denied.status_code == 403
