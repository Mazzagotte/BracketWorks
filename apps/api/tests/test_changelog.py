from app.core import models


def test_public_changelog_serializes_legacy_and_structured_entries(api_client, db_session):
    db_session.add_all([
        models.Changelog(version="1.0", date="2026-08-01", changes=["Legacy fix"]),
        models.Changelog(
            version="2.0",
            date="2026-08-23",
            changes=[],
            title="Major update",
            summary="Tournament controls and reliability.",
            sections=[{"heading": "Recovery", "items": ["Added restore points."]}],
            tags=["New", "Reliability"],
        ),
    ])
    db_session.commit()

    response = api_client.get("/api/v1/users/changelog")

    assert response.status_code == 200
    entries = response.json()["entries"]
    assert entries[0]["title"] == "Major update"
    assert entries[0]["sections"][0]["items"] == ["Added restore points."]
    assert entries[0]["tags"] == ["New", "Reliability"]
    assert entries[1]["changes"] == ["Legacy fix"]
    assert entries[1]["sections"] is None


def test_admin_can_create_and_edit_structured_changelog(api_client, db_session, make_user, make_auth_headers):
    admin = make_user("changelog_admin", is_admin=True)
    headers = make_auth_headers(admin)
    payload = {
        "version": "3.0",
        "date": "2026-08-23",
        "changes": [],
        "title": "Major update",
        "summary": "A focused release.",
        "sections": [{"heading": "Security", "items": ["Added server checks."]}],
        "tags": ["Security"],
    }

    created = api_client.post("/api/v1/admin/changelog", json=payload, headers=headers)
    assert created.status_code == 200
    persisted = db_session.query(models.Changelog).filter_by(version="3.0").one()
    assert persisted.sections == payload["sections"]

    updated = api_client.put(
        "/api/v1/admin/changelog/3.0",
        json={**payload, "title": "Edited update", "sections": [{"heading": "Fixes", "items": ["Fixed loading."]}]},
        headers=headers,
    )
    assert updated.status_code == 200
    db_session.refresh(persisted)
    assert persisted.title == "Edited update"
    assert persisted.sections[0]["heading"] == "Fixes"

    date_only = api_client.put(
        "/api/v1/admin/changelog/3.0",
        json={"date": "2026-08-24"},
        headers=headers,
    )
    assert date_only.status_code == 200
    db_session.refresh(persisted)
    assert persisted.date == "2026-08-24"
    assert persisted.title == "Edited update"


def test_structured_changelog_validation_rejects_malformed_content(api_client, make_user, make_auth_headers):
    admin = make_user("invalid_changelog_admin", is_admin=True)
    headers = make_auth_headers(admin)
    base = {"version": "4.0", "date": "2026-08-23", "changes": [], "title": "Update"}

    empty_sections = api_client.post("/api/v1/admin/changelog", json={**base, "sections": []}, headers=headers)
    empty_bullet = api_client.post("/api/v1/admin/changelog", json={**base, "sections": [{"heading": "Fixes", "items": [""]}]}, headers=headers)
    invalid_tag = api_client.post("/api/v1/admin/changelog", json={**base, "sections": [{"heading": "Fixes", "items": ["Done"]}], "tags": ["Urgent"]}, headers=headers)
    long_title = api_client.post("/api/v1/admin/changelog", json={**base, "title": "x" * 121, "sections": [{"heading": "Fixes", "items": ["Done"]}]}, headers=headers)

    assert empty_sections.status_code == 422
    assert empty_bullet.status_code == 422
    assert invalid_tag.status_code == 422
    assert long_title.status_code == 422


def test_changelog_text_is_returned_as_data_not_renderable_html(api_client, db_session):
    unsafe = '<img src=x onerror="alert(1)">'
    db_session.add(models.Changelog(version="5.0", date="2026-08-23", changes=[], title="Safe", sections=[{"heading": "Fixes", "items": [unsafe]}]))
    db_session.commit()

    response = api_client.get("/api/v1/users/changelog")

    assert response.json()["entries"][0]["sections"][0]["items"][0] == unsafe
    assert response.headers["content-type"].startswith("application/json")
