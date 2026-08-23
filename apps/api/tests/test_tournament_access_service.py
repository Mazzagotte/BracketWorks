from __future__ import annotations

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core import models
from app.services.tournament_access import (
    ROLE_PERMISSIONS,
    verify_owned_tc_tournament_access,
    verify_owned_tournament_access,
)


def _create_tournament(db: Session, owner: models.User) -> models.Tournament:
    tournament = models.Tournament(
        user_id=owner.id,
        name="Owner Event",
        location="Center",
        start_date="2026-08-02",
        end_date="2026-08-03",
        squad_times="{}",
        is_public=False,
    )
    db.add(tournament)
    db.commit()
    db.refresh(tournament)
    return tournament


def _create_tc_tournament(db: Session, owner: models.User) -> models.TournamentCentral:
    tournament = models.TournamentCentral(
        user_id=owner.id,
        name="Owner TC Event",
        location="Center",
        start_date="2026-08-02",
        end_date="2026-08-03",
        squad_times="{}",
        is_public=False,
    )
    db.add(tournament)
    db.commit()
    db.refresh(tournament)
    return tournament


def test_verify_owned_tournament_access_allows_owner(db_session: Session, make_user):
    owner = make_user("access_owner")
    tournament = _create_tournament(db_session, owner)

    resolved = verify_owned_tournament_access(db_session, tournament.id, owner)

    assert resolved.id == tournament.id


def test_verify_owned_tournament_access_allows_admin(db_session: Session, make_user):
    owner = make_user("access_owner_admin")
    admin = make_user("access_admin", is_admin=True)
    tournament = _create_tournament(db_session, owner)

    resolved = verify_owned_tournament_access(db_session, tournament.id, admin)

    assert resolved.id == tournament.id


def test_verify_owned_tournament_access_denies_outsider(db_session: Session, make_user):
    owner = make_user("access_owner_forbidden")
    outsider = make_user("access_outsider")
    tournament = _create_tournament(db_session, owner)

    with pytest.raises(HTTPException) as raised:
        verify_owned_tournament_access(db_session, tournament.id, outsider)

    assert raised.value.status_code == 403
    assert raised.value.detail == "Not authorized to access this tournament"


def test_verify_owned_tournament_access_uses_custom_forbidden_detail(db_session: Session, make_user):
    owner = make_user("access_owner_custom")
    outsider = make_user("access_outsider_custom")
    tournament = _create_tournament(db_session, owner)

    with pytest.raises(HTTPException) as raised:
        verify_owned_tournament_access(
            db_session,
            tournament.id,
            outsider,
            forbidden_detail="Access denied",
        )

    assert raised.value.status_code == 403
    assert raised.value.detail == "Access denied"


def test_verify_owned_tournament_access_returns_404_for_missing_tournament(db_session: Session, make_user):
    user = make_user("access_missing")

    with pytest.raises(HTTPException) as raised:
        verify_owned_tournament_access(db_session, 999_999, user)

    assert raised.value.status_code == 404
    assert raised.value.detail == "Tournament not found"


def test_verify_owned_tc_tournament_access_denies_outsider(db_session: Session, make_user):
    owner = make_user("tc_access_owner")
    outsider = make_user("tc_access_outsider")
    tournament = _create_tc_tournament(db_session, owner)

    with pytest.raises(HTTPException) as raised:
        verify_owned_tc_tournament_access(db_session, tournament.id, outsider)

    assert raised.value.status_code == 403
    assert raised.value.detail == "Not authorized to access this tournament"


@pytest.mark.parametrize(
    ("role", "allowed"),
    [
        ("tournament_admin", {"view", "manage_tournament", "manage_entries", "manage_scores", "manage_payouts", "manage_staff", "archive"}),
        ("entries_manager", {"view", "manage_entries"}),
        ("scorer", {"view", "manage_scores"}),
        ("viewer", {"view"}),
    ],
)
def test_staff_role_permission_matrix(db_session: Session, make_user, role, allowed):
    owner = make_user(f"matrix_owner_{role}")
    staff = make_user(f"matrix_staff_{role}")
    tournament = _create_tournament(db_session, owner)
    db_session.add(models.TournamentStaffMember(
        tournament_id=tournament.id, user_id=staff.id, role=role, invited_by_user_id=owner.id,
    ))
    db_session.commit()

    for permission in set().union(*ROLE_PERMISSIONS.values()):
        if permission in allowed:
            assert verify_owned_tournament_access(db_session, tournament.id, staff, permission=permission).id == tournament.id
        else:
            with pytest.raises(HTTPException) as raised:
                verify_owned_tournament_access(db_session, tournament.id, staff, permission=permission)
            assert raised.value.status_code == 403


@pytest.mark.parametrize("state", ["archived", "finalized"])
def test_read_only_tournament_blocks_staff_mutations(db_session: Session, make_user, state):
    owner = make_user(f"readonly_owner_{state}")
    staff = make_user(f"readonly_staff_{state}")
    tournament = _create_tournament(db_session, owner)
    if state == "archived":
        from datetime import datetime, timezone
        tournament.archived_at = datetime.now(timezone.utc)
    else:
        tournament.lifecycle_status = "finalized"
    db_session.add(models.TournamentStaffMember(
        tournament_id=tournament.id, user_id=staff.id, role="tournament_admin", invited_by_user_id=owner.id,
    ))
    db_session.commit()

    assert verify_owned_tournament_access(db_session, tournament.id, staff, permission="view").id == tournament.id
    with pytest.raises(HTTPException) as raised:
        verify_owned_tournament_access(db_session, tournament.id, staff, permission="manage_tournament")
    assert raised.value.status_code == 409
