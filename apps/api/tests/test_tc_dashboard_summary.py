"""The organizer dashboard's per-tournament registration summary (/tc/organizer-setup/mine)."""

from __future__ import annotations

import pytest

from app.core import models
from app.middleware.rate_limit import rate_limiter
from app.services import tc_emails
from tests.test_tc_manage import _register, _setup, _tournament


@pytest.fixture(autouse=True)
def _quiet(monkeypatch):
    monkeypatch.setattr(tc_emails, "_post_resend", lambda path, body: True)
    rate_limiter._memory_store.clear()
    yield


def _mine(api_client, headers) -> dict[int, dict]:
    response = api_client.get("/api/v1/tc/organizer-setup/mine", headers=headers)
    assert response.status_code == 200, response.text
    return {row["tournament_id"]: row for row in response.json()}


def test_summary_has_the_registration_window_visibility_and_spots(
    api_client, db_session, make_user, make_auth_headers
):
    owner = make_user("dashboard_summary_owner")
    tournament = _tournament(db_session, owner.id)
    _register(api_client, tournament)

    row = _mine(api_client, make_auth_headers(owner))[tournament.id]
    # Times are in the tournament's time zone (America/Denver): opens at midnight, closes at 11:59 PM.
    assert row["registration_opens_at"].startswith("2020-01-01T00:00:00")
    assert row["registration_closes_at"].startswith("2099-12-30T23:59:00")
    assert row["visibility"] is None  # the test setup doesn't set one
    assert row["spots_total"] == 200  # two squads of 100 bowlers
    assert row["spots_filled"] == 2  # one doubles team


def test_summary_reads_the_published_setup_and_skips_spots_without_a_limit(
    api_client, db_session, make_user, make_auth_headers
):
    owner = make_user("dashboard_snapshot_owner")
    tournament = _tournament(db_session, owner.id)
    state = db_session.query(models.TournamentCentralSetupState).filter_by(tournament_id=tournament.id).one()

    published = _setup()
    published["details"]["visibility"] = "unlisted"
    draft = _setup()
    draft["details"]["visibility"] = "private"
    draft["squads"][1]["capacity"] = 0  # an unpublished edit removes a squad's limit
    state.payload = {**draft, "_publishedSnapshot": published}
    db_session.commit()

    row = _mine(api_client, make_auth_headers(owner))[tournament.id]
    assert row["visibility"] == "unlisted"
    assert row["spots_total"] == 200

    state.payload = draft
    state.is_published = False
    db_session.commit()
    row = _mine(api_client, make_auth_headers(owner))[tournament.id]
    assert row["visibility"] == "private"
    assert row["spots_total"] is None
    assert row["spots_filled"] == 0
