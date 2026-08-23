from __future__ import annotations

from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.core import models
from app.services.payouts import calculate_bracket_prize_pool, extract_bracket_winners


def _create_tournament(client: TestClient, headers: dict[str, str], name: str) -> dict:
    response = client.post(
        "/api/v1/tournaments",
        headers=headers,
        json={
            "name": name,
            "location": "Payout Center",
            "start_date": "2026-08-03",
            "end_date": "2026-08-03",
            "squad_times": {"2026-08-03": ["09:30"]},
            "is_public": False,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def _create_squad(client: TestClient, headers: dict[str, str], tournament_id: int) -> dict:
    response = client.post(
        "/api/v1/squads/",
        headers=headers,
        json={"tournament_id": tournament_id, "date": "2026-08-03", "time": "09:30"},
    )
    assert response.status_code == 200, response.text
    return response.json()


def _configure_and_seed_for_brackets(client: TestClient, headers: dict[str, str], tournament_id: int, squad_id: int) -> None:
    settings_response = client.post(
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
    assert settings_response.status_code == 200, settings_response.text

    for index in range(8):
        bowler_response = client.post(
            "/api/v1/bowlers",
            headers=headers,
            json={
                "tournament_id": tournament_id,
                "squad_id": squad_id,
                "full_name": f"Payout Player {index + 1}",
                "average": 170 + (index % 5),
                "program_entry_counts": {"scratch": 1, "handicap": 1},
                "scratch_entry_count": 1,
                "handicap_entry_count": 1,
            },
        )
        assert bowler_response.status_code == 200, bowler_response.text

    generate = client.post(
        f"/api/v1/brackets/generate-multiple?tournament_id={tournament_id}&squad_id={squad_id}",
        headers=headers,
    )
    assert generate.status_code == 200, generate.text


def test_prize_pool_keeps_house_fee_out_when_bye_slot_exists():
    bracket = {
        "bracket_type": "scratch",
        "size": 8,
        "rounds": [
            {
                "matches": [
                    {"playerA": "A", "playerB": "B"},
                    {"playerA": "C", "playerB": "D"},
                    {"playerA": "E", "playerB": "F"},
                    {"playerA": "G", "playerB": "BYE"},
                ]
            }
        ],
    }
    pool = calculate_bracket_prize_pool(
        bracket_info=bracket,
        entry_fees={"scratch": 10.0},
        house_percentage=10,
        entry_count=7,
    )
    assert str(pool) == "70.00"


def test_extract_winners_marks_split_pot_on_finals_tie():
    bracket = {
        "bracket_type": "scratch",
        "size": 8,
        "rounds": [
            {"matches": []},
            {"matches": []},
            {
                "matches": [
                    {
                        "status": "completed",
                        "split_pot": True,
                        "playerA": "Tie One",
                        "playerA_id": 11,
                        "scoreA": 240,
                        "playerB": "Tie Two",
                        "playerB_id": 22,
                        "scoreB": 240,
                    }
                ]
            },
        ],
    }
    winners = extract_bracket_winners(bracket)
    assert winners["status"] == "completed"
    assert len(winners["winners"]) == 2
    assert all(item["place"] == 1 for item in winners["winners"])
    assert all(item.get("split_pot") is True for item in winners["winners"])


def test_save_payouts_rejects_when_summary_finalized(api_client: TestClient, auth_identity, db_session):
    tournament = _create_tournament(api_client, auth_identity.headers, "Finalize Guard")
    squad = _create_squad(api_client, auth_identity.headers, tournament["id"])
    _configure_and_seed_for_brackets(api_client, auth_identity.headers, tournament["id"], squad["id"])

    save_once = api_client.post(
        f"/api/v1/payouts/save/{tournament['id']}?squad_id={squad['id']}",
        headers=auth_identity.headers,
    )
    assert save_once.status_code == 200, save_once.text

    summary = db_session.query(models.TournamentPayoutSummary).filter(
        models.TournamentPayoutSummary.tournament_id == tournament["id"],
        models.TournamentPayoutSummary.squad_id == squad["id"],
    ).first()
    assert summary is not None
    summary.is_finalized = True
    summary.finalized_date = datetime.now(UTC).isoformat()
    db_session.commit()

    save_again = api_client.post(
        f"/api/v1/payouts/save/{tournament['id']}?squad_id={squad['id']}",
        headers=auth_identity.headers,
    )
    assert save_again.status_code == 400
    assert "already finalized" in save_again.json()["detail"]


def test_manual_payout_adjustment_requires_open_payouts_and_records_reason(api_client: TestClient, auth_identity, db_session):
    tournament = _create_tournament(api_client, auth_identity.headers, "Payout Adjustment")
    squad = _create_squad(api_client, auth_identity.headers, tournament["id"])
    _configure_and_seed_for_brackets(api_client, auth_identity.headers, tournament["id"], squad["id"])
    assert api_client.post(f"/api/v1/payouts/save/{tournament['id']}?squad_id={squad['id']}", headers=auth_identity.headers).status_code == 200
    payout = db_session.query(models.BracketPayout).filter_by(tournament_id=tournament["id"]).first()
    if payout is None:
        player = db_session.query(models.TournamentPlayer).filter_by(tournament_id=tournament["id"]).first()
        winner = models.BracketWinner(
            tournament_id=tournament["id"], squad_id=squad["id"], player_id=player.id,
            bracket_group_key="scratch", bracket_label="Scratch Bracket 1", placement=1,
            placement_text="1st", player_name=player.full_name, created_at=datetime.now().isoformat(),
        )
        db_session.add(winner)
        db_session.flush()
        payout = models.BracketPayout(
            tournament_id=tournament["id"], squad_id=squad["id"], bracket_winner_id=winner.id,
            player_id=player.id, bracket_group_key="scratch", bracket_label="Scratch Bracket 1",
            placement=1, player_name=player.full_name, prize_pool_total=80, payout_percentage=60,
            payout_amount=48, entry_fee=10, bracket_size=8, created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
        )
        db_session.add(payout)
        db_session.commit()
    old_amount = payout.payout_amount

    adjusted = api_client.patch(f"/api/v1/payouts/{tournament['id']}/items/{payout.id}", headers=auth_identity.headers, json={
        "new_amount": old_amount + 5, "reason": "Approved prize correction",
    })
    assert adjusted.status_code == 200, adjusted.text
    record = db_session.query(models.PayoutAdjustment).filter_by(payout_id=payout.id).one()
    assert str(record.old_amount) == f"{old_amount:.2f}"
    assert str(record.new_amount) == f"{old_amount + 5:.2f}"
    assert record.reason == "Approved prize correction"


def test_finalized_payout_reopen_requires_reason_and_preserves_score_lock(api_client: TestClient, auth_identity, db_session):
    tournament = _create_tournament(api_client, auth_identity.headers, "Payout Reopen")
    squad = _create_squad(api_client, auth_identity.headers, tournament["id"])
    _configure_and_seed_for_brackets(api_client, auth_identity.headers, tournament["id"], squad["id"])
    assert api_client.post(f"/api/v1/payouts/save/{tournament['id']}?squad_id={squad['id']}", headers=auth_identity.headers).status_code == 200
    tournament_row = db_session.get(models.Tournament, tournament["id"])
    summary = db_session.query(models.TournamentPayoutSummary).filter_by(tournament_id=tournament["id"]).one()
    tournament_row.lifecycle_status = "finalized"
    tournament_row.finalized_at = datetime.now()
    tournament_row.scores_locked = True
    summary.is_finalized = True
    summary.finalized_date = datetime.now().isoformat()
    db_session.commit()

    missing_reason = api_client.post(f"/api/v1/payouts/{tournament['id']}/reopen", headers=auth_identity.headers, json={"reason": ""})
    assert missing_reason.status_code == 422
    reopened = api_client.post(f"/api/v1/payouts/{tournament['id']}/reopen", headers=auth_identity.headers, json={"reason": "Correcting approved payout"})
    assert reopened.status_code == 200, reopened.text
    db_session.refresh(tournament_row)
    db_session.refresh(summary)
    assert tournament_row.lifecycle_status == "payout_review"
    assert tournament_row.scores_locked is True
    assert summary.is_finalized is False


def test_payout_calculate_requires_tournament_access(
    api_client: TestClient,
    auth_identity,
    db_session,
    make_user,
    make_auth_headers,
):
    tournament = _create_tournament(api_client, auth_identity.headers, "Private Payout")
    squad = _create_squad(api_client, auth_identity.headers, tournament["id"])
    _configure_and_seed_for_brackets(api_client, auth_identity.headers, tournament["id"], squad["id"])

    outsider_user = make_user("payout_outsider")
    outsider_headers = make_auth_headers(outsider_user)

    forbidden = api_client.get(
        f"/api/v1/payouts/calculate/{tournament['id']}?squad_id={squad['id']}",
        headers=outsider_headers,
    )
    assert forbidden.status_code == 403


def test_payout_calculate_rejects_invalid_house_percentage(api_client: TestClient, auth_identity):
    tournament = _create_tournament(api_client, auth_identity.headers, "House Percentage Guard")
    squad = _create_squad(api_client, auth_identity.headers, tournament["id"])
    _configure_and_seed_for_brackets(api_client, auth_identity.headers, tournament["id"], squad["id"])

    too_low = api_client.get(
        f"/api/v1/payouts/calculate/{tournament['id']}?squad_id={squad['id']}&house_percentage=-1",
        headers=auth_identity.headers,
    )
    assert too_low.status_code == 400
    assert "House percentage" in too_low.json()["detail"]

    too_high = api_client.get(
        f"/api/v1/payouts/calculate/{tournament['id']}?squad_id={squad['id']}&house_percentage=101",
        headers=auth_identity.headers,
    )
    assert too_high.status_code == 400
    assert "House percentage" in too_high.json()["detail"]


def test_payout_calculate_includes_backend_side_pot_accounting(api_client: TestClient, auth_identity):
    tournament = _create_tournament(api_client, auth_identity.headers, "Side Pot Authority")
    squad = _create_squad(api_client, auth_identity.headers, tournament["id"])

    settings_response = api_client.post(
        "/api/v1/bracket-settings/",
        headers=auth_identity.headers,
        json={
            "tournament_id": tournament["id"],
            "bracket_size": 8,
            "default_entry_fee": 10,
            "first_place_amount": 50,
            "second_place_amount": 20,
            "house_fee_amount": 10,
            "handicap_percentage": 80,
            "handicap_base": 200,
            "allow_byes": True,
            "side_pots_settings": {
                "tournament_id": tournament["id"],
                "entry_fee": 10,
                "prize_amount": 10,
                "pots": [
                    {"key": "high_game_scratch", "name": "High Game Scratch", "enabled": True},
                    {"key": "high_series_scratch", "name": "High Series Scratch", "enabled": False},
                    {"key": "high_game_handicap", "name": "High Game Handicap", "enabled": False},
                    {"key": "high_series_handicap", "name": "High Series Handicap", "enabled": False},
                ],
            },
        },
    )
    assert settings_response.status_code == 200, settings_response.text

    for index in range(8):
        bowler_response = api_client.post(
            "/api/v1/bowlers",
            headers=auth_identity.headers,
            json={
                "tournament_id": tournament["id"],
                "squad_id": squad["id"],
                "full_name": f"Side Pot Player {index + 1}",
                "average": 170 + (index % 5),
                "program_entry_counts": {"scratch": 1, "handicap": 1},
                "scratch_entry_count": 1,
                "handicap_entry_count": 1,
                "side_pot_entries": {"high_game_scratch": index in (0, 1)},
            },
        )
        assert bowler_response.status_code == 200, bowler_response.text

    bowlers_response = api_client.get(
        f"/api/v1/bowlers?tournament_id={tournament['id']}&squad_id={squad['id']}",
        headers=auth_identity.headers,
    )
    assert bowlers_response.status_code == 200, bowlers_response.text
    listed_bowlers = bowlers_response.json()

    player1 = next((row for row in listed_bowlers if row.get("full_name") == "Side Pot Player 1"), None)
    player2 = next((row for row in listed_bowlers if row.get("full_name") == "Side Pot Player 2"), None)
    assert player1 is not None
    assert player2 is not None

    generate = api_client.post(
        f"/api/v1/brackets/generate-multiple?tournament_id={tournament['id']}&squad_id={squad['id']}",
        headers=auth_identity.headers,
    )
    assert generate.status_code == 200, generate.text

    score_payloads = [
        {"player_id": player1["id"], "game1_scratch": 220},
        {"player_id": player2["id"], "game1_scratch": 210},
    ]
    for score_payload in score_payloads:
        score_response = api_client.post(
            "/api/v1/scores/",
            headers=auth_identity.headers,
            json={
                "player_id": score_payload["player_id"],
                "tournament_id": tournament["id"],
                "squad_id": squad["id"],
                "game1_scratch": score_payload["game1_scratch"],
            },
        )
        assert score_response.status_code == 200, score_response.text

    calculate = api_client.get(
        f"/api/v1/payouts/calculate/{tournament['id']}?squad_id={squad['id']}",
        headers=auth_identity.headers,
    )
    assert calculate.status_code == 200, calculate.text
    payload = calculate.json()

    side_pots = payload.get("side_pots")
    assert side_pots is not None
    assert side_pots["total_pool"] == 20.0

    summary = next((item for item in side_pots.get("summaries", []) if item.get("key") == "high_game_scratch"), None)
    assert summary is not None
    assert summary["entry_count"] == 2
    assert summary["status"] == "complete"
    assert summary["winning_metric"] == 220
    assert summary["winners"] == [{"player_id": player1["id"], "player_name": "Side Pot Player 1"}]
    assert summary["winner_id"] == player1["id"]
    assert summary["winner_name"] == "Side Pot Player 1"
    assert summary["winner_metric"] == 220


def test_payout_side_pot_marks_ties_without_legacy_winner(api_client: TestClient, auth_identity):
    tournament = _create_tournament(api_client, auth_identity.headers, "Side Pot Tie")
    squad = _create_squad(api_client, auth_identity.headers, tournament["id"])

    settings_response = api_client.post(
        "/api/v1/bracket-settings/",
        headers=auth_identity.headers,
        json={
            "tournament_id": tournament["id"],
            "bracket_size": 8,
            "default_entry_fee": 10,
            "first_place_amount": 50,
            "second_place_amount": 20,
            "house_fee_amount": 10,
            "handicap_percentage": 80,
            "handicap_base": 200,
            "allow_byes": True,
            "side_pots_settings": {
                "tournament_id": tournament["id"],
                "entry_fee": 10,
                "prize_amount": 10,
                "pots": [
                    {"key": "high_game_scratch", "name": "High Game Scratch", "enabled": True},
                    {"key": "high_series_scratch", "name": "High Series Scratch", "enabled": False},
                    {"key": "high_game_handicap", "name": "High Game Handicap", "enabled": False},
                    {"key": "high_series_handicap", "name": "High Series Handicap", "enabled": False},
                ],
            },
        },
    )
    assert settings_response.status_code == 200, settings_response.text

    for index in range(8):
        bowler_response = api_client.post(
            "/api/v1/bowlers",
            headers=auth_identity.headers,
            json={
                "tournament_id": tournament["id"],
                "squad_id": squad["id"],
                "full_name": f"Tie Player {index + 1}",
                "average": 170 + (index % 5),
                "program_entry_counts": {"scratch": 1, "handicap": 1},
                "scratch_entry_count": 1,
                "handicap_entry_count": 1,
                "side_pot_entries": {"high_game_scratch": index in (0, 1)},
            },
        )
        assert bowler_response.status_code == 200, bowler_response.text

    bowlers_response = api_client.get(
        f"/api/v1/bowlers?tournament_id={tournament['id']}&squad_id={squad['id']}",
        headers=auth_identity.headers,
    )
    assert bowlers_response.status_code == 200, bowlers_response.text
    listed_bowlers = bowlers_response.json()

    player1 = next((row for row in listed_bowlers if row.get("full_name") == "Tie Player 1"), None)
    player2 = next((row for row in listed_bowlers if row.get("full_name") == "Tie Player 2"), None)
    assert player1 is not None
    assert player2 is not None

    generate = api_client.post(
        f"/api/v1/brackets/generate-multiple?tournament_id={tournament['id']}&squad_id={squad['id']}",
        headers=auth_identity.headers,
    )
    assert generate.status_code == 200, generate.text

    for player in (player1, player2):
        score_response = api_client.post(
            "/api/v1/scores/",
            headers=auth_identity.headers,
            json={
                "player_id": player["id"],
                "tournament_id": tournament["id"],
                "squad_id": squad["id"],
                "game1_scratch": 220,
            },
        )
        assert score_response.status_code == 200, score_response.text

    calculate = api_client.get(
        f"/api/v1/payouts/calculate/{tournament['id']}?squad_id={squad['id']}",
        headers=auth_identity.headers,
    )
    assert calculate.status_code == 200, calculate.text
    payload = calculate.json()

    summary = next(
        (item for item in payload["side_pots"]["summaries"] if item.get("key") == "high_game_scratch"),
        None,
    )
    assert summary is not None
    assert summary["status"] == "tied"
    assert summary["winning_metric"] == 220
    assert summary["winners"] == [
        {"player_id": player1["id"], "player_name": "Tie Player 1"},
        {"player_id": player2["id"], "player_name": "Tie Player 2"},
    ]
    assert summary["winner_id"] is None
    assert summary["winner_name"] is None
    assert summary["winner_metric"] is None


def test_payout_side_pot_series_stays_pending_until_all_scores_complete(api_client: TestClient, auth_identity):
    tournament = _create_tournament(api_client, auth_identity.headers, "Side Pot Series Pending")
    squad = _create_squad(api_client, auth_identity.headers, tournament["id"])

    settings_response = api_client.post(
        "/api/v1/bracket-settings/",
        headers=auth_identity.headers,
        json={
            "tournament_id": tournament["id"],
            "bracket_size": 8,
            "default_entry_fee": 10,
            "first_place_amount": 50,
            "second_place_amount": 20,
            "house_fee_amount": 10,
            "handicap_percentage": 80,
            "handicap_base": 200,
            "allow_byes": True,
            "side_pots_settings": {
                "tournament_id": tournament["id"],
                "entry_fee": 10,
                "prize_amount": 10,
                "pots": [
                    {"key": "high_game_scratch", "name": "High Game Scratch", "enabled": False},
                    {"key": "high_series_scratch", "name": "High Series Scratch", "enabled": True},
                    {"key": "high_game_handicap", "name": "High Game Handicap", "enabled": False},
                    {"key": "high_series_handicap", "name": "High Series Handicap", "enabled": False},
                ],
            },
        },
    )
    assert settings_response.status_code == 200, settings_response.text

    for index in range(8):
        bowler_response = api_client.post(
            "/api/v1/bowlers",
            headers=auth_identity.headers,
            json={
                "tournament_id": tournament["id"],
                "squad_id": squad["id"],
                "full_name": f"Series Player {index + 1}",
                "average": 170 + (index % 5),
                "program_entry_counts": {"scratch": 1, "handicap": 1},
                "scratch_entry_count": 1,
                "handicap_entry_count": 1,
                "side_pot_entries": {"high_series_scratch": index in (0, 1)},
            },
        )
        assert bowler_response.status_code == 200, bowler_response.text

    bowlers_response = api_client.get(
        f"/api/v1/bowlers?tournament_id={tournament['id']}&squad_id={squad['id']}",
        headers=auth_identity.headers,
    )
    assert bowlers_response.status_code == 200, bowlers_response.text
    listed_bowlers = bowlers_response.json()

    player1 = next((row for row in listed_bowlers if row.get("full_name") == "Series Player 1"), None)
    player2 = next((row for row in listed_bowlers if row.get("full_name") == "Series Player 2"), None)
    assert player1 is not None
    assert player2 is not None

    generate = api_client.post(
        f"/api/v1/brackets/generate-multiple?tournament_id={tournament['id']}&squad_id={squad['id']}",
        headers=auth_identity.headers,
    )
    assert generate.status_code == 200, generate.text

    score_one = api_client.post(
        "/api/v1/scores/",
        headers=auth_identity.headers,
        json={
            "player_id": player1["id"],
            "tournament_id": tournament["id"],
            "squad_id": squad["id"],
            "game1_scratch": 210,
            "game2_scratch": 220,
            "game3_scratch": 215,
        },
    )
    assert score_one.status_code == 200, score_one.text

    score_two = api_client.post(
        "/api/v1/scores/",
        headers=auth_identity.headers,
        json={
            "player_id": player2["id"],
            "tournament_id": tournament["id"],
            "squad_id": squad["id"],
            "game1_scratch": 225,
            "game2_scratch": 205,
        },
    )
    assert score_two.status_code == 200, score_two.text

    calculate = api_client.get(
        f"/api/v1/payouts/calculate/{tournament['id']}?squad_id={squad['id']}",
        headers=auth_identity.headers,
    )
    assert calculate.status_code == 200, calculate.text
    payload = calculate.json()

    summary = next(
        (item for item in payload["side_pots"]["summaries"] if item.get("key") == "high_series_scratch"),
        None,
    )
    assert summary is not None
    assert summary["entry_count"] == 2
    assert summary["status"] == "pending"
    assert summary["winning_metric"] is None
    assert summary["winners"] == []
    assert summary["winner_id"] is None
    assert summary["winner_name"] is None
    assert summary["winner_metric"] is None
