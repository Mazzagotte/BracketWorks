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
    assert "Brackets have not been generated" in review["warnings"]
    assert "Public results are not enabled" in review["warnings"]
