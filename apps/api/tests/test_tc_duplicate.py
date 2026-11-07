import json

from app.core import models
from app.services.tc_setup_validation import PUBLISHED_SNAPSHOT_KEY


def _source_tournament(db, owner):
    tournament = models.TournamentCentral(
        user_id=owner.id,
        name="Fall Classic",
        location="Sunset Lanes, Boise, ID",
        start_date="2026-11-14",
        end_date="2026-11-15",
        squad_times=json.dumps({"2026-11-14": ["09:00"], "2026-11-15": ["13:00"]}),
        is_public=True,
        is_published=True,
        logo_blob=b"logo-bytes",
        logo_mime_type="image/png",
        logo_file_name="logo.png",
    )
    db.add(tournament)
    db.flush()
    payload = {
        "details": {
            "name": "Fall Classic",
            "startDateIso": "2026-11-14",
            "endDateIso": "2026-11-15",
            "registrationOpenIso": "2026-09-01",
            "registrationCloseIso": "2026-11-08",
            "visibility": "public",
        },
        "squads": [
            {"id": "sat", "name": "Saturday", "dateIso": "2026-11-14", "startTime": "09:00", "capacity": 40},
            {"id": "sun", "name": "Sunday", "dateIso": "2026-11-15", "startTime": "13:00", "capacity": 40},
        ],
        "events": [{"id": "singles", "name": "Singles", "enabled": True}],
    }
    db.add(models.TournamentCentralSetupState(
        tournament_id=tournament.id,
        user_id=owner.id,
        payload={**payload, PUBLISHED_SNAPSHOT_KEY: payload},
        is_published=True,
    ))
    db.add(models.TcTournamentDocument(
        tournament_id=tournament.id,
        user_id=owner.id,
        doc_type="rules",
        file_name="rules.pdf",
        mime_type="application/pdf",
        file_size=5,
        file_blob=b"rules",
    ))
    db.commit()
    db.refresh(tournament)
    return tournament


def test_duplicate_moves_every_date_and_starts_unpublished(api_client, db_session, auth_identity):
    source = _source_tournament(db_session, auth_identity.user)

    response = api_client.post(
        f"/api/v1/tc/tournaments/{source.id}/duplicate",
        headers=auth_identity.headers,
        json={"name": "Fall Classic 2027", "start_date": "2027-11-13"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["name"] == "Fall Classic 2027"
    assert body["start_date"] == "2027-11-13"
    assert body["end_date"] == "2027-11-14"
    assert body["is_public"] is False
    assert body["has_logo"] is True

    copy = db_session.get(models.TournamentCentral, body["id"])
    assert copy.is_published is False
    assert json.loads(copy.squad_times) == {"2027-11-13": ["09:00"], "2027-11-14": ["13:00"]}

    state = db_session.query(models.TournamentCentralSetupState).filter_by(tournament_id=copy.id).one()
    assert state.is_published is False
    assert PUBLISHED_SNAPSHOT_KEY not in state.payload
    details = state.payload["details"]
    assert details["name"] == "Fall Classic 2027"
    assert (details["startDateIso"], details["endDateIso"]) == ("2027-11-13", "2027-11-14")
    assert (details["registrationOpenIso"], details["registrationCloseIso"]) == ("2027-08-31", "2027-11-07")
    assert [squad["dateIso"] for squad in state.payload["squads"]] == ["2027-11-13", "2027-11-14"]
    assert state.payload["events"] == [{"id": "singles", "name": "Singles", "enabled": True}]

    documents = db_session.query(models.TcTournamentDocument).filter_by(tournament_id=copy.id).all()
    assert [(document.file_name, document.file_blob) for document in documents] == [("rules.pdf", b"rules")]
    assert db_session.query(models.TcRegistration).filter_by(tournament_id=copy.id).count() == 0

    # The original is untouched.
    original_state = db_session.query(models.TournamentCentralSetupState).filter_by(tournament_id=source.id).one()
    assert original_state.payload["details"]["startDateIso"] == "2026-11-14"


def test_duplicate_without_new_date_keeps_dates_and_can_skip_documents(api_client, db_session, auth_identity):
    source = _source_tournament(db_session, auth_identity.user)

    response = api_client.post(
        f"/api/v1/tc/tournaments/{source.id}/duplicate",
        headers=auth_identity.headers,
        json={"name": "Fall Classic copy", "include_documents": False},
    )

    assert response.status_code == 200, response.text
    assert response.json()["start_date"] == "2026-11-14"
    assert db_session.query(models.TcTournamentDocument).filter_by(tournament_id=response.json()["id"]).count() == 0


def test_duplicate_requires_manage_permission(api_client, db_session, auth_identity, make_user, make_auth_headers):
    source = _source_tournament(db_session, auth_identity.user)
    viewer = make_user("tc_duplicate_viewer")
    db_session.add(models.TcTournamentStaffMember(
        tournament_id=source.id, user_id=viewer.id, role="viewer", invited_by_user_id=auth_identity.user.id,
    ))
    stranger = make_user("tc_duplicate_stranger")
    db_session.commit()

    for headers in (make_auth_headers(viewer), make_auth_headers(stranger)):
        response = api_client.post(
            f"/api/v1/tc/tournaments/{source.id}/duplicate", headers=headers, json={"name": "Nope"},
        )
        assert response.status_code == 403

    bad_date = api_client.post(
        f"/api/v1/tc/tournaments/{source.id}/duplicate",
        headers=auth_identity.headers,
        json={"name": "Bad", "start_date": "next year"},
    )
    assert bad_date.status_code == 400
