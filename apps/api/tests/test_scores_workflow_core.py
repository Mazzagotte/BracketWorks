from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core import models


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


def test_zero_handicap_percentage_recalculates_player_handicap(
    api_client: TestClient,
    auth_identity,
    db_session: Session,
):
    tournament = _create_tournament(api_client, auth_identity.headers)
    squad = _create_squad(api_client, auth_identity.headers, tournament["id"], "10:00")
    _configure_brackets(api_client, auth_identity.headers, tournament["id"])
    bowler = _create_bowler(
        api_client,
        auth_identity.headers,
        tournament["id"],
        squad["id"],
        name="Zero Handicap Player",
        average=180,
    )

    settings_response = api_client.get(
        f"/api/v1/bracket-settings/{tournament['id']}",
        headers=auth_identity.headers,
    )
    assert settings_response.status_code == 200, settings_response.text

    update_response = api_client.put(
        f"/api/v1/bracket-settings/{settings_response.json()['id']}",
        headers=auth_identity.headers,
        json={"handicap_percentage": 0},
    )
    assert update_response.status_code == 200, update_response.text

    player = db_session.query(models.TournamentPlayer).filter(
        models.TournamentPlayer.id == bowler["id"]
    ).one()
    assert player.handicap_pins == 0


def test_handicap_setting_change_recalculates_all_saved_game_totals(
    api_client: TestClient,
    auth_identity,
    db_session: Session,
):
    tournament = _create_tournament(api_client, auth_identity.headers)
    squad = _create_squad(api_client, auth_identity.headers, tournament["id"], "10:00")
    _configure_brackets(api_client, auth_identity.headers, tournament["id"])
    bowler = _create_bowler(
        api_client,
        auth_identity.headers,
        tournament["id"],
        squad["id"],
        name="Recalculated Handicap Player",
        average=180,
    )
    score_response = api_client.post(
        "/api/v1/scores/",
        headers=auth_identity.headers,
        json={
            "player_id": bowler["id"],
            "tournament_id": tournament["id"],
            "squad_id": squad["id"],
            "game1_scratch": 200,
            "game2_scratch": 190,
            "game3_scratch": 180,
        },
    )
    assert score_response.status_code == 200, score_response.text
    original_score = score_response.json()
    assert [
        original_score[f"game{game}_with_handicap"] for game in (1, 2, 3)
    ] == [216, 206, 196]

    settings_response = api_client.get(
        f"/api/v1/bracket-settings/{tournament['id']}",
        headers=auth_identity.headers,
    )
    assert settings_response.status_code == 200, settings_response.text
    update_response = api_client.put(
        f"/api/v1/bracket-settings/{settings_response.json()['id']}",
        headers=auth_identity.headers,
        json={"handicap_percentage": 90, "handicap_base": 220},
    )
    assert update_response.status_code == 200, update_response.text

    player = db_session.query(models.TournamentPlayer).filter(
        models.TournamentPlayer.id == bowler["id"]
    ).one()
    saved_score = db_session.query(models.PlayerScore).filter_by(
        player_id=bowler["id"], tournament_id=tournament["id"], squad_id=squad["id"]
    ).one()
    assert player.handicap_pins == 36
    assert [saved_score.game1_scratch, saved_score.game2_scratch, saved_score.game3_scratch] == [
        200, 190, 180
    ]
    assert [
        saved_score.game1_with_handicap,
        saved_score.game2_with_handicap,
        saved_score.game3_with_handicap,
    ] == [236, 226, 216]


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


def test_score_correction_audit_starts_after_scores_are_unlocked(
    api_client: TestClient,
    auth_identity,
    db_session: Session,
):
    tournament = _create_tournament(api_client, auth_identity.headers)
    squad = _create_squad(api_client, auth_identity.headers, tournament["id"], "10:00")
    _configure_brackets(api_client, auth_identity.headers, tournament["id"])
    bowler = _create_bowler(api_client, auth_identity.headers, tournament["id"], squad["id"], name="Correction Player", average=180)
    created = api_client.post("/api/v1/scores/", headers=auth_identity.headers, json={
        "player_id": bowler["id"], "tournament_id": tournament["id"], "squad_id": squad["id"], "game1_scratch": 224,
    })
    assert created.status_code == 200, created.text

    ordinary_edit = api_client.post("/api/v1/scores/", headers=auth_identity.headers, json={
        "player_id": bowler["id"], "tournament_id": tournament["id"], "squad_id": squad["id"], "game1_scratch": 234,
    })
    assert ordinary_edit.status_code == 200, ordinary_edit.text
    ordinary_put_edit = api_client.put(
        f"/api/v1/scores/{created.json()['id']}",
        headers=auth_identity.headers,
        json={"game1_scratch": 235},
    )
    assert ordinary_put_edit.status_code == 200, ordinary_put_edit.text
    corrections_before_unlock = api_client.get(
        f"/api/v1/scores/{tournament['id']}/corrections",
        headers=auth_identity.headers,
    )
    assert corrections_before_unlock.status_code == 200
    assert corrections_before_unlock.json() == []
    score_events_before_unlock = db_session.query(models.TournamentAuditLog).filter(
        models.TournamentAuditLog.tournament_id == tournament["id"],
        models.TournamentAuditLog.event_type.in_(("score.entered", "score.changed")),
    ).count()
    assert score_events_before_unlock == 0

    lifecycle_before_unlock = api_client.get(
        f"/api/v1/tournament-lifecycle/{tournament['id']}",
        headers=auth_identity.headers,
    )
    assert lifecycle_before_unlock.status_code == 200
    assert lifecycle_before_unlock.json()["scores_have_been_unlocked"] is False

    locked = api_client.post(
        f"/api/v1/scores/{tournament['id']}/lock",
        headers=auth_identity.headers,
        json={},
    )
    assert locked.status_code == 200
    unlocked = api_client.post(
        f"/api/v1/scores/{tournament['id']}/unlock",
        headers=auth_identity.headers,
        json={"reason": "Correcting signed score sheet"},
    )
    assert unlocked.status_code == 200, unlocked.text

    lifecycle_after_unlock = api_client.get(
        f"/api/v1/tournament-lifecycle/{tournament['id']}",
        headers=auth_identity.headers,
    )
    assert lifecycle_after_unlock.status_code == 200
    assert lifecycle_after_unlock.json()["scores_have_been_unlocked"] is True

    rejected = api_client.put(f"/api/v1/scores/{created.json()['id']}", headers=auth_identity.headers, json={
        "game1_scratch": 245,
    })
    assert rejected.status_code == 422

    corrected = api_client.put(f"/api/v1/scores/{created.json()['id']}", headers=auth_identity.headers, json={
        "game1_scratch": 245, "correction_reason": "Score sheet correction",
    })
    assert corrected.status_code == 200, corrected.text
    history = api_client.get(f"/api/v1/scores/{tournament['id']}/corrections", headers=auth_identity.headers)
    assert history.status_code == 200
    assert history.json()[0]["old_value"] == 235
    assert history.json()[0]["new_value"] == 245
    assert history.json()[0]["reason"] == "Score sheet correction"


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
