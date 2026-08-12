from __future__ import annotations

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core import models
from app.services.tournament_access import (
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
