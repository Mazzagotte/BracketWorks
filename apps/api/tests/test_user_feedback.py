from sqlalchemy import select

from app.core import models


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
