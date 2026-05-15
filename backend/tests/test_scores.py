from app.api.deps import SessionLocal
from app.core import models, utils


def test_create_score_persists_handicap_totals_with_valid_auth(client):
    with SessionLocal() as db:
        user = models.User(
            username="score_test_user",
            email="score_test_user@example.com",
            first_name="Score",
            last_name="Tester",
            organization=None,
            password="not-used-in-this-test",
            is_admin=False,
            email_verified_at=None,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        tournament = models.Tournament(
            user_id=user.id,
            name="Score Test Tournament",
            location="Boise",
            start_date="2026-05-14",
            end_date="2026-05-14",
        )
        db.add(tournament)
        db.commit()
        db.refresh(tournament)

        squad = models.TournamentSquad(
            tournament_id=tournament.id,
            date="2026-05-14",
            time="10:00 AM",
        )
        db.add(squad)
        db.commit()
        db.refresh(squad)

        player = models.TournamentPlayer(
            tournament_id=tournament.id,
            squad_id=squad.id,
            user_id=user.id,
            full_name="Test Bowler",
            average=150,
            handicap_pins=0,
            handicap_entry_count=1,
            scratch_entry_count=1,
        )
        db.add(player)
        db.commit()
        db.refresh(player)

        token = utils.create_access_token({"sub": str(user.id)})
        player_id = player.id
        tournament_id = tournament.id
        squad_id = squad.id

    response = client.post(
        "/api/v1/scores/",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "player_id": player_id,
            "tournament_id": tournament_id,
            "squad_id": squad_id,
            "game1_scratch": 100,
            "game2_scratch": 110,
            "game3_scratch": 120,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["game1_scratch"] == 100
    assert body["game2_scratch"] == 110
    assert body["game3_scratch"] == 120
    assert body["game1_with_handicap"] == 140
    assert body["game2_with_handicap"] == 150
    assert body["game3_with_handicap"] == 160

    with SessionLocal() as db:
        saved = (
            db.query(models.PlayerScore)
            .filter(models.PlayerScore.player_id == player_id)
            .one()
        )
        assert saved.game1_with_handicap == 140
        assert saved.game2_with_handicap == 150
        assert saved.game3_with_handicap == 160
