from app.core import models


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
