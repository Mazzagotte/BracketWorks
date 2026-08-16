from app.core import models


def test_public_tournament_source_filters_keep_bw_and_tc_separate(api_client, db_session, make_user):
    owner = make_user("source_owner")
    db_session.add_all(
        [
            models.Tournament(
                user_id=owner.id,
                name="BW tournament",
                location="Boise, ID",
                start_date="2026-09-01",
                end_date="2026-09-01",
                is_public=True,
            ),
            models.TournamentCentral(
                user_id=owner.id,
                name="TC tournament",
                location="Meridian, ID",
                start_date="2026-10-01",
                end_date="2026-10-01",
                squad_times="{}",
                is_public=True,
            ),
        ]
    )
    db_session.commit()

    bw_response = api_client.get("/api/v1/public/tournaments?source=bw")
    tc_response = api_client.get("/api/v1/public/tournaments?source=tc")

    assert bw_response.status_code == 200
    assert tc_response.status_code == 200
    assert [item["name"] for item in bw_response.json()["tournaments"]] == ["BW tournament"]
    assert [item["name"] for item in tc_response.json()["tournaments"]] == ["TC tournament"]
