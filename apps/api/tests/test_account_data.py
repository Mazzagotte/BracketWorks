import json

from app.core import models


def test_account_export_contains_profile_and_owned_tournament_history(api_client, db_session, auth_identity):
    tournament = models.Tournament(user_id=auth_identity.user.id, name="Export Event", squad_times="{}")
    db_session.add(tournament)
    db_session.flush()
    db_session.add(models.TournamentAuditLog(
        tournament_id=tournament.id, event_type="test", user_id=auth_identity.user.id,
        user_display_name="Test User", summary="Exported history",
    ))
    db_session.commit()
    response = api_client.get("/api/v1/users/account/export", headers=auth_identity.headers)
    assert response.status_code == 200
    assert "attachment" in response.headers["content-disposition"]
    payload = json.loads(response.content)
    assert payload["format"] == "bracketworks-account-export"
    assert payload["profile"]["email"] == auth_identity.user.email
    assert payload["owned_tournaments"][0]["tournament"]["name"] == "Export Event"
    assert payload["owned_tournaments"][0]["tables"]["tournament_audit_logs"][0]["summary"] == "Exported history"


def test_account_deletion_is_blocked_until_tournament_ownership_is_resolved(api_client, db_session, auth_identity):
    db_session.add(models.Tournament(user_id=auth_identity.user.id, name="Owned Event", squad_times="{}"))
    db_session.commit()
    preview = api_client.get("/api/v1/users/account/deletion-preview", headers=auth_identity.headers)
    assert preview.status_code == 200
    assert preview.json()["can_delete"] is False
    response = api_client.post("/api/v1/users/account/delete", headers=auth_identity.headers, json={
        "current_password": "StrongPass1!", "confirmation": f"DELETE {auth_identity.user.username}",
    })
    assert response.status_code == 409


def test_account_deletion_requires_password_and_confirmation_then_anonymizes(api_client, db_session, auth_identity):
    preview = api_client.get("/api/v1/users/account/deletion-preview", headers=auth_identity.headers).json()
    wrong = api_client.post("/api/v1/users/account/delete", headers=auth_identity.headers, json={
        "current_password": "wrong", "confirmation": preview["confirmation_phrase"],
    })
    assert wrong.status_code == 400
    response = api_client.post("/api/v1/users/account/delete", headers=auth_identity.headers, json={
        "current_password": "StrongPass1!", "confirmation": preview["confirmation_phrase"],
    })
    assert response.status_code == 200
    db_session.refresh(auth_identity.user)
    assert auth_identity.user.is_active is False
    assert auth_identity.user.first_name == "Deleted"
    assert auth_identity.user.email.endswith("@deleted.invalid")
    assert db_session.query(models.LegalDisclosureAcceptance).filter_by(user_id=auth_identity.user.id).count() == 1
    assert api_client.get("/api/v1/users/me", headers=auth_identity.headers).status_code == 401
