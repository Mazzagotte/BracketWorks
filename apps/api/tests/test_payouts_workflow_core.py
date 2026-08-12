from __future__ import annotations

from datetime import datetime

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
    summary.finalized_date = datetime.utcnow().isoformat()
    db_session.commit()

    save_again = api_client.post(
        f"/api/v1/payouts/save/{tournament['id']}?squad_id={squad['id']}",
        headers=auth_identity.headers,
    )
    assert save_again.status_code == 400
    assert "already finalized" in save_again.json()["detail"]


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
