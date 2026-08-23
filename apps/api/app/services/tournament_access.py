from __future__ import annotations

from typing import Literal, TypeVar

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..core import models

TournamentModelT = TypeVar("TournamentModelT", models.Tournament, models.TournamentCentral)
TournamentPermission = Literal["view", "manage_tournament", "manage_entries", "manage_scores", "manage_payouts", "manage_staff", "archive"]

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "tournament_admin": {"view", "manage_tournament", "manage_entries", "manage_scores", "manage_payouts", "manage_staff", "archive"},
    "entries_manager": {"view", "manage_entries"},
    "scorer": {"view", "manage_scores"},
    "viewer": {"view"},
}


def _verify_owned_tournament_access(
    db: Session,
    tournament_model: type[TournamentModelT],
    tournament_id: int,
    user: models.User,
    *,
    forbidden_detail: str = "Not authorized to access this tournament",
) -> TournamentModelT:
    tournament = db.query(tournament_model).filter(tournament_model.id == tournament_id).first()
    if not tournament:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")

    if tournament.user_id != user.id and not getattr(user, "is_admin", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=forbidden_detail)

    return tournament


def verify_owned_tournament_access(
    db: Session,
    tournament_id: int,
    user: models.User,
    *,
    forbidden_detail: str = "Not authorized to access this tournament",
    permission: TournamentPermission = "manage_tournament",
    allow_read_only_mutation: bool = False,
) -> models.Tournament:
    tournament = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")
    if tournament.user_id == user.id or getattr(user, "is_admin", False):
        if tournament.archived_at is not None and permission not in {"view", "archive"}:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Archived tournaments are read-only; restore the tournament before editing")
        if tournament.lifecycle_status == "finalized" and permission not in {"view", "archive"} and not allow_read_only_mutation:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Finalized tournaments are read-only")
        return tournament
    membership = db.query(models.TournamentStaffMember).filter(
        models.TournamentStaffMember.tournament_id == tournament_id,
        models.TournamentStaffMember.user_id == user.id,
    ).first()
    if membership and permission in ROLE_PERMISSIONS.get(membership.role, set()):
        if tournament.archived_at is not None and permission not in {"view", "archive"}:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Archived tournaments are read-only; restore the tournament before editing")
        if tournament.lifecycle_status == "finalized" and permission not in {"view", "archive"} and not allow_read_only_mutation:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Finalized tournaments are read-only")
        return tournament
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=forbidden_detail)


def require_tournament_permission(
    db: Session, tournament_id: int, user: models.User, permission: TournamentPermission,
    *, forbidden_detail: str = "You do not have permission to perform this tournament action",
    allow_read_only_mutation: bool = False,
) -> models.Tournament:
    return verify_owned_tournament_access(
        db, tournament_id, user, permission=permission, forbidden_detail=forbidden_detail,
        allow_read_only_mutation=allow_read_only_mutation,
    )


def verify_owned_tc_tournament_access(
    db: Session,
    tournament_id: int,
    user: models.User,
    *,
    forbidden_detail: str = "Not authorized to access this tournament",
) -> models.TournamentCentral:
    return _verify_owned_tournament_access(
        db,
        models.TournamentCentral,
        tournament_id,
        user,
        forbidden_detail=forbidden_detail,
    )
