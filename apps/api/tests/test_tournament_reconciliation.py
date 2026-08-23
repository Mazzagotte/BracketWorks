from app.core import models


def test_final_review_reports_blockers(api_client, db_session, auth_identity):
    tournament = models.Tournament(
        user_id=auth_identity.user.id, name="Review Event", squad_times="{}", is_public=False,
    )
    db_session.add(tournament)
    db_session.flush()
    db_session.add(models.TournamentPlayer(
        tournament_id=tournament.id, user_id=auth_identity.user.id,
        full_name="Needs Work", average=None, amount_paid=0,
    ))
    db_session.commit()
    response = api_client.get(
        f"/api/v1/tournament-reconciliation/{tournament.id}", headers=auth_identity.headers
    )
    assert response.status_code == 200
    review = response.json()
    assert review["ready_to_finalize"] is False
    assert review["entries"] == {"count": 1, "missing_averages": 1, "unpaid": 1, "duplicates": 0}
    assert "Brackets have not been generated" in review["blocking_errors"]
    assert "Public results are not enabled" in review["warnings"]


def test_private_results_warning_does_not_block_otherwise_ready_tournament(api_client, db_session, auth_identity, monkeypatch):
    tournament = models.Tournament(user_id=auth_identity.user.id, name="Private Final", squad_times="{}", is_public=False)
    db_session.add(tournament)
    db_session.flush()
    player = models.TournamentPlayer(tournament_id=tournament.id, user_id=auth_identity.user.id, full_name="Ready Player", average=180, amount_paid=20)
    db_session.add(player)
    db_session.flush()
    db_session.add(models.PlayerScore(tournament_id=tournament.id, player_id=player.id, squad_id=1, game1_scratch=200, game2_scratch=200, game3_scratch=200))
    db_session.add(models.BracketSnapshot(tournament_id=tournament.id, payload={"scratch_brackets": [{}]}, bracket_size=8, player_count=1, is_current=True))
    db_session.add(models.TournamentPayoutSummary(tournament_id=tournament.id, total_prize_pool=20, total_scratch_pool=20, total_handicap_pool=0, total_paid_out=20, total_unpaid=0, scratch_brackets_count=1, handicap_brackets_count=0, total_winners=0, scratch_entry_fee=20, handicap_entry_fee=0, created_at="now", updated_at="now"))
    db_session.commit()
    monkeypatch.setattr("app.services.tournament_reconciliation.calculate_side_pot_accounting", lambda *_: {"total_payout": 0, "summaries": []})

    review = api_client.get(f"/api/v1/tournament-reconciliation/{tournament.id}", headers=auth_identity.headers).json()

    assert review["blocking_errors"] == []
    assert review["warnings"] == ["Public results are not enabled"]
    assert review["ready_to_finalize"] is True
