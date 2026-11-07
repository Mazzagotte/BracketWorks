from datetime import datetime, timezone
from itertools import count

from app.core import models

_codes = count(1)


def _tc_tournament(db, owner, name="Spring Classic"):
    tournament = models.TournamentCentral(
        user_id=owner.id, name=name, location="Lucky Lanes", start_date="2026-05-01", is_public=False
    )
    db.add(tournament)
    db.commit()
    db.refresh(tournament)
    return tournament


def _register(
    db,
    tc,
    first,
    last,
    *,
    usbc=None,
    average=None,
    status="confirmed",
    entry_status=None,
    squad=("sq-a", "Squad A", "2026-05-01", "9:00 AM"),
    division=None,
):
    now = datetime.now(timezone.utc)
    registration = models.TcRegistration(
        confirmation_code=f"TC-{next(_codes):05d}",
        tournament_id=tc.id,
        contact_first_name=first,
        contact_last_name=last,
        contact_email=f"{first.lower()}@example.com",
        status=status,
        terms_accepted_at=now,
        submitted_at=now,
    )
    db.add(registration)
    db.flush()
    bowler = models.TcRegistrationBowler(
        registration_id=registration.id,
        tournament_id=tc.id,
        first_name=first,
        last_name=last,
        usbc_number=usbc,
        average=average,
    )
    db.add(bowler)
    db.flush()
    squad_id, squad_name, squad_date, squad_time = squad if squad else (None, None, None, None)
    entry = models.TcEntry(
        registration_id=registration.id,
        tournament_id=tc.id,
        event_config_id="ev-singles",
        event_name_snapshot="Singles",
        division_name_snapshot=division,
        squad_config_id=squad_id,
        squad_name_snapshot=squad_name,
        squad_date_snapshot=squad_date,
        squad_time_snapshot=squad_time,
        status=entry_status or status,
    )
    db.add(entry)
    db.flush()
    db.add(models.TcEntryBowler(entry_id=entry.id, bowler_id=bowler.id, position=1))
    db.commit()
    return registration, bowler, entry


def _sync(api_client, tc, headers, **body):
    return api_client.post(
        f"/api/v1/tc/tournaments/{tc.id}/bracketworks/sync", headers=headers, json=body
    )


def _bw_players(db, bw_id):
    db.expire_all()
    return (
        db.query(models.TournamentPlayer)
        .filter(models.TournamentPlayer.tournament_id == bw_id)
        .order_by(models.TournamentPlayer.id)
        .all()
    )


def test_dry_run_writes_nothing(api_client, db_session, auth_identity):
    tc = _tc_tournament(db_session, auth_identity.user)
    _register(db_session, tc, "Ann", "Lee", usbc="111-1", average=180)

    response = _sync(api_client, tc, auth_identity.headers, dry_run=True)

    assert response.status_code == 200
    body = response.json()
    assert body["created_tournament"] is True
    assert body["players_created"] == 1
    assert body["squads_created"] == 1
    assert db_session.query(models.Tournament).count() == 0
    assert db_session.query(models.TournamentPlayer).count() == 0
    assert db_session.query(models.TcBracketWorksLink).count() == 0

    status = api_client.get(f"/api/v1/tc/tournaments/{tc.id}/bracketworks", headers=auth_identity.headers)
    assert status.json()["linked"] is False


def test_first_sync_creates_tournament_squads_players_and_link(api_client, db_session, auth_identity):
    tc = _tc_tournament(db_session, auth_identity.user)
    _register(db_session, tc, "Ann", "Lee", usbc="111-1", average=180, division="Women")
    _register(db_session, tc, "Bob", "Ray", average=200, division="Open")
    _register(db_session, tc, "Cal", "Fox", squad=("sq-b", "Squad B", "2026-05-01", "1:00 PM"))
    _register(db_session, tc, "Dee", "Nox", squad=None)

    response = _sync(api_client, tc, auth_identity.headers, dry_run=False)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["created_tournament"] is True
    assert body["players_created"] == 3
    assert body["squads_created"] == 2
    assert body["skipped"] == [{"name": "Dee Nox", "reason": "No squad date and time on this entry"}]

    link = db_session.query(models.TcBracketWorksLink).one()
    bw = db_session.get(models.Tournament, link.bw_tournament_id)
    assert bw.user_id == auth_identity.user.id
    assert bw.is_public is False
    assert bw.name == "Spring Classic"
    assert body["bw_tournament_id"] == bw.id
    squads = db_session.query(models.TournamentSquad).filter_by(tournament_id=bw.id).all()
    assert {(s.date, s.time) for s in squads} == {("2026-05-01", "9:00 AM"), ("2026-05-01", "1:00 PM")}
    assert '"2026-05-01"' in bw.squad_times

    players = _bw_players(db_session, bw.id)
    by_name = {p.full_name: p for p in players}
    assert set(by_name) == {"Ann Lee", "Bob Ray", "Cal Fox"}
    assert all(p.source == "tc" for p in players)
    assert by_name["Ann Lee"].source_ref == f"tc:{tc.id}:sq-a:111-1"
    assert by_name["Bob Ray"].source_ref == f"tc:{tc.id}:sq-a:name:bob ray"
    assert by_name["Ann Lee"].division == "Women"
    assert by_name["Bob Ray"].division == "Men"  # "Open" is not a clear BW division: BW default

    status = api_client.get(f"/api/v1/tc/tournaments/{tc.id}/bracketworks", headers=auth_identity.headers)
    assert status.json()["linked"] is True
    assert status.json()["bw_tournament_name"] == "Spring Classic"
    assert status.json()["last_synced_at"]

    detail = api_client.get(f"/api/v1/tc/tournaments/{tc.id}", headers=auth_identity.headers)
    assert detail.json()["brackets_configured"] is True


def test_second_sync_is_idempotent_and_updates_average(api_client, db_session, auth_identity):
    tc = _tc_tournament(db_session, auth_identity.user)
    _, ann, _ = _register(db_session, tc, "Ann", "Lee", usbc="111-1", average=180)
    _register(db_session, tc, "Bob", "Ray", average=200)
    first = _sync(api_client, tc, auth_identity.headers, dry_run=False).json()
    bw_id = first["bw_tournament_id"]
    player = next(p for p in _bw_players(db_session, bw_id) if p.full_name == "Ann Lee")
    player.amount_paid = 25.0
    player.lane = "7"
    db_session.commit()

    again = _sync(api_client, tc, auth_identity.headers, dry_run=False).json()
    assert again["players_created"] == 0
    assert again["players_updated"] == 0
    assert again["unchanged"] == 2
    assert again["created_tournament"] is False

    ann.average = 190
    db_session.commit()
    preview = _sync(api_client, tc, auth_identity.headers, dry_run=True).json()
    assert preview["players_updated"] == 1
    assert next(p for p in _bw_players(db_session, bw_id) if p.full_name == "Ann Lee").average == 180

    updated = _sync(api_client, tc, auth_identity.headers, dry_run=False).json()
    assert updated["players_updated"] == 1
    players = _bw_players(db_session, bw_id)
    assert len(players) == 2
    ann_bw = next(p for p in players if p.full_name == "Ann Lee")
    assert ann_bw.average == 190
    assert ann_bw.amount_paid == 25.0
    assert ann_bw.lane == "7"
    assert db_session.query(models.TcBracketWorksLink).count() == 1
    assert db_session.query(models.Tournament).count() == 1
    assert db_session.query(models.TournamentRestorePoint).filter_by(tournament_id=bw_id, trigger="tc.sync").count() == 2
    assert db_session.query(models.TournamentAuditLog).filter_by(
        tournament_id=bw_id, event_type="entries.synced_from_tc"
    ).count() == 3


def test_hand_added_player_is_not_modified_and_reported(api_client, db_session, auth_identity):
    tc = _tc_tournament(db_session, auth_identity.user)
    _register(db_session, tc, "Ann", "Lee", usbc="111-1", average=180)
    bw_id = _sync(api_client, tc, auth_identity.headers, dry_run=False).json()["bw_tournament_id"]
    squad = db_session.query(models.TournamentSquad).filter_by(tournament_id=bw_id).one()
    manual = models.TournamentPlayer(
        tournament_id=bw_id, squad_id=squad.id, user_id=auth_identity.user.id,
        full_name="bob  ray", average=150,
    )
    db_session.add(manual)
    db_session.commit()
    manual_id = manual.id

    _register(db_session, tc, "Bob", "Ray", average=210)
    body = _sync(api_client, tc, auth_identity.headers, dry_run=False).json()

    assert body["players_created"] == 0
    assert body["possible_duplicates"] == [
        {"name": "Bob Ray", "bw_player_id": manual_id, "bw_name": "bob  ray", "squad": "Squad A"}
    ]
    players = _bw_players(db_session, bw_id)
    assert len(players) == 2
    untouched = db_session.get(models.TournamentPlayer, manual_id)
    assert untouched.average == 150
    assert untouched.source is None


def test_cancelled_waitlisted_and_pending_rules(api_client, db_session, auth_identity):
    tc = _tc_tournament(db_session, auth_identity.user)
    _register(db_session, tc, "Ann", "Lee")
    _register(db_session, tc, "Cat", "Can", status="cancelled")
    _register(db_session, tc, "Wes", "Wait", status="waitlisted")
    _register(db_session, tc, "Ref", "Und", status="refunded")
    _register(db_session, tc, "Pat", "Pend", status="pending")
    _register(db_session, tc, "Ent", "Cancel", status="confirmed", entry_status="cancelled")

    confirmed_only = _sync(api_client, tc, auth_identity.headers, dry_run=True).json()
    with_pending = _sync(api_client, tc, auth_identity.headers, dry_run=True, include_pending=True).json()

    assert confirmed_only["players_created"] == 1
    assert with_pending["players_created"] == 2


def test_removed_tc_bowler_is_reported_not_deleted(api_client, db_session, auth_identity):
    tc = _tc_tournament(db_session, auth_identity.user)
    _register(db_session, tc, "Ann", "Lee", usbc="111-1")
    registration, _, entry = _register(db_session, tc, "Bob", "Ray")
    bw_id = _sync(api_client, tc, auth_identity.headers, dry_run=False).json()["bw_tournament_id"]
    bob = next(p for p in _bw_players(db_session, bw_id) if p.full_name == "Bob Ray")

    registration.status = "cancelled"
    entry.status = "cancelled"
    db_session.commit()
    body = _sync(api_client, tc, auth_identity.headers, dry_run=False).json()

    assert body["not_in_tc"] == [{"bw_player_id": bob.id, "name": "Bob Ray"}]
    assert len(_bw_players(db_session, bw_id)) == 2


def test_new_player_in_squad_with_brackets_needs_regeneration(api_client, db_session, auth_identity):
    tc = _tc_tournament(db_session, auth_identity.user)
    _register(db_session, tc, "Ann", "Lee")
    bw_id = _sync(api_client, tc, auth_identity.headers, dry_run=False).json()["bw_tournament_id"]
    squad = db_session.query(models.TournamentSquad).filter_by(tournament_id=bw_id).one()
    db_session.add(models.BracketSnapshot(tournament_id=bw_id, squad_id=squad.id, payload={}, is_current=True))
    db_session.commit()

    _register(db_session, tc, "Bob", "Ray")
    body = _sync(api_client, tc, auth_identity.headers, dry_run=True).json()

    assert body["squads_needing_regeneration"] == [{"squad_id": squad.id, "label": "Squad A"}]


def test_other_user_cannot_sync_or_read(api_client, db_session, auth_identity, make_user, make_auth_headers):
    tc = _tc_tournament(db_session, auth_identity.user)
    _register(db_session, tc, "Ann", "Lee")
    stranger_headers = make_auth_headers(make_user("tc_stranger"))

    assert _sync(api_client, tc, stranger_headers, dry_run=False).status_code in {403, 404}
    assert api_client.get(
        f"/api/v1/tc/tournaments/{tc.id}/bracketworks", headers=stranger_headers
    ).status_code in {403, 404}
    assert db_session.query(models.Tournament).count() == 0


def test_tc_staff_without_bw_access_cannot_sync_linked_tournament(
    api_client, db_session, auth_identity, make_user, make_auth_headers
):
    tc = _tc_tournament(db_session, auth_identity.user)
    _register(db_session, tc, "Ann", "Lee")
    staff = make_user("tc_entries_staff")
    db_session.add(models.TcTournamentStaffMember(
        tournament_id=tc.id, user_id=staff.id, role="entries_manager", invited_by_user_id=auth_identity.user.id,
    ))
    db_session.commit()
    staff_headers = make_auth_headers(staff)

    # Staff cannot create the BracketWorks tournament; only the owner can.
    assert _sync(api_client, tc, staff_headers, dry_run=False).status_code == 403
    bw_id = _sync(api_client, tc, auth_identity.headers, dry_run=False).json()["bw_tournament_id"]
    # Linked, but staff has no BracketWorks access.
    assert _sync(api_client, tc, staff_headers, dry_run=True).status_code == 403

    bw = db_session.get(models.Tournament, bw_id)
    bw.lifecycle_status = "finalized"
    db_session.commit()
    finalized = _sync(api_client, tc, auth_identity.headers, dry_run=True)
    assert finalized.status_code == 409
    assert "finalized or archived" in finalized.json()["detail"]
