from app.core import models


def _seed(db, owner):
    tournament = models.Tournament(
        user_id=owner.id, name="Original Event", location="Original Center",
        squad_times='{"2026-08-21": ["6:00 PM"]}', is_public=False,
    )
    db.add(tournament)
    db.flush()
    squad = models.TournamentSquad(tournament_id=tournament.id, date="2026-08-21", time="6:00 PM")
    db.add(squad)
    db.flush()
    db.add(models.TournamentPlayer(
        tournament_id=tournament.id, squad_id=squad.id, user_id=owner.id,
        full_name="Protected Player", average=180, amount_paid=20,
    ))
    db.add(models.UserSquadSelection(user_id=owner.id, tournament_squad_id=squad.id))
    db.add(models.TournamentSetupState(
        tournament_id=tournament.id, user_id=owner.id,
        payload={"step": "entries", "nested": {"complete": True}}, is_published=True,
    ))
    db.commit()
    db.refresh(tournament)
    return tournament


def test_settings_change_creates_inspectable_restore_point(api_client, db_session, auth_identity):
    tournament = _seed(db_session, auth_identity.user)
    update = api_client.put(f"/api/v1/tournaments/{tournament.id}", headers=auth_identity.headers, json={
        "name": "Changed Event", "location": "New Center", "squad_times": {}, "is_public": True,
    })
    assert update.status_code == 200
    history = api_client.get(f"/api/v1/tournament-snapshots/{tournament.id}", headers=auth_identity.headers)
    assert history.status_code == 200
    point = history.json()[0]
    assert point["trigger"] == "tournament.settings_update"
    assert point["safe_to_restore"] is True
    detail = api_client.get(
        f"/api/v1/tournament-snapshots/{tournament.id}/{point['id']}", headers=auth_identity.headers
    )
    assert detail.status_code == 200
    assert detail.json()["state_summary"]["tournament_players"] == 1
    assert detail.json()["state_summary"]["user_squad_selections"] == 1
    assert detail.json()["state_summary"]["tournament_setup_states"] == 1


def test_restore_requires_exact_confirmation_and_restores_state(api_client, db_session, auth_identity):
    tournament = _seed(db_session, auth_identity.user)
    api_client.put(f"/api/v1/tournaments/{tournament.id}", headers=auth_identity.headers, json={
        "name": "Changed Event", "location": "New Center", "squad_times": {}, "is_public": True,
    })
    point = api_client.get(
        f"/api/v1/tournament-snapshots/{tournament.id}", headers=auth_identity.headers
    ).json()[0]
    original_squad = db_session.query(models.TournamentSquad).filter_by(tournament_id=tournament.id).one()
    db_session.query(models.UserSquadSelection).filter_by(tournament_squad_id=original_squad.id).delete()
    setup = db_session.query(models.TournamentSetupState).filter_by(tournament_id=tournament.id).one()
    setup.payload = {"step": "changed"}
    setup.is_published = False
    db_session.commit()
    denied = api_client.post(
        f"/api/v1/tournament-snapshots/{tournament.id}/{point['id']}/restore",
        headers=auth_identity.headers, json={"confirmation": "wrong"},
    )
    assert denied.status_code == 400
    restored = api_client.post(
        f"/api/v1/tournament-snapshots/{tournament.id}/{point['id']}/restore",
        headers=auth_identity.headers, json={"confirmation": "Changed Event", "reason": "Undo accidental edit"},
    )
    assert restored.status_code == 200
    db_session.expire_all()
    restored_tournament = db_session.get(models.Tournament, tournament.id)
    assert restored_tournament.name == "Original Event"
    assert restored_tournament.location == "Original Center"
    assert db_session.query(models.TournamentPlayer).filter_by(tournament_id=tournament.id).one().full_name == "Protected Player"
    restored_squad = db_session.query(models.TournamentSquad).filter_by(tournament_id=tournament.id).one()
    selection = db_session.query(models.UserSquadSelection).filter_by(tournament_squad_id=restored_squad.id).one()
    assert selection.user_id == auth_identity.user.id
    restored_setup = db_session.query(models.TournamentSetupState).filter_by(tournament_id=tournament.id).one()
    assert restored_setup.payload == {"step": "entries", "nested": {"complete": True}}
    assert restored_setup.is_published is True


def test_later_activity_requires_explicit_acknowledgment(api_client, db_session, auth_identity):
    tournament = _seed(db_session, auth_identity.user)
    api_client.put(f"/api/v1/tournaments/{tournament.id}", headers=auth_identity.headers, json={
        "name": "Changed Event", "location": "New Center", "squad_times": {}, "is_public": True,
    })
    point = api_client.get(f"/api/v1/tournament-snapshots/{tournament.id}", headers=auth_identity.headers).json()[0]
    db_session.add(models.TournamentAuditLog(
        tournament_id=tournament.id, event_type="test.later_activity", user_id=auth_identity.user.id,
        user_display_name="Test User", summary="Later operational activity",
    ))
    db_session.commit()
    blocked = api_client.post(
        f"/api/v1/tournament-snapshots/{tournament.id}/{point['id']}/restore",
        headers=auth_identity.headers, json={"confirmation": "Changed Event"},
    )
    assert blocked.status_code == 409
    forced = api_client.post(
        f"/api/v1/tournament-snapshots/{tournament.id}/{point['id']}/restore",
        headers=auth_identity.headers,
        json={"confirmation": "Changed Event", "acknowledge_later_activity": True, "reason": "Reviewed later activity"},
    )
    assert forced.status_code == 200
