from datetime import datetime, timedelta, timezone

from app.core import models
from app.services.account_cleanup import deactivate_stale_unverified_accounts


def test_cleanup_deactivates_old_unverified_accounts_without_login(db_session, make_user):
    stale = make_user("stale_unverified")
    stale.created_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=31)
    db_session.commit()

    deactivated = deactivate_stale_unverified_accounts(db_session)

    assert deactivated == 1
    db_session.refresh(stale)
    assert stale.is_active is False


def test_cleanup_preserves_verified_and_recent_accounts(db_session, make_user):
    verified = make_user("verified_user")
    verified.created_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=31)
    verified.email_verified_at = datetime.now(timezone.utc).replace(tzinfo=None)
    recent = make_user("recent_unverified")
    db_session.commit()

    deactivated = deactivate_stale_unverified_accounts(db_session)

    assert deactivated == 0
    db_session.refresh(verified)
    db_session.refresh(recent)
    assert verified.is_active is True
    assert recent.is_active is True


def test_inactive_user_cannot_login(api_client, db_session, make_user):
    inactive = make_user("inactive_login")
    inactive.is_active = False
    db_session.commit()

    response = api_client.post(
        "/api/v1/users/login-json",
        json={"username": inactive.username, "password": "StrongPass1!"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Account is inactive"
