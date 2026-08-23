from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from ..core import models


def user_display_name(user: models.User | None) -> str:
    if user is None:
        return "System"
    full_name = f"{user.first_name} {user.last_name}".strip()
    return full_name or user.username


def record_tournament_event(
    db: Session,
    *,
    tournament_id: int,
    event_type: str,
    user: models.User | None,
    summary: str,
    before_values: dict[str, Any] | None = None,
    after_values: dict[str, Any] | None = None,
    reason: str | None = None,
    entity_type: str | None = None,
    entity_id: int | str | None = None,
) -> models.TournamentAuditLog:
    """Stage an audit event in the caller's transaction.

    The caller owns commit/rollback so an event can never survive a failed mutation.
    """
    event = models.TournamentAuditLog(
        tournament_id=tournament_id,
        event_type=event_type,
        user_id=user.id if user else None,
        user_display_name=user_display_name(user),
        summary=summary.strip()[:500],
        before_values=before_values,
        after_values=after_values,
        reason=reason.strip() if reason else None,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
    )
    db.add(event)
    return event
