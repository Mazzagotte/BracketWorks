from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..core import models


def _configured_item(payload: dict, collection: str, config_id: str) -> dict | None:
    return next(
        (
            item for item in (payload.get(collection) or [])
            if isinstance(item, dict) and str(item.get("id") or "") == config_id
        ),
        None,
    )


def resolve_entry_config_snapshots(
    db: Session,
    tournament_id: int,
    *,
    event_config_id: str | None = None,
    division_config_id: str | None = None,
    squad_config_id: str | None = None,
    event_supplied: bool = False,
    division_supplied: bool = False,
    squad_supplied: bool = False,
) -> dict[str, str | None]:
    """Resolve organizer entry relationships from this tournament's setup payload.

    Config IDs are tournament-scoped. Client-provided display snapshots are deliberately
    excluded so callers cannot persist labels from a different configuration.
    """
    state = db.query(models.TournamentCentralSetupState).filter(
        models.TournamentCentralSetupState.tournament_id == tournament_id,
    ).first()
    payload = state.payload if state and isinstance(state.payload, dict) else {}
    resolved: dict[str, str | None] = {}

    if event_supplied:
        event_id = (event_config_id or "").strip()
        if not event_id:
            raise HTTPException(status_code=400, detail="An event selection is required")
        event = _configured_item(payload, "events", event_id)
        if event is None:
            raise HTTPException(status_code=400, detail="Selected event does not belong to this tournament")
        resolved.update(
            event_config_id=event_id,
            event_name_snapshot=str(event.get("name") or event_id).strip(),
        )

    if division_supplied:
        division_id = (division_config_id or "").strip()
        if not division_id:
            resolved.update(division_config_id=None, division_name_snapshot=None)
        else:
            division = _configured_item(payload, "divisions", division_id)
            if division is None:
                raise HTTPException(status_code=400, detail="Selected division does not belong to this tournament")
            resolved.update(
                division_config_id=division_id,
                division_name_snapshot=str(division.get("name") or division_id).strip(),
            )

    if squad_supplied:
        squad_id = (squad_config_id or "").strip()
        if not squad_id:
            resolved.update(
                squad_config_id=None,
                squad_name_snapshot=None,
                squad_date_snapshot=None,
                squad_time_snapshot=None,
            )
        else:
            squad = _configured_item(payload, "squads", squad_id)
            if squad is None:
                raise HTTPException(status_code=400, detail="Selected squad does not belong to this tournament")
            resolved.update(
                squad_config_id=squad_id,
                squad_name_snapshot=str(squad.get("name") or squad_id).strip(),
                squad_date_snapshot=str(squad.get("dateIso") or "").strip() or None,
                squad_time_snapshot=str(squad.get("startTime") or "").strip() or None,
            )

    return resolved
