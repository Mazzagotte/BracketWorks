import pytest
from fastapi.testclient import TestClient
from urllib import request as url_request

from app.core.models import Base, EmailVerificationToken, PasswordResetToken, User
from app.api.deps import SessionLocal
from app.api.v1 import users as users_api
from app.services import email_service


def _expected_logo_url() -> str:
    return f"{email_service.settings.FRONTEND_URL.rstrip('/')}/logo.svg"


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

    def fake_send_email(user_email: str, reset_token: str | None = None, reset_url: str | None = None):
        resolved_reset_url = reset_url or email_service.build_reset_password_url(reset_token or "")
        captured.clear()
        captured.update(
            {
                "to_email": user_email,
                "reset_url": resolved_reset_url,
                "reset_code": reset_token or "",
            }
        )
        return True

    monkeypatch.setattr(users_api, "sendResetPasswordEmail", fake_send_email)
    return captured


def _capture_verify_email(monkeypatch: pytest.MonkeyPatch):
    captured: dict[str, str] = {}

    def fake_send_email(user_email: str, verification_token: str | None = None, verification_url: str | None = None):
        resolved_verification_url = verification_url or email_service.build_verify_email_url(verification_token or "")
        captured.clear()
        captured.update(
            {
                "to_email": user_email,
                "verify_url": resolved_verification_url,
                "verify_code": verification_token or "",
            }
        )
        return True

    monkeypatch.setattr(users_api, "sendVerifyEmail", fake_send_email)
    return captured


def _capture_welcome_email(monkeypatch: pytest.MonkeyPatch):
    captured: dict[str, str] = {}

    def fake_send_email(user_email: str, first_name: str | None = None):
        captured.clear()
        captured.update(
            {
                "to_email": user_email,
                "first_name": first_name or "",
            }
        )
        return True

    monkeypatch.setattr(users_api, "sendWelcomeEmail", fake_send_email)
    return captured


def _capture_password_change_email(monkeypatch: pytest.MonkeyPatch):
    captured: dict[str, str] = {}

    def fake_send_email(user_email: str, first_name: str | None = None):
        captured.clear()
        captured.update(
            {
                "to_email": user_email,
                "first_name": first_name or "",
            }
        )
        return True

    monkeypatch.setattr(users_api, "sendPasswordChangeEmail", fake_send_email)
    return captured


def _capture_email_change_email(monkeypatch: pytest.MonkeyPatch):
    captured: dict[str, str] = {}

    def fake_send_email(
        user_email: str,
        *,
        first_name: str | None = None,
        previous_email: str | None = None,
        new_email: str | None = None,
    ):
        captured.clear()
        captured.update(
            {
                "to_email": user_email,
                "first_name": first_name or "",
                "previous_email": previous_email or "",
                "new_email": new_email or "",
            }
        )
        return True

    monkeypatch.setattr(users_api, "sendEmailChangeEmail", fake_send_email)
    return captured


class _FakeResendResponse:
    def __init__(self, status: int = 200):
        self.status = status

    def getcode(self):
        return self.status

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


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
def test_failed_login_then_successful_login_clears_attempts_without_error(client):
    _signup_and_login(
        client,
        username="retry_login_user",
        email="retry_login_user@example.com",
        password="RetryPass123!",
    )

    failed = client.post(
        "/api/v1/users/login-json",
        json={"username": "retry_login_user", "password": "WrongPass123!", "grant_type": "password"},
    )
    assert failed.status_code == 401

    succeeded = client.post(
        "/api/v1/users/login-json",
        json={"username": "retry_login_user", "password": "RetryPass123!", "grant_type": "password"},
    )
    assert succeeded.status_code == 200

    with SessionLocal() as db:
        attempts = (
            db.query(users_api.models.LoginAttempt)
            .filter(users_api.models.LoginAttempt.username == "retry_login_user")
            .all()
        )
        assert attempts == []


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
    assert unknown.json() == {"message": "If an account exists for this email, a password reset link has been sent."}
    assert captured == {}

    known = client.post(
        "/api/v1/users/request-password-reset",
        json={"email": "reset_request_user@example.com"},
    )
    assert known.status_code == 200
    assert known.json() == {"message": "If an account exists for this email, a password reset link has been sent."}
    assert captured["to_email"] == "reset_request_user@example.com"
    assert isinstance(captured.get("reset_code"), str)
    assert len(captured["reset_code"]) > 20
    assert captured["reset_url"].startswith(email_service.build_reset_password_url(""))

    with SessionLocal() as db:
        saved_token = db.query(PasswordResetToken).filter(PasswordResetToken.used_at.is_(None)).one()
        assert saved_token.token_hash == users_api._hash_value(captured["reset_code"])


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
    assert verify.json()["email"] == "reset_flow_user@example.com"

    mismatched_email = client.post(
        "/api/v1/users/verify-reset-code",
        json={"email": "wrong@example.com", "code": reset_code},
    )
    assert mismatched_email.status_code == 400

    reset = client.post(
        "/api/v1/users/reset-password",
        json={
            "code": reset_code,
            "new_password": new_password,
        },
    )
    assert reset.status_code == 200
    assert reset.json() == {"message": "Password reset successful"}

    reused_reset = client.post(
        "/api/v1/users/reset-password",
        json={
            "code": reset_code,
            "new_password": "AnotherPassword789!",
        },
    )
    assert reused_reset.status_code == 400

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


@pytest.mark.integration
def test_password_reset_request_encodes_reset_link_for_email_aliases(client, monkeypatch):
    alias_email = "reset.alias+league@example.com"
    _signup_and_login(
        client,
        username="reset_alias_user",
        email=alias_email,
        password="ResetAlias123!",
    )

    captured = _capture_reset_email(monkeypatch)

    response = client.post(
        "/api/v1/users/request-password-reset",
        json={"email": alias_email},
    )

    assert response.status_code == 200
    assert captured["reset_url"].startswith(email_service.build_reset_password_url(""))
    assert "email=" not in captured["reset_url"]


@pytest.mark.integration
def test_change_password_sends_password_change_email(client, monkeypatch):
    auth = _signup_and_login(
        client,
        username="password_change_user",
        email="password_change_user@example.com",
        password="PasswordChange123!",
    )
    captured = _capture_password_change_email(monkeypatch)

    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    response = client.post(
        "/api/v1/users/change-password",
        headers=headers,
        json={
            "current_password": "PasswordChange123!",
            "new_password": "UpdatedPassword789!",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"message": "Password updated successfully"}
    assert captured == {
        "to_email": "password_change_user@example.com",
        "first_name": "Test",
    }


@pytest.mark.integration
def test_update_email_sends_email_change_notification_and_reissues_verification(client, monkeypatch):
    auth = _signup_and_login(
        client,
        username="email_change_user",
        email="email_change_user@example.com",
        password="EmailChange123!",
    )
    captured_verify = _capture_verify_email(monkeypatch)
    captured_email_change = _capture_email_change_email(monkeypatch)

    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    response = client.put(
        "/api/v1/users/me",
        headers=headers,
        json={"email": "updated_email_user@example.com"},
    )

    assert response.status_code == 200
    assert response.json()["email"] == "updated_email_user@example.com"
    assert response.json()["email_verified"] is False
    assert captured_email_change == {
        "to_email": "email_change_user@example.com",
        "first_name": "Test",
        "previous_email": "email_change_user@example.com",
        "new_email": "updated_email_user@example.com",
    }
    assert captured_verify["to_email"] == "updated_email_user@example.com"
    assert captured_verify["verify_url"].startswith(email_service.build_verify_email_url(""))

    with SessionLocal() as db:
        updated_user = db.query(User).filter(User.username == "email_change_user").first()
        assert updated_user is not None
        assert updated_user.email == "updated_email_user@example.com"
        assert updated_user.email_verified_at is None

        tokens = db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == updated_user.id).all()
        assert len(tokens) == 2
        assert sum(1 for token in tokens if token.used_at is None) == 1


def test_send_reset_password_email_uses_resend_hosted_template(monkeypatch):
    sent: dict[str, object] = {}

    def fake_urlopen(req: url_request.Request, timeout: int):
        sent["timeout"] = timeout
        sent["body"] = req.data.decode("utf-8")
        sent["url"] = req.full_url
        return _FakeResendResponse(202)

    monkeypatch.setenv("RESEND_API_KEY", "re_test_key")
    monkeypatch.setattr(
        email_service,
        "url_request",
        type("_ReqModule", (), {"Request": url_request.Request, "urlopen": fake_urlopen}),
    )

    result = email_service.sendResetPasswordEmail(
        "player@example.com",
        reset_token="abc123",
    )

    assert result is True
    assert sent["url"] == "https://api.resend.com/emails"
    assert sent["timeout"] == 15
    payload = email_service.json.loads(sent["body"])
    assert payload == {
        "from": "BracketWorks <no-reply@bracketworks.app>",
        "to": "player@example.com",
        "subject": "Reset your BracketWorks password",
        "template": {
            "id": "reset-password",
            "variables": {
                "logo_url": _expected_logo_url(),
                "reset_url": email_service.build_reset_password_url("abc123"),
                "expiration_minutes": "10",
                "support_email": "support@bracketworks.app",
            },
        },
    }


def test_send_reset_password_email_returns_false_without_api_key(monkeypatch):
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    monkeypatch.setattr(email_service.settings, "RESEND_API_KEY", "")

    result = email_service.sendResetPasswordEmail("player@example.com", reset_token="abc123")

    assert result is False


@pytest.mark.integration
def test_signup_sends_verification_email_and_persists_token(client, monkeypatch):
    captured_verify = _capture_verify_email(monkeypatch)
    captured_welcome = _capture_welcome_email(monkeypatch)

    response = client.post(
        "/api/v1/users/signup",
        json={
            "first_name": "Verify",
            "last_name": "User",
            "username": "verify_signup_user",
            "email": "verify_signup_user@example.com",
            "password": "VerifyPass123!",
        },
    )

    assert response.status_code == 200
    assert response.json()["email_verified"] is False
    assert captured_welcome == {
        "to_email": "verify_signup_user@example.com",
        "first_name": "Verify",
    }
    assert captured_verify["to_email"] == "verify_signup_user@example.com"
    assert len(captured_verify["verify_code"]) > 20
    assert captured_verify["verify_url"].startswith(email_service.build_verify_email_url(""))

    with SessionLocal() as db:
        saved_token = db.query(EmailVerificationToken).filter(EmailVerificationToken.used_at.is_(None)).one()
        assert saved_token.token_hash == users_api._hash_value(captured_verify["verify_code"])


@pytest.mark.integration
def test_verify_email_marks_user_verified_and_consumes_token(client, monkeypatch):
    captured = _capture_verify_email(monkeypatch)

    signup = client.post(
        "/api/v1/users/signup",
        json={
            "first_name": "Verify",
            "last_name": "Flow",
            "username": "verify_flow_user",
            "email": "verify_flow_user@example.com",
            "password": "VerifyFlow123!",
        },
    )
    assert signup.status_code == 200

    verify = client.post(
        "/api/v1/users/verify-email",
        json={"token": captured["verify_code"]},
    )
    assert verify.status_code == 200
    assert verify.json() == {"message": "Email verified successfully"}

    repeat = client.post(
        "/api/v1/users/verify-email",
        json={"token": captured["verify_code"]},
    )
    assert repeat.status_code == 400

    login = client.post(
        "/api/v1/users/login-json",
        json={"username": "verify_flow_user", "password": "VerifyFlow123!", "grant_type": "password"},
    )
    assert login.status_code == 200

    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    me = client.get("/api/v1/users/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email_verified"] is True
    assert me.json()["email_verified_at"] is not None


@pytest.mark.integration
def test_request_email_verification_reissues_token_for_unverified_user(client, monkeypatch):
    captured = _capture_verify_email(monkeypatch)

    signup = client.post(
        "/api/v1/users/signup",
        json={
            "first_name": "Resend",
            "last_name": "Verify",
            "username": "verify_resend_user",
            "email": "verify_resend_user@example.com",
            "password": "VerifyResend123!",
        },
    )
    assert signup.status_code == 200
    first_token = captured["verify_code"]

    login = client.post(
        "/api/v1/users/login-json",
        json={"username": "verify_resend_user", "password": "VerifyResend123!", "grant_type": "password"},
    )
    assert login.status_code == 200

    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    resend = client.post("/api/v1/users/request-email-verification", headers=headers)
    assert resend.status_code == 200
    assert resend.json() == {"message": "Verification email sent"}
    assert captured["verify_code"] != first_token

    with SessionLocal() as db:
        tokens = db.query(EmailVerificationToken).order_by(EmailVerificationToken.id.asc()).all()
        assert len(tokens) == 2
        assert tokens[0].used_at is not None
        assert tokens[1].used_at is None


def test_send_verify_email_uses_resend_hosted_template(monkeypatch):
    sent: dict[str, object] = {}

    def fake_urlopen(req: url_request.Request, timeout: int):
        sent["timeout"] = timeout
        sent["body"] = req.data.decode("utf-8")
        sent["url"] = req.full_url
        return _FakeResendResponse(202)

    monkeypatch.setenv("RESEND_API_KEY", "re_test_key")
    monkeypatch.setattr(
        email_service,
        "url_request",
        type("_ReqModule", (), {"Request": url_request.Request, "urlopen": fake_urlopen}),
    )

    result = email_service.sendVerifyEmail(
        "player@example.com",
        verification_token="verify123",
    )

    assert result is True
    assert sent["url"] == "https://api.resend.com/emails"
    assert sent["timeout"] == 15
    payload = email_service.json.loads(sent["body"])
    assert payload == {
        "from": "BracketWorks <no-reply@bracketworks.app>",
        "to": "player@example.com",
        "subject": "Verify your BracketWorks email",
        "template": {
            "id": "verify-email",
            "variables": {
                "logo_url": _expected_logo_url(),
                "verify_url": email_service.build_verify_email_url("verify123"),
                "verification_url": email_service.build_verify_email_url("verify123"),
                "verify_email_url": email_service.build_verify_email_url("verify123"),
                "verification_link": email_service.build_verify_email_url("verify123"),
                "action_url": email_service.build_verify_email_url("verify123"),
                "button_url": email_service.build_verify_email_url("verify123"),
                "link_url": email_service.build_verify_email_url("verify123"),
                "expiration_minutes": "30",
                "support_email": "support@bracketworks.app",
            },
        },
    }


def test_send_welcome_email_uses_resend_hosted_template(monkeypatch):
    sent: dict[str, object] = {}

    def fake_urlopen(req: url_request.Request, timeout: int):
        sent["timeout"] = timeout
        sent["body"] = req.data.decode("utf-8")
        sent["url"] = req.full_url
        return _FakeResendResponse(202)

    monkeypatch.setenv("RESEND_API_KEY", "re_test_key")
    monkeypatch.setattr(
        email_service,
        "url_request",
        type("_ReqModule", (), {"Request": url_request.Request, "urlopen": fake_urlopen}),
    )

    result = email_service.sendWelcomeEmail("player@example.com", first_name="Taylor")

    assert result is True
    assert sent["url"] == "https://api.resend.com/emails"
    assert sent["timeout"] == 15
    payload = email_service.json.loads(sent["body"])
    assert payload == {
        "from": "BracketWorks <no-reply@bracketworks.app>",
        "to": "player@example.com",
        "subject": "Welcome to BracketWorks",
        "template": {
            "id": "welcome-email",
            "variables": {
                "logo_url": _expected_logo_url(),
                "support_email": "support@bracketworks.app",
                "first_name": "Taylor",
            },
        },
    }


def test_send_password_change_email_uses_resend_hosted_template(monkeypatch):
    sent: dict[str, object] = {}

    def fake_urlopen(req: url_request.Request, timeout: int):
        sent["timeout"] = timeout
        sent["body"] = req.data.decode("utf-8")
        sent["url"] = req.full_url
        return _FakeResendResponse(202)

    monkeypatch.setenv("RESEND_API_KEY", "re_test_key")
    monkeypatch.setattr(
        email_service,
        "url_request",
        type("_ReqModule", (), {"Request": url_request.Request, "urlopen": fake_urlopen}),
    )

    result = email_service.sendPasswordChangeEmail("player@example.com", first_name="Taylor")

    assert result is True
    assert sent["url"] == "https://api.resend.com/emails"
    assert sent["timeout"] == 15
    payload = email_service.json.loads(sent["body"])
    assert payload == {
        "from": "BracketWorks <no-reply@bracketworks.app>",
        "to": "player@example.com",
        "subject": "Your BracketWorks password was changed",
        "template": {
            "id": "password-change",
            "variables": {
                "logo_url": _expected_logo_url(),
                "support_email": "support@bracketworks.app",
                "first_name": "Taylor",
            },
        },
    }


def test_send_email_change_email_uses_resend_hosted_template(monkeypatch):
    sent: dict[str, object] = {}

    def fake_urlopen(req: url_request.Request, timeout: int):
        sent["timeout"] = timeout
        sent["body"] = req.data.decode("utf-8")
        sent["url"] = req.full_url
        return _FakeResendResponse(202)

    monkeypatch.setenv("RESEND_API_KEY", "re_test_key")
    monkeypatch.setattr(
        email_service,
        "url_request",
        type("_ReqModule", (), {"Request": url_request.Request, "urlopen": fake_urlopen}),
    )

    result = email_service.sendEmailChangeEmail(
        "old@example.com",
        first_name="Taylor",
        previous_email="old@example.com",
        new_email="new@example.com",
    )

    assert result is True
    assert sent["url"] == "https://api.resend.com/emails"
    assert sent["timeout"] == 15
    payload = email_service.json.loads(sent["body"])
    assert payload == {
        "from": "BracketWorks <no-reply@bracketworks.app>",
        "to": "old@example.com",
        "subject": "Your BracketWorks email was changed",
        "template": {
            "id": "email-change",
            "variables": {
                "logo_url": _expected_logo_url(),
                "support_email": "support@bracketworks.app",
                "first_name": "Taylor",
                "previous_email": "old@example.com",
                "new_email": "new@example.com",
            },
        },
    }
