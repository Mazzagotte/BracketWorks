from sqlalchemy import select

from app.core import models


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
