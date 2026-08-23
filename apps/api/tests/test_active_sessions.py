from datetime import datetime, timedelta, timezone
import secrets

from app.core import models


def _other_session(db, user, nickname="Firefox on Windows"):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    session = models.AuthSession(
        session_id=secrets.token_hex(16), user_id=user.id, token_family=secrets.token_hex(8),
        refresh_token_hash=secrets.token_hex(32), device_nickname=nickname,
        region_hint="Colorado, US", risk_score=0, issued_at=now, last_seen_at=now,
        expires_at=now + timedelta(days=7), is_revoked=False,
    )
    db.add(session)
    db.commit()
    return session


def test_session_list_marks_authenticated_session_current(api_client, db_session, auth_identity):
    other = _other_session(db_session, auth_identity.user)
    response = api_client.get("/api/v1/users/sessions", headers=auth_identity.headers)
    assert response.status_code == 200
    sessions = response.json()["sessions"]
    assert len(sessions) == 2
    current = [session for session in sessions if session["is_current"]]
    assert len(current) == 1
    assert current[0]["session_id"] != other.session_id


def test_revoke_other_sessions_preserves_current_session(api_client, db_session, auth_identity):
    first = _other_session(db_session, auth_identity.user, "Phone")
    second = _other_session(db_session, auth_identity.user, "Tablet")
    response = api_client.post("/api/v1/users/sessions/revoke-others", headers=auth_identity.headers)
    assert response.status_code == 200
    assert response.json()["revoked_sessions"] == 2
    db_session.refresh(first)
    db_session.refresh(second)
    assert first.is_revoked and second.is_revoked
    still_authenticated = api_client.get("/api/v1/users/me", headers=auth_identity.headers)
    assert still_authenticated.status_code == 200


def test_user_cannot_revoke_another_users_session(api_client, db_session, auth_identity, make_user):
    other_user = make_user("session_other_user")
    other = _other_session(db_session, other_user)
    response = api_client.post(
        "/api/v1/users/sessions/revoke", headers=auth_identity.headers, json={"session_id": other.session_id},
    )
    assert response.status_code == 200
    assert response.json()["revoked_sessions"] == 0
    db_session.refresh(other)
    assert other.is_revoked is False
