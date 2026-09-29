from datetime import datetime, timedelta, timezone
from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

from sqlalchemy import func, select

from app.core import models
from app.services.account_cleanup import deactivate_stale_unverified_accounts


def test_admin_can_manage_reusable_bowler_profiles_without_deleting_entry_history(
    api_client,
    db_session,
    make_user,
    make_auth_headers,
):
    admin = make_user("profile_admin", is_admin=True)
    owner = make_user("profile_owner")
    tournament = models.Tournament(user_id=owner.id, name="Profile History", squad_times="{}")
    db_session.add(tournament)
    db_session.flush()
    profile = models.BowlerProfile(
        user_id=owner.id,
        first_name="Jamie",
        last_name="Example",
        usbc_number="PROFILE-100",
        is_active=True,
    )
    db_session.add(profile)
    db_session.flush()
    entry = models.TournamentPlayer(
        tournament_id=tournament.id,
        user_id=owner.id,
        bowler_profile_id=profile.id,
        full_name="Jamie Example",
        usbc_number="PROFILE-100",
    )
    db_session.add(entry)
    db_session.commit()

    headers = make_auth_headers(admin)
    listing = api_client.get("/api/v1/admin/bowlers?search=PROFILE-100", headers=headers)
    assert listing.status_code == 200, listing.text
    assert listing.json()["profiles"][0]["linked_entry_count"] == 1
    assert listing.json()["profiles"][0]["owner_username"] == owner.username
    owner_listing = api_client.get(f"/api/v1/admin/bowlers?user_id={owner.id}", headers=headers)
    assert owner_listing.status_code == 200, owner_listing.text
    assert {item["user_id"] for item in owner_listing.json()["profiles"]} == {owner.id}

    updated = api_client.patch(
        f"/api/v1/admin/bowlers/{profile.id}",
        headers=headers,
        json={"first_name": "Jamie", "last_name": "Updated", "usbc_number": "PROFILE-101", "average": 188},
    )
    assert updated.status_code == 200, updated.text
    db_session.refresh(entry)
    db_session.refresh(profile)
    assert entry.full_name == "Jamie Updated"
    assert entry.usbc_number == "PROFILE-101"
    assert profile.average == 188

    archived = api_client.delete(f"/api/v1/admin/bowlers/{profile.id}", headers=headers)
    assert archived.status_code == 200, archived.text
    db_session.refresh(entry)
    db_session.refresh(profile)
    assert entry.id is not None
    assert profile.is_active is False

    regular_user = make_user("profile_regular")
    denied = api_client.get("/api/v1/admin/bowlers", headers=make_auth_headers(regular_user))
    assert denied.status_code == 403


def test_admin_profile_import_reports_duplicates(api_client, db_session, make_user, make_auth_headers):
    admin = make_user("profile_import_admin", is_admin=True)
    owner = make_user("profile_import_owner")
    response = api_client.post(
        "/api/v1/admin/bowlers/import",
        headers=make_auth_headers(admin),
        json={
            "user_id": owner.id,
            "rows": [
                {"first_name": "Casey", "last_name": "Bowler", "usbc_number": "ABC-1", "average": 181},
                {"first_name": "Other", "last_name": "Name", "usbc_number": "ABC-1"},
                {"first_name": "No", "last_name": "Number"},
            ],
        },
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"created": 2, "duplicates": 1, "user_id": owner.id}
    profiles = db_session.query(models.BowlerProfile).filter_by(user_id=owner.id).all()
    assert len(profiles) == 2
    assert next(profile for profile in profiles if profile.usbc_number == "ABC-1").average == 181


def test_admin_can_parse_bowler_workbook_without_browser_excel_runtime(api_client, make_user, make_auth_headers):
    archive_buffer = BytesIO()
    with ZipFile(archive_buffer, "w", ZIP_DEFLATED) as workbook:
        workbook.writestr(
            "xl/workbook.xml",
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<sheets><sheet name="Profiles" sheetId="1" r:id="rId1"/></sheets></workbook>',
        )
        workbook.writestr(
            "xl/_rels/workbook.xml.rels",
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Target="worksheets/sheet1.xml" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/>'
            '</Relationships>',
        )
        workbook.writestr(
            "xl/sharedStrings.xml",
            '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            '<si><t>First Name</t></si><si><t>Last Name</t></si><si><t>USBC Number</t></si>'
            '<si><t>Average</t></si><si><t>Casey</t></si><si><t>Bowler</t></si><si><t>ABC-1</t></si>'
            '</sst>',
        )
        workbook.writestr(
            "xl/worksheets/sheet1.xml",
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
            '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c>'
            '<c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row>'
            '<row r="2"><c r="A2" t="s"><v>4</v></c><c r="B2" t="s"><v>5</v></c>'
            '<c r="C2" t="s"><v>6</v></c><c r="D2"><v>187</v></c></row>'
            '<row r="3"><c r="A3" t="s"><v>4</v></c><c r="D3"><v>190</v></c></row>'
            '</sheetData></worksheet>',
        )

    admin = make_user("workbook_admin", is_admin=True)
    response = api_client.post(
        "/api/v1/admin/bowlers/parse-workbook",
        headers=make_auth_headers(admin),
        files={"file": ("profiles.xlsx", archive_buffer.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert response.status_code == 200, response.text
    assert response.json() == {
        "rows": [{"first_name": "Casey", "last_name": "Bowler", "usbc_number": "ABC-1", "average": 187}],
        "skipped_rows": 1,
    }

    regular_user = make_user("workbook_regular")
    denied = api_client.post(
        "/api/v1/admin/bowlers/parse-workbook",
        headers=make_auth_headers(regular_user),
        files={"file": ("profiles.xlsx", archive_buffer.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert denied.status_code == 403


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


def test_admin_can_view_announcement_acknowledgments_with_inactive_status(
    api_client,
    db_session,
    make_user,
    make_auth_headers,
):
    admin = make_user("announcement_ack_admin", is_admin=True)
    recipient = make_user("announcement_ack_inactive")
    recipient.is_active = False
    announcement = models.AdminAnnouncement(
        title="Service notice",
        message="Please review this update.",
        audience_type="all",
        status="archived",
        requires_acknowledgment=True,
        created_by_user_id=admin.id,
    )
    db_session.add(announcement)
    db_session.flush()
    acknowledgment = models.UserAcknowledgment(
        user_id=recipient.id,
        content_type="announcement",
        content_id=str(announcement.id),
        version="v2",
    )
    db_session.add(acknowledgment)
    db_session.commit()

    response = api_client.get(
        f"/api/v1/admin/announcements/{announcement.id}/acknowledgments",
        headers=make_auth_headers(admin),
    )

    assert response.status_code == 200
    assert response.json()["users"] == [
        {
            "id": recipient.id,
            "username": recipient.username,
            "first_name": recipient.first_name,
            "last_name": recipient.last_name,
            "email": recipient.email,
            "is_active": False,
            "version": "v2",
            "acknowledged_at": acknowledgment.acknowledged_at.replace(tzinfo=timezone.utc).isoformat(),
        }
    ]

    regular_user = make_user("announcement_ack_regular")
    denied = api_client.get(
        f"/api/v1/admin/announcements/{announcement.id}/acknowledgments",
        headers=make_auth_headers(regular_user),
    )
    assert denied.status_code == 403


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


def test_admin_delete_of_bracketworks_tournament_owner_cascades_owned_tournaments(
    api_client,
    db_session,
    make_user,
    make_auth_headers,
):
    admin = make_user("tc_delete_admin", is_admin=True)
    target = make_user("tc_delete_target")
    target_id = target.id
    standard_tournament = models.Tournament(user_id=target.id, name="Owned standard tournament")
    db_session.add(standard_tournament)
    db_session.flush()
    standard_tournament_id = standard_tournament.id
    db_session.add(
        models.TournamentSetupState(
            tournament_id=standard_tournament.id,
            user_id=target.id,
            payload={},
        )
    )
    db_session.commit()

    preview = api_client.get(
        f"/api/v1/admin/users/{target_id}/delete-preview",
        headers=make_auth_headers(admin),
    )
    assert preview.status_code == 200
    assert preview.json()["impact"]["owned_tournaments"] == 1

    response = api_client.post(
        f"/api/v1/admin/users/{target_id}/delete",
        json={"reason": "Account removal requested", "confirm_text": "DELETE"},
        headers=make_auth_headers(admin),
    )

    assert response.status_code == 200
    assert db_session.get(models.User, target_id) is None
    assert db_session.get(models.Tournament, standard_tournament_id) is None


def test_admin_delete_of_user_cascades_owned_tournaments_in_both_products(
    api_client,
    db_session,
    make_user,
    make_auth_headers,
):
    admin = make_user("tc_delete_admin", is_admin=True)
    target = make_user("tc_delete_target")
    target_id = target.id
    standard_tournament = models.Tournament(user_id=target_id, name="Owned standard tournament")
    tc_tournament = models.TournamentCentral(
        user_id=target_id,
        name="Owned TC tournament",
        location=None,
        start_date=None,
        end_date=None,
        squad_times=None,
        is_public=False,
    )
    other_tc_owner = make_user("tc_other_owner")
    other_tc_tournament = models.TournamentCentral(
        user_id=other_tc_owner.id,
        name="Other owner's TC tournament",
        location=None,
        start_date=None,
        end_date=None,
        squad_times=None,
        is_public=True,
    )
    other_bw_tournament = models.Tournament(user_id=other_tc_owner.id, name="Other owner's BracketWorks tournament")
    db_session.add_all([standard_tournament, tc_tournament, other_tc_tournament, other_bw_tournament])
    db_session.flush()
    standard_tournament_id = standard_tournament.id
    tc_tournament_id = tc_tournament.id
    other_tc_tournament_id = other_tc_tournament.id
    other_bw_tournament_id = other_bw_tournament.id

    shared_profile = models.BowlerProfile(
        user_id=target_id,
        first_name="Target",
        last_name="User",
    )
    db_session.add(shared_profile)
    db_session.flush()
    target_player = models.TournamentPlayer(
        tournament_id=other_bw_tournament_id,
        user_id=target_id,
        bowler_profile_id=shared_profile.id,
        full_name="Target User",
    )
    other_player = models.TournamentPlayer(
        tournament_id=other_bw_tournament_id,
        user_id=other_tc_owner.id,
        bowler_profile_id=shared_profile.id,
        full_name="Other User",
    )
    db_session.add_all([target_player, other_player])
    db_session.flush()

    db_session.add(
        models.TournamentCentralSetupState(
            tournament_id=tc_tournament_id,
            user_id=target_id,
            payload={},
        )
    )
    registration = models.TcRegistration(
        confirmation_code="DELETE-TC-OWNED",
        tournament_id=tc_tournament_id,
        account_user_id=target_id,
        contact_first_name="Target",
        contact_last_name="User",
        contact_email="target@example.com",
        terms_accepted_at=datetime.now(timezone.utc),
        submitted_at=datetime.now(timezone.utc),
    )
    db_session.add(registration)
    db_session.flush()
    bowler = models.TcRegistrationBowler(
        registration_id=registration.id,
        tournament_id=tc_tournament_id,
        user_id=target_id,
        first_name="Target",
        last_name="User",
    )
    entry = models.TcEntry(
        registration_id=registration.id,
        tournament_id=tc_tournament_id,
        event_config_id="singles",
        event_name_snapshot="Singles",
    )
    db_session.add_all([bowler, entry])
    db_session.flush()
    entry_bowler = models.TcEntryBowler(entry_id=entry.id, bowler_id=bowler.id)
    answer = models.TcRegistrationAnswer(
        registration_id=registration.id,
        entry_id=entry.id,
        bowler_id=bowler.id,
        question_config_id="shirt-size",
        question_label_snapshot="Shirt size",
        answer_json={"value": "M"},
    )
    owned_document = models.TcTournamentDocument(
        tournament_id=tc_tournament_id,
        user_id=target_id,
        file_name="owned.pdf",
        mime_type="application/pdf",
        file_size=3,
        file_blob=b"pdf",
    )

    other_registration = models.TcRegistration(
        confirmation_code="DELETE-TC-OTHER",
        tournament_id=other_tc_tournament_id,
        account_user_id=target_id,
        contact_first_name="Target",
        contact_last_name="User",
        contact_email="target@example.com",
        terms_accepted_at=datetime.now(timezone.utc),
        submitted_at=datetime.now(timezone.utc),
    )
    unrelated_registration = models.TcRegistration(
        confirmation_code="DELETE-TC-UNRELATED",
        tournament_id=other_tc_tournament_id,
        contact_first_name="Unrelated",
        contact_last_name="Bowler",
        contact_email="unrelated@example.com",
        terms_accepted_at=datetime.now(timezone.utc),
        submitted_at=datetime.now(timezone.utc),
    )
    db_session.add_all([other_registration, unrelated_registration])
    db_session.flush()
    other_bowler = models.TcRegistrationBowler(
        registration_id=other_registration.id,
        tournament_id=other_tc_tournament_id,
        user_id=target_id,
        first_name="Target",
        last_name="User",
    )
    unrelated_bowler = models.TcRegistrationBowler(
        registration_id=unrelated_registration.id,
        tournament_id=other_tc_tournament_id,
        first_name="Unrelated",
        last_name="Bowler",
    )
    other_document = models.TcTournamentDocument(
        tournament_id=other_tc_tournament_id,
        user_id=target_id,
        file_name="uploaded-by-target.pdf",
        mime_type="application/pdf",
        file_size=3,
        file_blob=b"pdf",
    )
    db_session.add_all([entry_bowler, answer, owned_document, other_bowler, unrelated_bowler, other_document])
    db_session.commit()

    registration_id = registration.id
    bowler_id = bowler.id
    entry_id = entry.id
    entry_bowler_id = entry_bowler.id
    answer_id = answer.id
    owned_document_id = owned_document.id
    other_registration_id = other_registration.id
    other_bowler_id = other_bowler.id
    unrelated_registration_id = unrelated_registration.id
    unrelated_bowler_id = unrelated_bowler.id
    other_document_id = other_document.id
    shared_profile_id = shared_profile.id
    target_player_id = target_player.id
    other_player_id = other_player.id

    preview = api_client.get(
        f"/api/v1/admin/users/{target_id}/delete-preview",
        headers=make_auth_headers(admin),
    )
    assert preview.status_code == 200
    assert preview.json()["impact"]["owned_tournaments"] == 1
    assert preview.json()["impact"]["owned_tc_tournaments"] == 1
    assert preview.json()["impact"]["tc_registrations"] == 2
    assert preview.json()["impact"]["tc_registration_bowlers"] == 2
    assert preview.json()["impact"]["tc_entries"] == 1
    assert preview.json()["impact"]["tc_entry_bowlers"] == 1
    assert preview.json()["impact"]["tc_registration_answers"] == 1
    assert preview.json()["impact"]["tc_tournament_documents"] == 2

    response = api_client.post(
        f"/api/v1/admin/users/{target_id}/delete",
        json={"reason": "Account removal requested", "confirm_text": "DELETE"},
        headers=make_auth_headers(admin),
    )

    assert response.status_code == 200
    assert db_session.get(models.User, target_id) is None
    assert db_session.get(models.Tournament, standard_tournament_id) is None
    assert db_session.get(models.TournamentCentral, tc_tournament_id) is None
    assert db_session.get(models.TournamentCentralSetupState, tc_tournament_id) is None
    assert db_session.get(models.TcRegistration, registration_id) is None
    assert db_session.get(models.TcRegistrationBowler, bowler_id) is None
    assert db_session.get(models.TcEntry, entry_id) is None
    assert db_session.get(models.TcEntryBowler, entry_bowler_id) is None
    assert db_session.get(models.TcRegistrationAnswer, answer_id) is None
    assert db_session.get(models.TcTournamentDocument, owned_document_id) is None
    assert db_session.get(models.TournamentCentral, other_tc_tournament_id) is not None
    assert db_session.get(models.TcRegistration, other_registration_id) is None
    assert db_session.get(models.TcRegistrationBowler, other_bowler_id) is None
    assert db_session.get(models.TcTournamentDocument, other_document_id) is None
    assert db_session.get(models.TcRegistration, unrelated_registration_id) is not None
    assert db_session.get(models.TcRegistrationBowler, unrelated_bowler_id) is not None
    assert db_session.get(models.TournamentPlayer, target_player_id) is None
    assert db_session.get(models.BowlerProfile, shared_profile_id) is None
    surviving_player = db_session.get(models.TournamentPlayer, other_player_id)
    assert surviving_player is not None
    assert surviving_player.bowler_profile_id is None

    for table in models.Base.metadata.tables.values():
        for foreign_key in table.foreign_keys:
            if foreign_key.target_fullname == "users.id":
                remaining_references = db_session.scalar(
                    select(func.count()).select_from(table).where(foreign_key.parent == target_id)
                )
                assert remaining_references == 0, f"{table.name}.{foreign_key.parent.name} still references deleted user"


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
