import os
import sys

import pytest
from fastapi.testclient import TestClient

os.environ["DATABASE_URL"] = "sqlite:///./test_auth_sessions.db"
os.environ.setdefault("SECRET_KEY", "test-auth-secret")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.models import Base, User
from app.api.deps import SessionLocal, engine
from app.api.v1 import users as users_api
from app.main import app


@pytest.fixture(scope="function")
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    with TestClient(app) as test_client:
        yield test_client

    Base.metadata.drop_all(bind=engine)


def _signup_and_login(client: TestClient, username: str, email: str, password: str):
    signup_payload = {
        "first_name": "Test",
        "last_name": "User",
        "username": username,
        "email": email,
        "password": password,
    }
    signup = client.post("/api/v1/users/signup", json=signup_payload)
    assert signup.status_code == 200

    login = client.post(
        "/api/v1/users/login-json",
        json={"username": username, "password": password, "grant_type": "password"},
    )
    assert login.status_code == 200
    return login.json()


def _capture_reset_email(monkeypatch: pytest.MonkeyPatch):
    captured: dict[str, str] = {}

    def fake_send_email(to_email, subject, body, reset_url, reset_code, username):
        captured.clear()
        captured.update(
            {
                "to_email": to_email,
                "subject": subject,
                "body": body,
                "reset_url": reset_url,
                "reset_code": reset_code,
                "username": username,
            }
        )
        return True

    monkeypatch.setattr(users_api, "send_email", fake_send_email)
    return captured


@pytest.mark.integration
def test_refresh_rotation_and_replay_revokes_token_family(client):
    auth = _signup_and_login(
        client,
        username="session_user",
        email="session_user@example.com",
        password="SessionPass123!",
    )

    initial_refresh = auth["refresh_token"]

    refreshed = client.post("/api/v1/users/refresh", json={"refresh_token": initial_refresh})
    assert refreshed.status_code == 200
    refreshed_data = refreshed.json()
    rotated_refresh = refreshed_data["refresh_token"]
    assert rotated_refresh != initial_refresh

    replay = client.post("/api/v1/users/refresh", json={"refresh_token": initial_refresh})
    assert replay.status_code == 401

    # Replay of old token should revoke the full token family, including rotated token.
    family_revoked = client.post("/api/v1/users/refresh", json={"refresh_token": rotated_refresh})
    assert family_revoked.status_code == 401


@pytest.mark.integration
def test_logout_revokes_current_session_refresh_token(client):
    auth = _signup_and_login(
        client,
        username="logout_user",
        email="logout_user@example.com",
        password="LogoutPass123!",
    )

    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    logout = client.post(
        "/api/v1/users/logout",
        headers=headers,
        json={"refresh_token": auth["refresh_token"], "all_sessions": False},
    )
    assert logout.status_code == 200
    assert logout.json()["revoked_sessions"] >= 1

    refresh_after_logout = client.post(
        "/api/v1/users/refresh", json={"refresh_token": auth["refresh_token"]}
    )
    assert refresh_after_logout.status_code == 401


@pytest.mark.integration
def test_admin_global_revoke_invalidates_target_user_sessions(client):
    user_auth = _signup_and_login(
        client,
        username="target_user",
        email="target_user@example.com",
        password="TargetPass123!",
    )
    target_user_id = user_auth["user_id"]

    admin_auth = _signup_and_login(
        client,
        username="admin_user",
        email="admin_user@example.com",
        password="AdminPass123!",
    )

    with SessionLocal() as db:
        admin_user = db.query(User).filter(User.id == admin_auth["user_id"]).first()
        assert admin_user is not None
        admin_user.is_admin = True
        db.commit()

    admin_relogin = client.post(
        "/api/v1/users/login-json",
        json={"username": "admin_user", "password": "AdminPass123!", "grant_type": "password"},
    )
    assert admin_relogin.status_code == 200

    admin_headers = {"Authorization": f"Bearer {admin_relogin.json()['access_token']}"}
    revoke = client.post(
        f"/api/v1/users/admin/revoke-user-sessions/{target_user_id}",
        headers=admin_headers,
    )
    assert revoke.status_code == 200
    assert revoke.json()["revoked_sessions"] >= 1

    target_refresh = client.post(
        "/api/v1/users/refresh",
        json={"refresh_token": user_auth["refresh_token"]},
    )
    assert target_refresh.status_code == 401


@pytest.mark.integration
def test_password_reset_request_returns_generic_message_and_avoids_enumeration(client, monkeypatch):
    _signup_and_login(
        client,
        username="reset_request_user",
        email="reset_request_user@example.com",
        password="ResetPass123!",
    )

    captured = _capture_reset_email(monkeypatch)

    unknown = client.post(
        "/api/v1/users/request-password-reset",
        json={"email": "missing_reset_user@example.com"},
    )
    assert unknown.status_code == 200
    assert unknown.json() == {"message": "If that email is registered, a reset link has been sent"}
    assert captured == {}

    known = client.post(
        "/api/v1/users/request-password-reset",
        json={"email": "reset_request_user@example.com"},
    )
    assert known.status_code == 200
    assert known.json() == {"message": "If that email is registered, a reset link has been sent"}
    assert captured["to_email"] == "reset_request_user@example.com"
    assert isinstance(captured.get("reset_code"), str)
    assert len(captured["reset_code"]) > 20
    assert "reset-password/reset" in captured["reset_url"]


@pytest.mark.integration
def test_password_reset_flow_verifies_code_and_replaces_old_password(client, monkeypatch):
    original_password = "OriginalReset123!"
    new_password = "UpdatedReset456!"

    _signup_and_login(
        client,
        username="reset_flow_user",
        email="reset_flow_user@example.com",
        password=original_password,
    )

    captured = _capture_reset_email(monkeypatch)

    request_reset = client.post(
        "/api/v1/users/request-password-reset",
        json={"email": "reset_flow_user@example.com"},
    )
    assert request_reset.status_code == 200

    reset_code = captured.get("reset_code")
    assert isinstance(reset_code, str)
    assert len(reset_code) > 20

    verify = client.post(
        "/api/v1/users/verify-reset-code",
        json={"email": "reset_flow_user@example.com", "code": reset_code},
    )
    assert verify.status_code == 200

    mismatched_email = client.post(
        "/api/v1/users/verify-reset-code",
        json={"email": "wrong@example.com", "code": reset_code},
    )
    assert mismatched_email.status_code == 400

    reset = client.post(
        "/api/v1/users/reset-password",
        json={
            "email": "reset_flow_user@example.com",
            "code": reset_code,
            "new_password": new_password,
        },
    )
    assert reset.status_code == 200
    assert reset.json() == {"message": "Password reset successful"}

    old_login = client.post(
        "/api/v1/users/login-json",
        json={"username": "reset_flow_user", "password": original_password, "grant_type": "password"},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/v1/users/login-json",
        json={"username": "reset_flow_user", "password": new_password, "grant_type": "password"},
    )
    assert new_login.status_code == 200
    assert isinstance(new_login.json().get("access_token"), str)
