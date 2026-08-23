from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def _create_tournament(client: TestClient, headers: dict[str, str]) -> dict:
    response = client.post(
        "/api/v1/tournaments",
        headers=headers,
        json={
            "name": "Scores Event",
            "location": "Center",
            "start_date": "2026-08-02",
            "end_date": "2026-08-02",
            "squad_times": {"2026-08-02": ["10:00", "14:00"]},
            "is_public": False,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def _create_squad(client: TestClient, headers: dict[str, str], tournament_id: int, time_value: str) -> dict:
    response = client.post(
        "/api/v1/squads/",
        headers=headers,
        json={"tournament_id": tournament_id, "date": "2026-08-02", "time": time_value},
    )
    assert response.status_code == 200, response.text
    return response.json()


def _configure_brackets(client: TestClient, headers: dict[str, str], tournament_id: int) -> None:
    response = client.post(
        "/api/v1/bracket-settings/",
        headers=headers,
        json={
            "tournament_id": tournament_id,
            "bracket_size": 8,
            "default_entry_fee": 10,
            "first_place_amount": 50,
            "second_place_amount": 20,
            "house_fee_amount": 10,
            "handicap_percentage": 80,
            "handicap_base": 200,
            "allow_byes": True,
        },
    )
    assert response.status_code == 200, response.text


def _create_bowler(
    client: TestClient,
    headers: dict[str, str],
    tournament_id: int,
    squad_id: int,
    *,
    name: str,
    average: int,
) -> dict:
    response = client.post(
        "/api/v1/bowlers",
        headers=headers,
        json={
            "tournament_id": tournament_id,
            "squad_id": squad_id,
            "full_name": name,
            "average": average,
            "program_entry_counts": {"scratch": 1, "handicap": 1},
            "scratch_entry_count": 1,
            "handicap_entry_count": 1,
        },
    )
    assert response.status_code == 200, response.text
    list_response = client.get(
        f"/api/v1/bowlers?tournament_id={tournament_id}&squad_id={squad_id}",
        headers=headers,
    )
    assert list_response.status_code == 200, list_response.text
    players = list_response.json()
    bowler = next((item for item in players if item.get("full_name") == name), None)
    assert bowler is not None, players
    return bowler


def test_score_create_and_partial_update_keep_previous_games(api_client: TestClient, auth_identity):
    tournament = _create_tournament(api_client, auth_identity.headers)
    squad = _create_squad(api_client, auth_identity.headers, tournament["id"], "10:00")
    _configure_brackets(api_client, auth_identity.headers, tournament["id"])
    bowler = _create_bowler(
        api_client,
        auth_identity.headers,
        tournament["id"],
        squad["id"],
        name="Score Player",
        average=180,
    )

    create_response = api_client.post(
        "/api/v1/scores/",
        headers=auth_identity.headers,
        json={
            "player_id": bowler["id"],
            "tournament_id": tournament["id"],
            "squad_id": squad["id"],
            "game1_scratch": 200,
        },
    )
    assert create_response.status_code == 200, create_response.text
    created = create_response.json()
    assert created["game1_scratch"] == 200
    assert created["game1_with_handicap"] == 216
    assert created["game2_scratch"] is None

    update_response = api_client.put(
        f"/api/v1/scores/{created['id']}",
        headers=auth_identity.headers,
        json={"game2_scratch": 190},
    )
    assert update_response.status_code == 200, update_response.text
    updated = update_response.json()
    assert updated["game1_scratch"] == 200
    assert updated["game1_with_handicap"] == 216
    assert updated["game2_scratch"] == 190
    assert updated["game2_with_handicap"] == 206


def test_score_endpoints_are_squad_scoped(api_client: TestClient, auth_identity):
    tournament = _create_tournament(api_client, auth_identity.headers)
    squad_one = _create_squad(api_client, auth_identity.headers, tournament["id"], "10:00")
    squad_two = _create_squad(api_client, auth_identity.headers, tournament["id"], "14:00")
    _configure_brackets(api_client, auth_identity.headers, tournament["id"])

    bowler_one = _create_bowler(
        api_client,
        auth_identity.headers,
        tournament["id"],
        squad_one["id"],
        name="AM Player",
        average=175,
    )
    bowler_two = _create_bowler(
        api_client,
        auth_identity.headers,
        tournament["id"],
        squad_two["id"],
        name="PM Player",
        average=165,
    )

    for bowler, squad in ((bowler_one, squad_one), (bowler_two, squad_two)):
        response = api_client.post(
            "/api/v1/scores/",
            headers=auth_identity.headers,
            json={
                "player_id": bowler["id"],
                "tournament_id": tournament["id"],
                "squad_id": squad["id"],
                "game1_scratch": 150,
            },
        )
        assert response.status_code == 200, response.text

    list_response = api_client.get(
        f"/api/v1/scores/?tournament_id={tournament['id']}&squad_id={squad_one['id']}",
        headers=auth_identity.headers,
    )
    assert list_response.status_code == 200, list_response.text
    payload = list_response.json()
    assert len(payload) == 1
    assert payload[0]["player_id"] == bowler_one["id"]


def test_invalid_score_payload_is_rejected(api_client: TestClient, auth_identity):
    tournament = _create_tournament(api_client, auth_identity.headers)
    squad = _create_squad(api_client, auth_identity.headers, tournament["id"], "10:00")
    _configure_brackets(api_client, auth_identity.headers, tournament["id"])
    bowler = _create_bowler(
        api_client,
        auth_identity.headers,
        tournament["id"],
        squad["id"],
        name="Validation Player",
        average=170,
    )

    response = api_client.post(
        "/api/v1/scores/",
        headers=auth_identity.headers,
        json={
            "player_id": bowler["id"],
            "tournament_id": tournament["id"],
            "squad_id": squad["id"],
            "game1_scratch": 301,
        },
    )
    assert response.status_code == 422


def test_saved_score_correction_requires_reason_and_records_history(api_client: TestClient, auth_identity):
    tournament = _create_tournament(api_client, auth_identity.headers)
    squad = _create_squad(api_client, auth_identity.headers, tournament["id"], "10:00")
    _configure_brackets(api_client, auth_identity.headers, tournament["id"])
    bowler = _create_bowler(api_client, auth_identity.headers, tournament["id"], squad["id"], name="Correction Player", average=180)
    created = api_client.post("/api/v1/scores/", headers=auth_identity.headers, json={
        "player_id": bowler["id"], "tournament_id": tournament["id"], "squad_id": squad["id"], "game1_scratch": 224,
    }).json()

    rejected = api_client.post("/api/v1/scores/", headers=auth_identity.headers, json={
        "player_id": bowler["id"], "tournament_id": tournament["id"], "squad_id": squad["id"], "game1_scratch": 234,
    })
    assert rejected.status_code == 422

    corrected = api_client.put(f"/api/v1/scores/{created['id']}", headers=auth_identity.headers, json={
        "game1_scratch": 234, "correction_reason": "Score sheet correction",
    })
    assert corrected.status_code == 200, corrected.text
    history = api_client.get(f"/api/v1/scores/{tournament['id']}/corrections", headers=auth_identity.headers)
    assert history.status_code == 200
    assert history.json()[0] | {"old_value": 224, "new_value": 234, "reason": "Score sheet correction"} == history.json()[0]


def test_locked_scores_require_reasoned_unlock(api_client: TestClient, auth_identity):
    tournament = _create_tournament(api_client, auth_identity.headers)
    squad = _create_squad(api_client, auth_identity.headers, tournament["id"], "10:00")
    _configure_brackets(api_client, auth_identity.headers, tournament["id"])
    bowler = _create_bowler(api_client, auth_identity.headers, tournament["id"], squad["id"], name="Locked Player", average=180)
    assert api_client.post(f"/api/v1/scores/{tournament['id']}/lock", headers=auth_identity.headers, json={}).status_code == 200
    blocked = api_client.post("/api/v1/scores/", headers=auth_identity.headers, json={
        "player_id": bowler["id"], "tournament_id": tournament["id"], "squad_id": squad["id"], "game1_scratch": 200,
    })
    assert blocked.status_code == 423
    assert api_client.post(f"/api/v1/scores/{tournament['id']}/unlock", headers=auth_identity.headers, json={}).status_code == 422
    unlocked = api_client.post(f"/api/v1/scores/{tournament['id']}/unlock", headers=auth_identity.headers, json={"reason": "Correcting signed score sheet"})
    assert unlocked.status_code == 200
    assert unlocked.json()["scores_locked"] is False


def test_scores_require_tournament_access(
    api_client: TestClient,
    db_session: Session,
    make_user,
    make_auth_headers,
):
    owner = make_user("scores_owner")
    outsider = make_user("scores_outsider")
    owner_headers = make_auth_headers(owner)
    outsider_headers = make_auth_headers(outsider)

    tournament = _create_tournament(api_client, owner_headers)
    squad = _create_squad(api_client, owner_headers, tournament["id"], "10:00")
    _configure_brackets(api_client, owner_headers, tournament["id"])
    bowler = _create_bowler(
        api_client,
        owner_headers,
        tournament["id"],
        squad["id"],
        name="Private Player",
        average=180,
    )

    save_response = api_client.post(
        "/api/v1/scores/",
        headers=owner_headers,
        json={
            "player_id": bowler["id"],
            "tournament_id": tournament["id"],
            "squad_id": squad["id"],
            "game1_scratch": 199,
        },
    )
    assert save_response.status_code == 200, save_response.text

    forbidden = api_client.get(
        f"/api/v1/scores/?tournament_id={tournament['id']}&squad_id={squad['id']}",
        headers=outsider_headers,
    )
    assert forbidden.status_code == 403
