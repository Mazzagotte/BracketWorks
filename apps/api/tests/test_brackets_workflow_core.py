from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def _create_tournament(client: TestClient, headers: dict[str, str], name: str = "Phase6 Event") -> dict:
    response = client.post(
        "/api/v1/tournaments",
        headers=headers,
        json={
            "name": name,
            "location": "Test House",
            "start_date": "2026-08-01",
            "end_date": "2026-08-01",
            "squad_times": {"2026-08-01": ["09:00"]},
            "is_public": False,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def _create_squad(client: TestClient, headers: dict[str, str], tournament_id: int) -> dict:
    response = client.post(
        "/api/v1/squads/",
        headers=headers,
        json={
            "tournament_id": tournament_id,
            "date": "2026-08-01",
            "time": "09:00",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def _configure_brackets(
    client: TestClient,
    headers: dict[str, str],
    tournament_id: int,
    *,
    allow_byes: bool,
) -> None:
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
            "allow_byes": allow_byes,
            "bracket_programs": [
                {
                    "key": "scratch",
                    "name": "Scratch",
                    "division": "Any",
                    "scoring_mode": "scratch",
                    "entry_fee": 10,
                    "enabled": True,
                    "allow_byes": allow_byes,
                    "display_order": 1,
                },
                {
                    "key": "handicap",
                    "name": "Handicap",
                    "division": "Any",
                    "scoring_mode": "handicap",
                    "entry_fee": 10,
                    "enabled": True,
                    "allow_byes": allow_byes,
                    "display_order": 2,
                },
            ],
        },
    )
    assert response.status_code == 200, response.text


def _create_bowlers(
    client: TestClient,
    headers: dict[str, str],
    tournament_id: int,
    squad_id: int,
    count: int,
) -> list[dict]:
    created: list[dict] = []
    for index in range(count):
        payload = {
            "tournament_id": tournament_id,
            "squad_id": squad_id,
            "full_name": f"Bowler {index + 1}",
            "average": 180 - (index % 10),
            "division": "Open",
            "amount_paid": 20,
            "program_entry_counts": {"scratch": 1, "handicap": 1},
            "scratch_entry_count": 1,
            "handicap_entry_count": 1,
        }
        response = client.post("/api/v1/bowlers", headers=headers, json=payload)
        assert response.status_code == 200, response.text
        list_response = client.get(
            f"/api/v1/bowlers?tournament_id={tournament_id}&squad_id={squad_id}",
            headers=headers,
        )
        assert list_response.status_code == 200, list_response.text
        players = list_response.json()
        bowler = next((item for item in players if item.get("full_name") == payload["full_name"]), None)
        assert bowler is not None, players
        created.append(bowler)
    return created


def _generate(client: TestClient, headers: dict[str, str], tournament_id: int, squad_id: int):
    return client.post(
        f"/api/v1/brackets/generate-multiple?tournament_id={tournament_id}&squad_id={squad_id}",
        headers=headers,
    )


def test_bracket_status_flags_stale_when_entry_counts_change(api_client: TestClient, auth_identity):
    tournament = _create_tournament(api_client, auth_identity.headers)
    squad = _create_squad(api_client, auth_identity.headers, tournament["id"])
    _configure_brackets(api_client, auth_identity.headers, tournament["id"], allow_byes=True)
    bowlers = _create_bowlers(api_client, auth_identity.headers, tournament["id"], squad["id"], 8)

    generate_response = _generate(api_client, auth_identity.headers, tournament["id"], squad["id"])
    assert generate_response.status_code == 200, generate_response.text
    assert generate_response.json().get("generated_new") is True

    before = api_client.get(
        f"/api/v1/brackets/status/{tournament['id']}?squad_id={squad['id']}",
        headers=auth_identity.headers,
    )
    assert before.status_code == 200, before.text
    assert before.json()["entries_mismatch"] is False

    update_response = api_client.patch(
        f"/api/v1/bowlers/{bowlers[0]['id']}",
        headers=auth_identity.headers,
        json={"program_entry_counts": {"scratch": 2, "handicap": 1}},
    )
    assert update_response.status_code == 200, update_response.text

    after = api_client.get(
        f"/api/v1/brackets/status/{tournament['id']}?squad_id={squad['id']}",
        headers=auth_identity.headers,
    )
    assert after.status_code == 200, after.text
    payload = after.json()
    assert payload["has_brackets"] is True
    assert payload["entries_mismatch"] is True


def test_bracket_status_flags_stale_when_player_count_changes(api_client: TestClient, auth_identity):
    tournament = _create_tournament(api_client, auth_identity.headers, name="Count Drift")
    squad = _create_squad(api_client, auth_identity.headers, tournament["id"])
    _configure_brackets(api_client, auth_identity.headers, tournament["id"], allow_byes=True)
    _create_bowlers(api_client, auth_identity.headers, tournament["id"], squad["id"], 8)

    generate_response = _generate(api_client, auth_identity.headers, tournament["id"], squad["id"])
    assert generate_response.status_code == 200, generate_response.text

    create_extra = api_client.post(
        "/api/v1/bowlers",
        headers=auth_identity.headers,
        json={
            "tournament_id": tournament["id"],
            "squad_id": squad["id"],
            "full_name": "Late Entry",
            "average": 170,
            "program_entry_counts": {"scratch": 1, "handicap": 1},
            "scratch_entry_count": 1,
            "handicap_entry_count": 1,
        },
    )
    assert create_extra.status_code == 200, create_extra.text

    status_response = api_client.get(
        f"/api/v1/brackets/status/{tournament['id']}?squad_id={squad['id']}",
        headers=auth_identity.headers,
    )
    assert status_response.status_code == 200, status_response.text
    data = status_response.json()
    assert data["entries_mismatch"] is True
    assert data["current_player_count"] == 9
    assert data["player_count_at_generation"] == 8


def test_generation_rejects_one_short_field_when_byes_disabled(api_client: TestClient, auth_identity):
    tournament = _create_tournament(api_client, auth_identity.headers, name="No BYE")
    squad = _create_squad(api_client, auth_identity.headers, tournament["id"])
    _configure_brackets(api_client, auth_identity.headers, tournament["id"], allow_byes=False)
    _create_bowlers(api_client, auth_identity.headers, tournament["id"], squad["id"], 7)

    response = _generate(api_client, auth_identity.headers, tournament["id"], squad["id"])
    assert response.status_code == 400
    assert "Enable allow_byes" in response.json()["detail"]


def test_generation_requires_tournament_access(
    api_client: TestClient,
    db_session: Session,
    make_user,
    make_auth_headers,
):
    owner = make_user("brackets_owner")
    outsider = make_user("brackets_outsider")
    owner_headers = make_auth_headers(owner)
    outsider_headers = make_auth_headers(outsider)

    tournament = _create_tournament(api_client, owner_headers, name="Owner Protected")
    squad = _create_squad(api_client, owner_headers, tournament["id"])
    _configure_brackets(api_client, owner_headers, tournament["id"], allow_byes=True)
    _create_bowlers(api_client, owner_headers, tournament["id"], squad["id"], 8)

    response = _generate(api_client, outsider_headers, tournament["id"], squad["id"])
    assert response.status_code == 403
