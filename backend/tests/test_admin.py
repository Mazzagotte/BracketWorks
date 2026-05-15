import pytest

from app.api.deps import SessionLocal
from app.core.models import User


@pytest.mark.integration
def test_admin_email_previews_returns_filled_auth_email_payloads(client):
    signup = client.post(
        "/api/v1/users/signup",
        json={
            "first_name": "Admin",
            "last_name": "User",
            "username": "admin_preview_user",
            "email": "admin_preview_user@example.com",
            "password": "AdminPreview123!",
        },
    )
    assert signup.status_code == 200

    with SessionLocal() as db:
        admin_user = db.query(User).filter(User.username == "admin_preview_user").first()
        assert admin_user is not None
        admin_user.is_admin = True
        db.commit()

    login = client.post(
        "/api/v1/users/login-json",
        json={"username": "admin_preview_user", "password": "AdminPreview123!", "grant_type": "password"},
    )
    assert login.status_code == 200

    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.get("/api/v1/admin/email-previews", headers=headers)
    assert response.status_code == 200

    payload = response.json()
    assert len(payload["emails"]) == 5

    verify_preview = next(email for email in payload["emails"] if email["slug"] == "verify-email")
    assert verify_preview["template_id"] == "verify-email"
    assert verify_preview["primary_action_label"] == "Verify Email"
    assert verify_preview["primary_action_url"].startswith("http://localhost:3000/verify-email?token=")
    assert verify_preview["variables"]["verify_url"] == verify_preview["primary_action_url"]
    assert verify_preview["variables"]["verification_url"] == verify_preview["primary_action_url"]
    assert verify_preview["variables"]["verify_email_url"] == verify_preview["primary_action_url"]
    assert verify_preview["variables"]["button_url"] == verify_preview["primary_action_url"]
    assert verify_preview["variables"]["logo_url"].endswith("/logo.svg")
