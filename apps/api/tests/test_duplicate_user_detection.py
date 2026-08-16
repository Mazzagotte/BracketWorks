from sqlalchemy import select

from app.core import models


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
