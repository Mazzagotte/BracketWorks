from app.core import models


def _create_tournament(client, headers, name="Friday Classic"):
    response = client.post(
        "/api/v1/tournaments",
        headers=headers,
        json={"name": name, "squad_times": {}, "is_public": False},
    )
    assert response.status_code == 200
    return response.json()


def test_create_and_update_are_audited(api_client, auth_identity):
    tournament = _create_tournament(api_client, auth_identity.headers)
    update = api_client.put(
        f"/api/v1/tournaments/{tournament['id']}",
        headers=auth_identity.headers,
        json={"name": "Friday Classic Finals", "location": "Lane 12", "squad_times": {}, "is_public": True},
    )
    assert update.status_code == 200

    response = api_client.get(
        f"/api/v1/tournament-activity/{tournament['id']}", headers=auth_identity.headers
    )
    assert response.status_code == 200
    events = response.json()
    assert [event["event_type"] for event in events] == [
        "tournament.settings_updated", "tournament.created"
    ]
    assert events[0]["before_values"]["name"] == "Friday Classic"
    assert events[0]["after_values"]["name"] == "Friday Classic Finals"
    assert events[0]["user_display_name"] == "Test User"


def test_activity_is_private_to_tournament_owner(api_client, auth_identity, make_user, make_auth_headers):
    tournament = _create_tournament(api_client, auth_identity.headers)
    other = make_user("other_operator")
    response = api_client.get(
        f"/api/v1/tournament-activity/{tournament['id']}", headers=make_auth_headers(other)
    )
    assert response.status_code == 403


def test_activity_limit_is_enforced(api_client, auth_identity, db_session):
    tournament = _create_tournament(api_client, auth_identity.headers)
    for index in range(3):
        db_session.add(models.TournamentAuditLog(
            tournament_id=tournament["id"], event_type="test.event", user_id=auth_identity.user.id,
            user_display_name="Test User", summary=f"Event {index}",
        ))
    db_session.commit()
    response = api_client.get(
        f"/api/v1/tournament-activity/{tournament['id']}?limit=2", headers=auth_identity.headers
    )
    assert response.status_code == 200
    assert len(response.json()) == 2
