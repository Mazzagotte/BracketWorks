from datetime import datetime, timezone

from app.core import models

SETUP = {
    "details": {"startDateIso": "2026-11-15", "bowlingCenter": "Meridian Lanes", "city": "Meridian", "state": "ID"},
    "events": [
        {
            "id": "evt-singles",
            "name": "Singles",
            "scoring": "handicap",
            "maxPlayers": 1,
            "enabled": True,
            "rules": {
                "format": "singles",
                "games": 3,
                "handicap": {"percent": 90, "basis": 220, "maxPins": None, "perPair": False},
                "finals": {"type": "stepladder", "cut": {"by": "count", "value": 3}},
            },
        }
    ],
    "divisions": [],
    "squads": [{"id": "sq-am", "name": "Morning", "dateIso": "2026-11-15", "startTime": "09:00", "eventIds": []}],
    "fees": [],
}


def _tournament(db, owner, *, is_public=True, name="TC Live Open"):
    tournament = models.TournamentCentral(user_id=owner.id, name=name, is_public=is_public, is_published=is_public)
    db.add(tournament)
    db.flush()
    db.add(models.TournamentCentralSetupState(tournament_id=tournament.id, user_id=owner.id, payload=SETUP, is_published=True))
    db.commit()
    db.refresh(tournament)
    return tournament


def _entry(db, tournament, *, code, first, last, average, status="confirmed"):
    now = datetime.now(timezone.utc)
    registration = models.TcRegistration(
        confirmation_code=code,
        tournament_id=tournament.id,
        contact_first_name=first,
        contact_last_name=last,
        contact_email=f"{code.lower()}@example.com",
        status=status,
        payment_status="unpaid",
        terms_accepted_at=now,
        submitted_at=now,
    )
    db.add(registration)
    db.flush()
    bowler = models.TcRegistrationBowler(
        registration_id=registration.id, tournament_id=tournament.id, first_name=first, last_name=last, average=average
    )
    db.add(bowler)
    db.flush()
    entry = models.TcEntry(
        registration_id=registration.id,
        tournament_id=tournament.id,
        event_config_id="evt-singles",
        event_name_snapshot="Singles",
        squad_config_id="sq-am",
        squad_name_snapshot="Morning",
        squad_date_snapshot="2026-11-15",
        squad_time_snapshot="09:00",
        status=status,
    )
    db.add(entry)
    db.flush()
    db.add(models.TcEntryBowler(entry_id=entry.id, bowler_id=bowler.id, position=1))
    db.commit()
    return entry.id, bowler.id


def _staff(db, tournament, user, role, owner):
    db.add(models.TcTournamentStaffMember(tournament_id=tournament.id, user_id=user.id, role=role, invited_by_user_id=owner.id))
    db.commit()


def _url(tournament_id, path):
    return f"/api/v1/tc/tournaments/{tournament_id}/{path}"


def _put_scores(client, headers, tournament_id, changes):
    return client.put(_url(tournament_id, "scores"), headers=headers, json={"scores": changes})


def test_scorer_can_save_scores_and_viewer_cannot(api_client, db_session, auth_identity, make_user, make_auth_headers):
    tournament = _tournament(db_session, auth_identity.user)
    entry_id, bowler_id = _entry(db_session, tournament, code="S-1", first="Ann", last="Lee", average=180)
    scorer = make_user("tc_scores_scorer")
    viewer = make_user("tc_scores_viewer")
    _staff(db_session, tournament, scorer, "scorer", auth_identity.user)
    _staff(db_session, tournament, viewer, "viewer", auth_identity.user)

    saved = _put_scores(api_client, make_auth_headers(scorer), tournament.id, [{"entry_id": entry_id, "bowler_id": bowler_id, "game": 1, "score": 200}])
    assert saved.status_code == 200
    assert saved.json()["saved"] == 1
    assert saved.json()["updated_at"]

    denied = _put_scores(api_client, make_auth_headers(viewer), tournament.id, [{"entry_id": entry_id, "bowler_id": bowler_id, "game": 2, "score": 200}])
    assert denied.status_code == 403

    grid = api_client.get(_url(tournament.id, "scores"), headers=make_auth_headers(viewer))
    assert grid.status_code == 200
    body = grid.json()
    assert body["event_id"] == "evt-singles"
    assert body["games"] == 3
    row = body["rows"][0]
    assert row["label"] == "Ann Lee"
    assert row["squad"] == "Sun 9:00 AM"
    assert row["bowlers"][0]["handicap_per_game"] == 36
    assert row["scores"][str(bowler_id)] == [200, None, None]
    assert row["totals"] == {"games_bowled": 1, "scratch": 200, "handicap": 36, "total": 236}
    assert body["events"][0]["divisions"][0]["advancing_count"] == 1

    stranger = make_user("tc_scores_stranger")
    assert api_client.get(_url(tournament.id, "scores"), headers=make_auth_headers(stranger)).status_code == 403


def test_score_validation_and_clearing(api_client, db_session, auth_identity):
    tournament = _tournament(db_session, auth_identity.user)
    entry_id, bowler_id = _entry(db_session, tournament, code="S-2", first="Ann", last="Lee", average=180)
    other_entry, other_bowler = _entry(db_session, tournament, code="S-3", first="Bob", last="Ray", average=190)
    headers = auth_identity.headers

    for change, status in (
        ({"entry_id": entry_id, "bowler_id": bowler_id, "game": 1, "score": 301}, 422),
        ({"entry_id": entry_id, "bowler_id": bowler_id, "game": 1, "score": -1}, 422),
        ({"entry_id": entry_id, "bowler_id": bowler_id, "game": 11, "score": 200}, 422),
        ({"entry_id": entry_id, "bowler_id": bowler_id, "game": 0, "score": 200}, 422),
        ({"entry_id": entry_id, "bowler_id": other_bowler, "game": 1, "score": 200}, 422),
        ({"entry_id": 99999, "bowler_id": bowler_id, "game": 1, "score": 200}, 404),
    ):
        assert _put_scores(api_client, headers, tournament.id, [change]).status_code == status

    assert _put_scores(api_client, headers, tournament.id, [{"entry_id": entry_id, "bowler_id": bowler_id, "game": 10, "score": 150}]).status_code == 200
    cleared = _put_scores(api_client, headers, tournament.id, [{"entry_id": entry_id, "bowler_id": bowler_id, "game": 10, "score": None}])
    assert cleared.status_code == 200 and cleared.json()["saved"] == 1
    standings = api_client.get(_url(tournament.id, "standings"), headers=headers).json()
    assert standings["tournament"]["status"] == "upcoming"

    other = models.TournamentCentral(user_id=auth_identity.user.id, name="Other Live", is_public=False)
    db_session.add(other)
    db_session.commit()
    assert _put_scores(api_client, headers, other.id, [{"entry_id": entry_id, "bowler_id": bowler_id, "game": 1, "score": 200}]).status_code == 404


def test_public_standings_contract_and_privacy(api_client, db_session, auth_identity):
    tournament = _tournament(db_session, auth_identity.user)
    entry_id, bowler_id = _entry(db_session, tournament, code="S-4", first="Ann", last="Lee", average=180)
    _entry(db_session, tournament, code="S-5", first="Cy", last="Gone", average=180, status="cancelled")
    _put_scores(api_client, auth_identity.headers, tournament.id, [{"entry_id": entry_id, "bowler_id": bowler_id, "game": 1, "score": 210}])

    response = api_client.get(f"/api/v1/public/tc-tournament/{tournament.id}/standings")
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "public, max-age=5, stale-while-revalidate=10"
    body = response.json()
    assert set(body) == {"tournament", "updatedAt", "fingerprint", "events", "allEvents"}
    assert set(body["tournament"]) == {"id", "name", "dateText", "locationText", "status", "logoUrl"}
    assert body["tournament"]["dateText"] == "Nov 15, 2026"
    assert body["tournament"]["locationText"] == "Meridian Lanes, Meridian, ID"
    assert body["tournament"]["status"] == "in-progress"
    assert body["updatedAt"]
    event = body["events"][0]
    assert set(event) == {"id", "name", "format", "scoring", "games", "scoringLabel", "divisions"}
    division = event["divisions"][0]
    assert set(division) == {"id", "name", "entryCount", "advancingCount", "cashingCount", "rows", "finals"}
    assert division["entryCount"] == 1
    row = division["rows"][0]
    assert set(row) == {"key", "rank", "tied", "name", "bowlers", "games", "gamesBowled", "scratchTotal",
                        "handicapTotal", "total", "status", "squadLabel"}
    assert set(row["bowlers"][0]) == {"name", "average", "handicapPerGame"}
    assert set(division["finals"]) == {"type", "label", "status", "champion", "matches", "rounds", "table", "notes"}
    assert body["allEvents"] is None

    private = _tournament(db_session, auth_identity.user, is_public=False, name="Private Live")
    assert api_client.get(f"/api/v1/public/tc-tournament/{private.id}/standings").status_code == 404
    assert api_client.get("/api/v1/public/tc-tournament/99999/standings").status_code == 404


def test_finals_start_enter_and_reset(api_client, db_session, auth_identity, make_user, make_auth_headers):
    tournament = _tournament(db_session, auth_identity.user)
    headers = auth_identity.headers
    players = [
        _entry(db_session, tournament, code=f"F-{index}", first=f"P{index}", last="Lane", average=200)
        for index in range(1, 5)
    ]
    query = "finals?event_config_id=evt-singles"
    before = api_client.get(_url(tournament.id, query), headers=headers).json()
    assert before["started"] is False and before["can_start"] is False
    assert before["finals"]["status"] == "not-started"

    # Qualifying: P1 230, P2 220, P3 210, P4 200.
    for index, (entry_id, bowler_id) in enumerate(players):
        _put_scores(api_client, headers, tournament.id, [{"entry_id": entry_id, "bowler_id": bowler_id, "game": 1, "score": 230 - index * 10}])

    viewer = make_user("tc_finals_viewer")
    _staff(db_session, tournament, viewer, "viewer", auth_identity.user)
    target = {"event_config_id": "evt-singles", "division_config_id": None}
    assert api_client.post(_url(tournament.id, "finals/start"), headers=make_auth_headers(viewer), json=target).status_code == 403

    started = api_client.post(_url(tournament.id, "finals/start"), headers=headers, json=target)
    assert started.status_code == 200
    body = started.json()
    assert [seed["name"] for seed in body["seeds"]] == ["P1 Lane", "P2 Lane", "P3 Lane"]
    assert body["seeds"][0]["handicapPerGame"] == 18
    assert [(slot["round"], slot["seed"]) for slot in body["slots"]] == [(1, 3), (1, 2)]
    assert api_client.post(_url(tournament.id, "finals/start"), headers=headers, json=target).status_code == 409

    bad = api_client.put(_url(tournament.id, "finals/games"), headers=headers, json={**target, "games": [{"round": 1, "seed": 9, "score": 200}]})
    assert bad.status_code == 422
    entered = api_client.put(
        _url(tournament.id, "finals/games"),
        headers=headers,
        json={**target, "games": [{"round": 1, "match": 1, "seed": 2, "score": 190}, {"round": 1, "match": 1, "seed": 3, "score": 200}]},
    )
    assert entered.status_code == 200
    finals = entered.json()["finals"]
    assert finals["matches"][0]["a"]["winner"] is True and finals["matches"][0]["a"]["score"] == 218
    assert finals["matches"][1]["a"]["seed"] == 3
    title = api_client.put(
        _url(tournament.id, "finals/games"),
        headers=headers,
        json={**target, "games": [{"round": 2, "seed": 1, "score": 180}, {"round": 2, "seed": 3, "score": 220}]},
    ).json()
    assert title["finals"]["status"] == "complete"
    assert title["finals"]["champion"]["name"] == "P3 Lane"

    public = api_client.get(f"/api/v1/public/tc-tournament/{tournament.id}/standings").json()
    assert public["events"][0]["divisions"][0]["finals"]["champion"]["name"] == "P3 Lane"

    reset = api_client.delete(_url(tournament.id, query), headers=headers)
    assert reset.status_code == 200
    db_session.expire_all()
    assert db_session.query(models.TcFinals).count() == 0
    assert db_session.query(models.TcFinalsGame).count() == 0
    assert api_client.delete(_url(tournament.id, query), headers=headers).status_code == 404
