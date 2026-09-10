from app.core import models


def test_import_commit_is_atomic_and_creates_restore_point(api_client, db_session, auth_identity):
    tournament = api_client.post('/api/v1/tournaments', headers=auth_identity.headers, json={
        'name': 'Import Event', 'location': 'Center', 'start_date': '2026-08-22',
        'end_date': '2026-08-22', 'squad_times': {'2026-08-22': ['10:00']}, 'is_public': False,
    }).json()
    squad = api_client.post('/api/v1/squads/', headers=auth_identity.headers, json={
        'tournament_id': tournament['id'], 'date': '2026-08-22', 'time': '10:00',
    }).json()
    rows = [{
        'tournament_id': tournament['id'], 'squad_id': squad['id'], 'full_name': name,
        'usbc_number': usbc, 'average': 180, 'handicap_entry_count': 1,
        'scratch_entry_count': 1, 'program_entry_counts': {'handicap': 1, 'scratch': 1},
        'amount_paid': 20,
    } for name, usbc in [('Import One', '1001'), ('Import Two', '1002')]]
    response = api_client.post('/api/v1/bowlers/import-commit', headers=auth_identity.headers, json={
        'tournament_id': tournament['id'], 'squad_id': squad['id'], 'file_name': 'entries.xlsx', 'rows': rows,
    })
    assert response.status_code == 200, response.text
    assert response.json()['created'] == 2
    assert db_session.query(models.TournamentPlayer).filter_by(tournament_id=tournament['id']).count() == 2
    restore = db_session.query(models.TournamentRestorePoint).filter_by(tournament_id=tournament['id'], trigger='entries.import').one()
    assert restore.summary == 'Before importing 2 entries'
    audit = db_session.query(models.TournamentAuditLog).filter_by(tournament_id=tournament['id'], event_type='entries.imported').one()
    assert audit.after_values['created_count'] == 2

    duplicate_batch = api_client.post('/api/v1/bowlers/import-commit', headers=auth_identity.headers, json={
        'tournament_id': tournament['id'], 'squad_id': squad['id'], 'rows': [rows[0], {**rows[1], 'usbc_number': '1001'}],
    })
    assert duplicate_batch.status_code == 409
    assert db_session.query(models.TournamentPlayer).filter_by(tournament_id=tournament['id']).count() == 2


def test_list_bowlers_returns_profile_usbc_number(api_client, db_session, auth_identity):
    tournament = api_client.post('/api/v1/tournaments', headers=auth_identity.headers, json={
        'name': 'Profile USBC Event', 'location': 'Center', 'start_date': '2026-08-22',
        'end_date': '2026-08-22', 'squad_times': {'2026-08-22': ['10:00']}, 'is_public': False,
    }).json()
    squad = api_client.post('/api/v1/squads/', headers=auth_identity.headers, json={
        'tournament_id': tournament['id'], 'date': '2026-08-22', 'time': '10:00',
    }).json()
    player_response = api_client.post('/api/v1/bowlers', headers=auth_identity.headers, json={
        'tournament_id': tournament['id'], 'squad_id': squad['id'], 'full_name': 'Profile Bowler',
    })
    assert player_response.status_code == 200, player_response.text
    player = db_session.get(models.TournamentPlayer, player_response.json()['id'])
    profile = models.BowlerProfile(
        user_id=auth_identity.user.id, first_name='Profile', last_name='Bowler', usbc_number='987654',
    )
    db_session.add(profile)
    db_session.flush()
    player.bowler_profile_id = profile.id
    player.usbc_number = None
    db_session.commit()

    response = api_client.get(
        f"/api/v1/bowlers?tournament_id={tournament['id']}&squad_id={squad['id']}",
        headers=auth_identity.headers,
    )

    assert response.status_code == 200, response.text
    listed_player = next(row for row in response.json() if row['id'] == player.id)
    assert listed_player['usbc_number'] == '987654'


def test_large_import_commits_in_one_request(api_client, db_session, auth_identity):
    tournament = api_client.post('/api/v1/tournaments', headers=auth_identity.headers, json={
        'name': 'Large Import', 'location': 'Center', 'start_date': '2026-08-22',
        'end_date': '2026-08-22', 'squad_times': {'2026-08-22': ['14:00']}, 'is_public': False,
    }).json()
    squad = api_client.post('/api/v1/squads/', headers=auth_identity.headers, json={
        'tournament_id': tournament['id'], 'date': '2026-08-22', 'time': '14:00',
    }).json()
    rows = [{
        'tournament_id': tournament['id'], 'squad_id': squad['id'],
        'full_name': f'Large Player {index:03d}', 'usbc_number': f'L{index:04d}',
        'average': 150 + (index % 50), 'program_entry_counts': {'scratch': 1},
    } for index in range(250)]
    response = api_client.post('/api/v1/bowlers/import-commit', headers=auth_identity.headers, json={
        'tournament_id': tournament['id'], 'squad_id': squad['id'], 'rows': rows,
    })
    assert response.status_code == 200, response.text
    assert response.json()['created'] == 250
    assert db_session.query(models.TournamentPlayer).filter_by(tournament_id=tournament['id']).count() == 250
