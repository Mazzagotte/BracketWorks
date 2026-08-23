from datetime import datetime, timedelta, timezone

from sqlalchemy import select

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


def test_admin_support_views_include_user_and_tournament_operational_context(api_client, db_session, make_user, make_auth_headers):
    admin = make_user("support_admin", is_admin=True)
    owner = make_user("support_owner")
    staff = make_user("support_staff")
    tournament = models.Tournament(user_id=owner.id, name="Support Search Event", squad_times="{}", lifecycle_status="in_progress")
    db_session.add(tournament)
    db_session.flush()
    db_session.add(models.TournamentStaffMember(tournament_id=tournament.id, user_id=staff.id, role="scorer", invited_by_user_id=owner.id))
    db_session.add(models.TournamentAuditLog(tournament_id=tournament.id, event_type="score.updated", user_id=staff.id, user_display_name="Support Staff", summary="Updated a score"))
    db_session.commit()
    headers = make_auth_headers(admin)

    tournament_response = api_client.get(f"/api/v1/admin/tournaments?search={tournament.id}", headers=headers)
    assert tournament_response.status_code == 200
    result = tournament_response.json()["tournaments"][0]
    assert result["id"] == tournament.id
    assert result["workflow_status"] == "in_progress"
    assert result["staff"][0]["role"] == "scorer"
    assert result["recent_audit_events"][0]["summary"] == "Updated a score"

    user_response = api_client.get(f"/api/v1/admin/users/{staff.id}/review", headers=headers)
    assert user_response.status_code == 200
    detail = user_response.json()
    assert detail["user"]["is_active"] is True
    assert detail["staff_memberships"][0]["tournament_id"] == tournament.id


def test_system_health_is_admin_only_and_checks_dependencies(api_client, db_session, make_user, make_auth_headers):
    admin = make_user("health_admin", is_admin=True)
    regular = make_user("health_regular")
    denied = api_client.get("/api/v1/admin/system-health", headers=make_auth_headers(regular))
    assert denied.status_code == 403
    response = api_client.get("/api/v1/admin/system-health", headers=make_auth_headers(admin))
    assert response.status_code == 200
    health = response.json()
    assert health["api"]["status"] == "healthy"
    assert health["database"]["status"] == "healthy"
    assert health["backend_version"]
    assert "account_cleanup" in health["background_jobs"]["runtime"]
    assert isinstance(health["recent_errors"], list)


def test_admin_can_delete_announcement_and_acknowledgments(
    api_client,
    db_session,
    make_user,
    make_auth_headers,
):
    admin = make_user("announcement_admin", is_admin=True)
    recipient = make_user("announcement_recipient")
    announcement = models.AdminAnnouncement(
        title="Temporary notice",
        message="This notice can be removed.",
        audience_type="all",
        status="active",
        requires_acknowledgment=True,
        created_by_user_id=admin.id,
    )
    db_session.add(announcement)
    db_session.commit()
    db_session.refresh(announcement)
    db_session.add(
        models.UserAcknowledgment(
            user_id=recipient.id,
            content_type="announcement",
            content_id=str(announcement.id),
            version="v1",
        )
    )
    db_session.commit()
    announcement_id = announcement.id

    response = api_client.delete(
        f"/api/v1/admin/announcements/{announcement_id}",
        headers=make_auth_headers(admin),
    )

    assert response.status_code == 200
    assert response.json() == {"ok": True, "acknowledgments_deleted": 1}
    assert db_session.get(models.AdminAnnouncement, announcement_id) is None
    assert db_session.scalars(
        select(models.UserAcknowledgment).where(
            models.UserAcknowledgment.content_type == "announcement",
            models.UserAcknowledgment.content_id == str(announcement_id),
        )
    ).all() == []


def test_admin_can_delete_user_with_legal_acceptance(
    api_client,
    db_session,
    make_user,
    make_auth_headers,
):
    admin = make_user("delete_admin", is_admin=True)
    target = make_user("delete_target")
    target_id = target.id

    response = api_client.post(
        f"/api/v1/admin/users/{target_id}/delete",
        json={"reason": "Account removal requested", "confirm_text": "DELETE"},
        headers=make_auth_headers(admin),
    )

    assert response.status_code == 200
    assert db_session.get(models.User, target_id) is None
    assert db_session.query(models.LegalDisclosureAcceptance).filter_by(user_id=target_id).count() == 0


def test_admin_delete_of_tc_owner_returns_clear_error(
    api_client,
    db_session,
    make_user,
    make_auth_headers,
):
    admin = make_user("tc_delete_admin", is_admin=True)
    target = make_user("tc_delete_target")
    db_session.add(
        models.TournamentCentral(
            user_id=target.id,
            name="Owned TC tournament",
            location=None,
            start_date=None,
            end_date=None,
            squad_times=None,
            is_public=False,
        )
    )
    db_session.commit()

    response = api_client.post(
        f"/api/v1/admin/users/{target.id}/delete",
        json={"reason": "Account removal requested", "confirm_text": "DELETE"},
        headers=make_auth_headers(admin),
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "User owns tournaments. Reassign or delete them first."
    assert db_session.get(models.User, target.id) is not None


def test_signup_flags_similar_first_name_and_last_name(
    api_client,
    db_session,
    make_user,
):
    admin = make_user("duplicate_admin", is_admin=True)
    existing = make_user("tim_oliver", is_admin=False)
    existing.first_name = "Tim"
    existing.last_name = "Oliver"
    db_session.commit()

    response = api_client.post(
        "/api/v1/users/signup",
        json={
            "first_name": "Timothy",
            "last_name": "Oliver",
            "username": "timothy_oliver",
            "organization": "",
            "email": "timothy.oliver@example.com",
            "password": "Timothy-Unique-2026!X",
        },
    )

    assert response.status_code == 200
    new_user = db_session.scalar(select(models.User).where(models.User.username == "timothy_oliver"))
    assert new_user is not None
    review = db_session.scalar(
        select(models.AdminUserReview).where(
            models.AdminUserReview.user_id == new_user.id,
            models.AdminUserReview.category == "duplicate",
        )
    )
    assert review is not None
    assert review.kind == "flag"
    assert review.admin_user_id == admin.id
    assert "Tim Oliver" in review.note


def test_signup_does_not_flag_different_first_name_with_same_last_name(
    api_client,
    db_session,
    make_user,
):
    make_user("different_name_admin", is_admin=True)
    make_user("jane_oliver")
    existing = db_session.scalar(select(models.User).where(models.User.username == "jane_oliver"))
    existing.first_name = "Jane"
    existing.last_name = "Oliver"
    db_session.commit()

    response = api_client.post(
        "/api/v1/users/signup",
        json={
            "first_name": "Marcus",
            "last_name": "Oliver",
            "username": "marcus_oliver",
            "organization": "",
            "email": "marcus.oliver@example.com",
            "password": "Marcus-Unique-2026!X",
        },
    )

    assert response.status_code == 200
    new_user = db_session.scalar(select(models.User).where(models.User.username == "marcus_oliver"))
    assert new_user is not None
    assert db_session.scalar(
        select(models.AdminUserReview).where(
            models.AdminUserReview.user_id == new_user.id,
            models.AdminUserReview.category == "duplicate",
        )
    ) is None


def test_public_tournament_source_filters_keep_bw_and_tc_separate(api_client, db_session, make_user):
    owner = make_user("source_owner")
    db_session.add_all(
        [
            models.Tournament(
                user_id=owner.id,
                name="BW tournament",
                location="Boise, ID",
                start_date="2026-09-01",
                end_date="2026-09-01",
                is_public=True,
            ),
            models.TournamentCentral(
                user_id=owner.id,
                name="TC tournament",
                location="Meridian, ID",
                start_date="2026-10-01",
                end_date="2026-10-01",
                squad_times="{}",
                is_public=True,
            ),
        ]
    )
    db_session.commit()

    bw_response = api_client.get("/api/v1/public/tournaments?source=bw")
    tc_response = api_client.get("/api/v1/public/tournaments?source=tc")

    assert bw_response.status_code == 200
    assert tc_response.status_code == 200
    assert [item["name"] for item in bw_response.json()["tournaments"]] == ["BW tournament"]
    assert [item["name"] for item in tc_response.json()["tournaments"]] == ["TC tournament"]


def test_authenticated_user_can_submit_feedback(api_client, db_session, auth_identity):
    response = api_client.post(
        "/api/v1/users/feedback",
        json={
            "category": "feature",
            "subject": "Add tournament exports",
            "message": "Please add a CSV export for public standings.",
        },
        headers=auth_identity.headers,
    )

    assert response.status_code == 200
    feedback = db_session.scalar(
        select(models.UserFeedbackMessage).where(
            models.UserFeedbackMessage.user_id == auth_identity.user.id
        )
    )
    assert feedback is not None
    assert feedback.category == "feature"
    assert feedback.status == "open"


def test_admin_can_list_and_update_feedback(api_client, db_session, make_user, make_auth_headers):
    admin = make_user("feedback_admin", is_admin=True)
    user = make_user("feedback_user")
    feedback = models.UserFeedbackMessage(
        user_id=user.id,
        category="problem",
        subject="Scores disappeared",
        message="The score table was empty after refresh.",
    )
    db_session.add(feedback)
    db_session.commit()
    db_session.refresh(feedback)

    headers = make_auth_headers(admin)
    listed = api_client.get("/api/v1/admin/feedback", headers=headers)
    assert listed.status_code == 200
    assert listed.json()["messages"][0]["subject"] == "Scores disappeared"

    updated = api_client.patch(
        f"/api/v1/admin/feedback/{feedback.id}",
        json={"status": "resolved", "admin_note": "Investigated and fixed."},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "resolved"
    assert updated.json()["admin_note"] == "Investigated and fixed."


def test_non_admin_cannot_list_feedback(api_client, auth_identity):
    response = api_client.get("/api/v1/admin/feedback", headers=auth_identity.headers)
    assert response.status_code == 403
