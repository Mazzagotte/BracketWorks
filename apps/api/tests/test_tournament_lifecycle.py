from datetime import datetime, timezone

from app.core import models


def _create_tournament(db, owner):
    tournament = models.Tournament(user_id=owner.id, name="Lifecycle Event", squad_times="{}", is_public=True)
    db.add(tournament)
    db.commit()
    db.refresh(tournament)
    return tournament


def test_archive_is_idempotent_and_blocks_mutations(api_client, db_session, auth_identity):
    tournament = _create_tournament(db_session, auth_identity.user)
    first = api_client.post(
        f"/api/v1/tournament-lifecycle/{tournament.id}/archive",
        headers=auth_identity.headers, json={"reason": "Season complete"},
    )
    assert first.status_code == 200
    assert first.json()["status"] == "archived"
    second = api_client.post(
        f"/api/v1/tournament-lifecycle/{tournament.id}/archive",
        headers=auth_identity.headers, json={"reason": "ignored"},
    )
    assert second.status_code == 200
    blocked = api_client.post("/api/v1/bowlers", headers=auth_identity.headers, json={
        "tournament_id": tournament.id, "full_name": "Too Late", "average": 180,
    })
    assert blocked.status_code == 409

    restored = api_client.post(
        f"/api/v1/tournament-lifecycle/{tournament.id}/restore",
        headers=auth_identity.headers, json={"reason": "Correction needed"},
    )
    assert restored.status_code == 200
    assert restored.json()["status"] == "in_progress"


def test_finalize_requires_payouts_and_locks_tournament(api_client, db_session, auth_identity):
    tournament = _create_tournament(db_session, auth_identity.user)
    denied = api_client.post(
        f"/api/v1/tournament-lifecycle/{tournament.id}/finalize",
        headers=auth_identity.headers, json={"reason": "Reviewed"},
    )
    assert denied.status_code == 409
    squad = models.TournamentSquad(tournament_id=tournament.id, date="2026-08-21", time="6:00 PM")
    db_session.add(squad)
    db_session.flush()
    player = models.TournamentPlayer(
        tournament_id=tournament.id, squad_id=squad.id, user_id=auth_identity.user.id,
        full_name="Final Bowler", average=180, amount_paid=100,
    )
    db_session.add(player)
    db_session.flush()
    db_session.add(models.PlayerScore(
        player_id=player.id, tournament_id=tournament.id, squad_id=squad.id,
        game1_scratch=200, game1_with_handicap=216, game2_scratch=210,
        game2_with_handicap=226, game3_scratch=220, game3_with_handicap=236,
    ))
    db_session.add(models.BracketSnapshot(
        tournament_id=tournament.id, squad_id=squad.id, payload={"scratch_brackets": [{}]},
        bracket_size=8, player_count=1, is_current=True,
    ))
    db_session.add(models.TournamentPayoutSummary(
        tournament_id=tournament.id, squad_id=None, total_prize_pool=100,
        total_scratch_pool=100, total_handicap_pool=0, total_paid_out=0, total_unpaid=100,
        scratch_brackets_count=1, handicap_brackets_count=0, total_winners=1,
        scratch_entry_fee=10, handicap_entry_fee=10, house_percentage=0, house_fee_amount=0,
        is_finalized=False, created_at=datetime.now(timezone.utc).isoformat(), updated_at=datetime.now(timezone.utc).isoformat(),
    ))
    db_session.commit()
    finalized = api_client.post(
        f"/api/v1/tournament-lifecycle/{tournament.id}/finalize",
        headers=auth_identity.headers, json={"reason": "Reviewed"},
    )
    assert finalized.status_code == 200
    assert finalized.json()["status"] == "finalized"
    assert finalized.json()["scores_locked"] is True
    mutation = api_client.post("/api/v1/bowlers", headers=auth_identity.headers, json={
        "tournament_id": tournament.id, "full_name": "Late Entry", "average": 180,
    })
    assert mutation.status_code == 409


def test_viewer_cannot_archive(api_client, db_session, auth_identity, make_user, make_auth_headers):
    tournament = _create_tournament(db_session, auth_identity.user)
    viewer = make_user("lifecycle_viewer")
    db_session.add(models.TournamentStaffMember(
        tournament_id=tournament.id, user_id=viewer.id, role="viewer", invited_by_user_id=auth_identity.user.id,
    ))
    db_session.commit()
    response = api_client.post(
        f"/api/v1/tournament-lifecycle/{tournament.id}/archive",
        headers=make_auth_headers(viewer), json={},
    )
    assert response.status_code == 403
