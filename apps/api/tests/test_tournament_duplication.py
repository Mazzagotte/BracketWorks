from app.core import models


def _seed_template(db, owner):
    tournament = models.Tournament(
        user_id=owner.id, name="Weekly Classic", location="Main Lanes",
        start_date="2026-08-22", end_date="2026-08-22", squad_times="{}", is_public=True,
    )
    db.add(tournament)
    db.flush()
    squad = models.TournamentSquad(tournament_id=tournament.id, date="2026-08-22", time="6:00 PM")
    db.add(squad)
    db.flush()
    db.add(models.TournamentBracketSettings(
        tournament_id=tournament.id, bracket_size=8, default_entry_fee=12,
        bracket_programs=[{"key": "scratch", "enabled": True}],
        side_pots_settings={"pots": [{"key": "high_game", "enabled": True}]},
        handicap_percentage=90, handicap_base=220, allow_byes=True,
    ))
    player = models.TournamentPlayer(
        tournament_id=tournament.id, squad_id=squad.id, user_id=owner.id,
        full_name="Template Bowler", average=185, scratch_entry_count=2,
        program_entry_counts={"scratch": 2}, side_pot_entries={"high_game": True}, amount_paid=24,
    )
    db.add(player)
    db.flush()
    db.add(models.PlayerScore(player_id=player.id, tournament_id=tournament.id, squad_id=squad.id, game1_scratch=200))
    db.add(models.BracketSnapshot(tournament_id=tournament.id, squad_id=squad.id, payload={"scratch_brackets": []}, bracket_size=8, player_count=1, is_current=True))
    db.commit()
    return tournament


def test_duplicate_tournament_copies_configuration_only_by_default(api_client, db_session, auth_identity):
    source = _seed_template(db_session, auth_identity.user)
    response = api_client.post(
        f"/api/v1/tournaments/{source.id}/duplicate", headers=auth_identity.headers,
        json={"name": "Weekly Classic - Week 2", "start_date": "2026-08-29", "end_date": "2026-08-29"},
    )
    assert response.status_code == 200, response.text
    duplicate_id = response.json()["id"]
    duplicate = db_session.get(models.Tournament, duplicate_id)
    assert duplicate.name == "Weekly Classic - Week 2"
    assert duplicate.lifecycle_status == "setup"
    assert db_session.query(models.TournamentSquad).filter_by(tournament_id=duplicate_id).count() == 1
    settings = db_session.query(models.TournamentBracketSettings).filter_by(tournament_id=duplicate_id).one()
    assert settings.bracket_size == 8
    assert settings.bracket_programs[0]["key"] == "scratch"
    assert settings.side_pots_settings["pots"][0]["key"] == "high_game"
    assert db_session.query(models.TournamentPlayer).filter_by(tournament_id=duplicate_id).count() == 0
    assert db_session.query(models.PlayerScore).filter_by(tournament_id=duplicate_id).count() == 0
    assert db_session.query(models.BracketSnapshot).filter_by(tournament_id=duplicate_id).count() == 0


def test_duplicate_tournament_can_copy_bowlers_but_not_results_or_payments(api_client, db_session, auth_identity):
    source = _seed_template(db_session, auth_identity.user)
    response = api_client.post(
        f"/api/v1/tournaments/{source.id}/duplicate", headers=auth_identity.headers,
        json={"name": "With Bowlers", "copy_bowlers": True},
    )
    assert response.status_code == 200, response.text
    duplicate_id = response.json()["id"]
    copied = db_session.query(models.TournamentPlayer).filter_by(tournament_id=duplicate_id).one()
    assert copied.full_name == "Template Bowler"
    assert copied.amount_paid == 0
    assert copied.squad_id is not None
    assert db_session.query(models.PlayerScore).filter_by(tournament_id=duplicate_id).count() == 0
    assert db_session.query(models.BracketWinner).filter_by(tournament_id=duplicate_id).count() == 0
    assert db_session.query(models.BracketPayout).filter_by(tournament_id=duplicate_id).count() == 0


def test_staff_member_cannot_duplicate_owner_tournament(api_client, db_session, auth_identity, make_user, make_auth_headers):
    source = _seed_template(db_session, auth_identity.user)
    viewer = make_user("template_viewer")
    db_session.add(models.TournamentStaffMember(
        tournament_id=source.id, user_id=viewer.id, role="viewer", invited_by_user_id=auth_identity.user.id,
    ))
    db_session.commit()
    response = api_client.post(
        f"/api/v1/tournaments/{source.id}/duplicate", headers=make_auth_headers(viewer), json={"name": "Forbidden Copy"},
    )
    assert response.status_code == 403
