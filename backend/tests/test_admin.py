from datetime import datetime, timedelta

import pytest

from app.api.deps import SessionLocal
from app.core.models import AdminAuditLog, AuthSession, EmailVerificationToken, IdempotencyKey, PasswordResetToken, User


@pytest.mark.integration
def test_admin_can_delete_user_with_auth_artifacts(client):
    admin_signup = client.post(
        "/api/v1/users/signup",
        json={
            "first_name": "Delete",
            "last_name": "Admin",
            "username": "delete_admin_user",
            "email": "delete_admin_user@example.com",
            "password": "DeleteAdmin123!",
        },
    )
    assert admin_signup.status_code == 200

    target_signup = client.post(
        "/api/v1/users/signup",
        json={
            "first_name": "Delete",
            "last_name": "Target",
            "username": "delete_target_user",
            "email": "delete_target_user@example.com",
            "password": "DeleteTarget123!",
        },
    )
    assert target_signup.status_code == 200

    expires_at = datetime.utcnow() + timedelta(days=1)

    with SessionLocal() as db:
        admin_user = db.query(User).filter(User.username == "delete_admin_user").first()
        target_user = db.query(User).filter(User.username == "delete_target_user").first()
        assert admin_user is not None
        assert target_user is not None

        admin_user.is_admin = True
        target_user.is_admin = True

        db.add(
            AuthSession(
                session_id="delete-target-session",
                user_id=target_user.id,
                token_family="delete-target-family",
                refresh_token_hash="delete-target-refresh-hash",
                expires_at=expires_at,
            )
        )
        db.add(
            IdempotencyKey(
                idempotency_key="delete-target-idempotency",
                endpoint_scope="admin.delete-user",
                request_fingerprint="delete-target-request",
                user_id=target_user.id,
                expires_at=expires_at,
            )
        )
        db.add(
            PasswordResetToken(
                user_id=target_user.id,
                token_hash="delete-target-reset-token",
                expires_at=expires_at,
            )
        )
        db.add(
            EmailVerificationToken(
                user_id=target_user.id,
                email=target_user.email,
                token_hash="delete-target-verify-token",
                expires_at=expires_at,
            )
        )
        db.add(
            AdminAuditLog(
                admin_user_id=target_user.id,
                action="user.test-artifact",
                target_type="user",
                target_id=str(target_user.id),
                reason="Seed delete coverage",
            )
        )
        db.commit()
        target_user_id = target_user.id

    login = client.post(
        "/api/v1/users/login-json",
        json={"username": "delete_admin_user", "password": "DeleteAdmin123!", "grant_type": "password"},
    )
    assert login.status_code == 200

    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    preview = client.get(f"/api/v1/admin/users/{target_user_id}/delete-preview", headers=headers)
    assert preview.status_code == 200
    preview_payload = preview.json()
    assert preview_payload["impact"]["auth_sessions"] == 1
    assert preview_payload["impact"]["idempotency_keys"] == 1
    assert preview_payload["impact"]["password_reset_tokens"] == 1
    assert preview_payload["impact"]["email_verification_tokens"] == 1
    assert preview_payload["impact"]["admin_audit_logs_authored"] == 1

    response = client.post(
        f"/api/v1/admin/users/{target_user_id}/delete",
        headers=headers,
        json={"reason": "Cleanup seeded account", "confirm_text": "DELETE"},
    )
    assert response.status_code == 200
    assert response.json()["impact"]["auth_sessions"] == 1

    with SessionLocal() as db:
        assert db.get(User, target_user_id) is None
        assert db.query(AuthSession).filter(AuthSession.user_id == target_user_id).count() == 0
        assert db.query(IdempotencyKey).filter(IdempotencyKey.user_id == target_user_id).count() == 0
        assert db.query(PasswordResetToken).filter(PasswordResetToken.user_id == target_user_id).count() == 0
        assert db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == target_user_id).count() == 0
        assert db.query(AdminAuditLog).filter(AdminAuditLog.admin_user_id == target_user_id).count() == 0


@pytest.mark.integration
def test_admin_users_response_includes_verification_and_last_login(client):
    admin_signup = client.post(
        "/api/v1/users/signup",
        json={
            "first_name": "Users",
            "last_name": "Admin",
            "username": "users_admin_user",
            "email": "users_admin_user@example.com",
            "password": "UsersAdmin123!",
        },
    )
    assert admin_signup.status_code == 200

    member_signup = client.post(
        "/api/v1/users/signup",
        json={
            "first_name": "Verified",
            "last_name": "Member",
            "username": "verified_member_user",
            "email": "verified_member_user@example.com",
            "password": "VerifiedMember123!",
        },
    )
    assert member_signup.status_code == 200

    now = datetime.utcnow()

    with SessionLocal() as db:
        admin_user = db.query(User).filter(User.username == "users_admin_user").first()
        member_user = db.query(User).filter(User.username == "verified_member_user").first()
        assert admin_user is not None
        assert member_user is not None

        admin_user.is_admin = True
        member_user.email_verified_at = now
        db.add(
            AuthSession(
                session_id="verified-member-session",
                user_id=member_user.id,
                token_family="verified-member-family",
                refresh_token_hash="verified-member-refresh-hash",
                issued_at=now,
                last_seen_at=now,
                expires_at=now + timedelta(days=1),
            )
        )
        db.commit()

    login = client.post(
        "/api/v1/users/login-json",
        json={"username": "users_admin_user", "password": "UsersAdmin123!", "grant_type": "password"},
    )
    assert login.status_code == 200

    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.get("/api/v1/admin/users", headers=headers)
    assert response.status_code == 200

    payload = response.json()
    member = next(user for user in payload["users"] if user["username"] == "verified_member_user")
    assert member["email_verified"] is True
    assert member["email_verified_at"] is not None
    assert member["email_verified_at"].endswith("+00:00")
    assert member["last_login_at"] is not None
    assert member["last_login_at"].endswith("+00:00")
