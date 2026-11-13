"""Account emails are branded for the site the person used: BracketWorks or Tournament Central."""

from __future__ import annotations

from sqlalchemy import select

from app.api.v1 import users as users_module
from app.core import models
from app.services import email_service, tc_emails
from app.services.email_brands import get_brand, normalize_site


def test_normalize_site_defaults_to_bracketworks():
    assert normalize_site(None) == "bracketworks"
    assert normalize_site("") == "bracketworks"
    assert normalize_site("something-else") == "bracketworks"
    assert normalize_site("tournament_central") == "tournament_central"
    assert normalize_site(" Tournament-Central ") == "tournament_central"


def test_bracketworks_payload_keeps_bracketworks_sender_and_links():
    payload = email_service.build_reset_password_payload("a@example.com", reset_token="tok")

    assert payload["from"] == "BracketWorks <no-reply@bracketworks.app>"
    assert payload["subject"] == "Reset your BracketWorks password"
    variables = payload["template"]["variables"]
    assert variables["product_name"] == "BracketWorks"
    assert variables["site_url"] == "https://bracketworks.app"
    assert variables["logo_url"] == "https://bracketworks.app/logo_no_text.svg"
    assert variables["reset_url"] == "https://bracketworks.app/reset-password?token=tok"
    assert variables["support_email"] == "support@bracketworks.app"


def test_tournament_central_payloads_use_tc_sender_name_and_links():
    site = "tournament_central"
    reset = email_service.build_reset_password_payload("a@example.com", reset_token="tok", site=site)
    verify = email_service.build_verify_email_payload("a@example.com", verification_token="v", site=site)
    welcome = email_service.build_welcome_email_payload("a@example.com", first_name="Ann", site=site)
    changed = email_service.build_password_change_email_payload("a@example.com", site=site)
    moved = email_service.build_email_change_email_payload(
        "old@example.com", previous_email="old@example.com", new_email="new@example.com", site=site
    )

    for payload in (reset, verify, welcome, changed, moved):
        assert payload["from"] == "Tournament Central <no-reply@tournamentcentral.app>"
        assert "Tournament Central" in payload["subject"]
        variables = payload["template"]["variables"]
        assert variables["product_name"] == "Tournament Central"
        assert variables["site_url"] == "https://tournamentcentral.app"
        assert variables["logo_url"] == "https://tournamentcentral.app/TC_logo_No_Text.svg"

    assert reset["template"]["variables"]["reset_url"] == "https://tournamentcentral.app/reset-password?token=tok"
    assert verify["template"]["variables"]["verification_url"] == "https://tournamentcentral.app/verify-email?token=v"
    assert welcome["template"]["variables"]["login_url"] == "https://tournamentcentral.app/login"


def test_reset_payload_needs_a_token_or_url():
    assert email_service.build_reset_password_payload("a@example.com") is None


def test_tc_bowler_emails_send_from_tournament_central_domain():
    assert tc_emails._from_address() == "Tournament Central <no-reply@tournamentcentral.app>"
    assert get_brand("tournament_central").from_address == tc_emails._from_address()


def _capture(monkeypatch, name: str) -> list[dict]:
    calls: list[dict] = []

    def fake(*args, **kwargs):
        calls.append({"args": args, **kwargs})
        return True

    monkeypatch.setattr(users_module, name, fake)
    return calls


def _signup(api_client, *, username: str, email: str, site: str | None):
    body = {
        "first_name": "Ann",
        "last_name": "Lee",
        "username": username,
        "organization": "",
        "email": email,
        "password": "Lane-Seven-Strike-2026!",
    }
    if site is not None:
        body["site"] = site
    return api_client.post("/api/v1/users/signup", json=body)


def test_signup_on_tournament_central_brands_welcome_and_verify(api_client, db_session, monkeypatch):
    welcome = _capture(monkeypatch, "sendWelcomeEmail")
    verify = _capture(monkeypatch, "sendVerifyEmail")

    response = _signup(api_client, username="ann_tc", email="ann.tc@example.com", site="tournament_central")

    assert response.status_code == 200
    user = db_session.scalar(select(models.User).where(models.User.username == "ann_tc"))
    assert user.signup_site == "tournament_central"
    assert welcome[0]["site"] == "tournament_central"
    assert verify[0]["site"] == "tournament_central"


def test_signup_without_site_is_bracketworks(api_client, db_session, monkeypatch):
    _capture(monkeypatch, "sendWelcomeEmail")
    _capture(monkeypatch, "sendVerifyEmail")

    response = _signup(api_client, username="ann_bw", email="ann.bw@example.com", site=None)

    assert response.status_code == 200
    user = db_session.scalar(select(models.User).where(models.User.username == "ann_bw"))
    assert user.signup_site == "bracketworks"


def test_password_reset_uses_requested_site_then_signup_site(api_client, db_session, monkeypatch):
    _capture(monkeypatch, "sendWelcomeEmail")
    _capture(monkeypatch, "sendVerifyEmail")
    reset = _capture(monkeypatch, "sendResetPasswordEmail")
    _signup(api_client, username="ann_reset", email="ann.reset@example.com", site="tournament_central")

    api_client.post("/api/v1/users/request-password-reset", json={"email": "ann.reset@example.com"})
    api_client.post(
        "/api/v1/users/request-password-reset",
        json={"email": "ann.reset@example.com", "site": "bracketworks"},
    )

    assert [call["site"] for call in reset] == ["tournament_central", "bracketworks"]
