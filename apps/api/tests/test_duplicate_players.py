from datetime import datetime, timezone

from app.core import models


def _seed_pair(api_client, headers):
    tournament = api_client.post('/api/v1/tournaments', headers=headers, json={
        'name': 'Duplicate Event', 'location': 'Center', 'start_date': '2026-08-22',
        'end_date': '2026-08-22', 'squad_times': {'2026-08-22': ['10:00']}, 'is_public': False,
    }).json()
    squad = api_client.post('/api/v1/squads/', headers=headers, json={
        'tournament_id': tournament['id'], 'date': '2026-08-22', 'time': '10:00',
    }).json()
    players = []
    for name, entries, paid in [('John Smith', {'scratch': 2}, 20), ('Jon Smith', {'handicap': 3}, 30)]:
        response = api_client.post('/api/v1/bowlers', headers=headers, json={
            'tournament_id': tournament['id'], 'squad_id': squad['id'], 'full_name': name,
            'usbc_number': '123456', 'average': 180, 'program_entry_counts': entries,
            'scratch_entry_count': entries.get('scratch', 0), 'handicap_entry_count': entries.get('handicap', 0),
            'side_pot_entries': {'high_game_scratch': name == 'John Smith'}, 'amount_paid': paid,
        })
        assert response.status_code == 200, response.text
        players.append(response.json())
    return tournament, squad, players


def test_keep_both_removes_candidate_and_is_audited(api_client, db_session, auth_identity):
    tournament, _, players = _seed_pair(api_client, auth_identity.headers)
    candidates = api_client.get(f"/api/v1/bowlers/duplicates/{tournament['id']}", headers=auth_identity.headers).json()
    assert candidates['count'] == 1
    response = api_client.post(f"/api/v1/bowlers/duplicates/{tournament['id']}/resolve", headers=auth_identity.headers, json={
        'left_player_id': players[0]['id'], 'right_player_id': players[1]['id'], 'resolution': 'keep_both',
    })
    assert response.status_code == 200
    assert api_client.get(f"/api/v1/bowlers/duplicates/{tournament['id']}", headers=auth_identity.headers).json()['count'] == 0
    assert db_session.query(models.TournamentAuditLog).filter_by(tournament_id=tournament['id'], event_type='players.duplicate_keep_both').count() == 1


def test_merge_preserves_entries_money_scores_and_downstream_records(api_client, db_session, auth_identity):
    tournament, squad, players = _seed_pair(api_client, auth_identity.headers)
    target_id, source_id = players[0]['id'], players[1]['id']
    for player_id, field, value in ((target_id, 'game1_scratch', 200), (source_id, 'game2_scratch', 210)):
        response = api_client.post('/api/v1/scores/', headers=auth_identity.headers, json={
            'player_id': player_id, 'tournament_id': tournament['id'], 'squad_id': squad['id'], field: value,
        })
        assert response.status_code == 200, response.text
    winner = models.BracketWinner(
        tournament_id=tournament['id'], squad_id=squad['id'], player_id=source_id,
        bracket_group_key='scratch', bracket_label='Scratch 1', placement=1, placement_text='1st',
        player_name='Jon Smith', created_at=datetime.now(timezone.utc).isoformat(),
    )
    db_session.add(winner); db_session.flush()
    payout = models.BracketPayout(
        tournament_id=tournament['id'], squad_id=squad['id'], bracket_winner_id=winner.id, player_id=source_id,
        bracket_group_key='scratch', bracket_label='Scratch 1', placement=1, player_name='Jon Smith',
        prize_pool_total=80, payout_percentage=60, payout_amount=48, entry_fee=10, bracket_size=8,
        created_at=datetime.now(timezone.utc).isoformat(), updated_at=datetime.now(timezone.utc).isoformat(),
    )
    db_session.add(payout); db_session.commit()

    response = api_client.post(f"/api/v1/bowlers/duplicates/{tournament['id']}/merge", headers=auth_identity.headers, json={
        'source_player_id': source_id, 'target_player_id': target_id, 'full_name': 'John Smith',
        'usbc_number': '123456', 'average': 185, 'reason': 'Same signed registration record',
    })
    assert response.status_code == 200, response.text
    target = db_session.get(models.TournamentPlayer, target_id)
    assert db_session.get(models.TournamentPlayer, source_id) is None
    assert target.program_entry_counts == {'scratch': 2, 'handicap': 3}
    assert target.amount_paid == 50
    assert target.side_pot_entries['high_game_scratch'] is True
    score = db_session.query(models.PlayerScore).filter_by(player_id=target_id).one()
    assert (score.game1_scratch, score.game2_scratch) == (200, 210)
    db_session.refresh(winner); db_session.refresh(payout)
    assert winner.player_id == target_id and payout.player_id == target_id
    assert db_session.query(models.TournamentRestorePoint).filter_by(tournament_id=tournament['id'], trigger='players.merge').count() == 1
    assert db_session.query(models.TournamentAuditLog).filter_by(tournament_id=tournament['id'], event_type='players.merged').count() == 1
