from __future__ import annotations

from typing import TypeVar

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..core import models

TournamentModelT = TypeVar("TournamentModelT", models.Tournament, models.TournamentCentral)


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
) -> models.Tournament:
    return _verify_owned_tournament_access(
        db,
        models.Tournament,
        tournament_id,
        user,
        forbidden_detail=forbidden_detail,
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
