from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, func
from sqlalchemy.orm import Session

from ..core import models
from .tournament_state import AUTHORITATIVE_TOURNAMENT_ROW_MODELS

DELETE_ORDER = (
    models.PayoutAdjustment,
    models.BracketPayout,
    models.BracketWinner,
    models.TournamentPayoutSummary,
    models.BracketSnapshot,
    models.FirstRoundMatchupHistory,
    models.ScoreCorrection,
    models.PlayerScore,
    models.DuplicatePlayerResolution,
    models.TournamentPlayer,
    models.TournamentBracketSettings,
    models.TournamentSetupState,
    models.TournamentSquad,
)

# Authoritative state is restored exactly. Access control, audit history, and restore
# points are intentionally preserved; no derived tournament tables require storage.
SNAPSHOT_TABLE_CLASSIFICATION = {
    "included_and_restored": tuple(model.__tablename__ for model in AUTHORITATIVE_TOURNAMENT_ROW_MODELS) + ("user_squad_selections",),
    "intentionally_preserved": (
        "tournament_staff_members", "tournament_staff_invitations",
        "tournament_audit_logs", "tournament_restore_points",
    ),
    "intentionally_reset": (),
    "derived_and_recalculated": (),
}

TOURNAMENT_FIELDS = (
    "name", "location", "start_date", "end_date", "squad_times", "is_public",
    "archived_at", "archive_reason", "lifecycle_status", "scores_locked",
    "finalized_at", "finalized_by_user_id",
)


def _json_value(value: Any) -> Any:
    return value.isoformat() if isinstance(value, datetime) else value


def _serialize_row(row: Any) -> dict[str, Any]:
    return {column.name: _json_value(getattr(row, column.name)) for column in row.__table__.columns}


def _deserialize_row(model: type, values: dict[str, Any]):
    decoded = dict(values)
    for column in model.__table__.columns:
        if isinstance(column.type, DateTime) and decoded.get(column.name):
            decoded[column.name] = datetime.fromisoformat(decoded[column.name])
    return model(**decoded)


def create_restore_point(
    db: Session, *, tournament_id: int, user: models.User, trigger: str, summary: str,
) -> models.TournamentRestorePoint:
    tournament = db.get(models.Tournament, tournament_id)
    if not tournament:
        raise ValueError("Tournament not found")
    payload: dict[str, Any] = {
        "version": 2,
        "tournament": {field: _json_value(getattr(tournament, field)) for field in TOURNAMENT_FIELDS},
        "tables": {},
    }
    for model in AUTHORITATIVE_TOURNAMENT_ROW_MODELS:
        payload["tables"][model.__tablename__] = [
            _serialize_row(row)
            for row in db.query(model).filter(model.tournament_id == tournament_id).all()
        ]
    squad_ids = [row[0] for row in db.query(models.TournamentSquad.id).filter_by(tournament_id=tournament_id).all()]
    payload["tables"]["user_squad_selections"] = [
        _serialize_row(row)
        for row in db.query(models.UserSquadSelection).filter(
            models.UserSquadSelection.tournament_squad_id.in_(squad_ids)
        ).all()
    ] if squad_ids else []
    payload["classification"] = SNAPSHOT_TABLE_CLASSIFICATION
    watermark = db.query(func.max(models.TournamentAuditLog.id)).filter(
        models.TournamentAuditLog.tournament_id == tournament_id
    ).scalar()
    restore_point = models.TournamentRestorePoint(
        tournament_id=tournament_id, created_by_user_id=user.id, trigger=trigger,
        summary=summary[:500], payload=payload, activity_watermark_id=watermark,
    )
    db.add(restore_point)
    db.flush()
    return restore_point


def later_activity_count(db: Session, restore_point: models.TournamentRestorePoint) -> int:
    query = db.query(func.count(models.TournamentAuditLog.id)).filter(
        models.TournamentAuditLog.tournament_id == restore_point.tournament_id
    )
    if restore_point.activity_watermark_id is not None:
        query = query.filter(models.TournamentAuditLog.id > restore_point.activity_watermark_id)
    return query.scalar() or 0


def restore_snapshot_state(db: Session, restore_point: models.TournamentRestorePoint) -> None:
    tournament_id = restore_point.tournament_id
    payload = restore_point.payload
    tournament = db.get(models.Tournament, tournament_id)
    if not tournament:
        raise ValueError("Tournament not found")

    squad_ids = [row[0] for row in db.query(models.TournamentSquad.id).filter(models.TournamentSquad.tournament_id == tournament_id).all()]
    if squad_ids:
        db.query(models.UserSquadSelection).filter(models.UserSquadSelection.tournament_squad_id.in_(squad_ids)).delete(synchronize_session=False)
    for model in DELETE_ORDER:
        db.query(model).filter(model.tournament_id == tournament_id).delete(synchronize_session=False)
    db.flush()

    for field, value in payload["tournament"].items():
        column = models.Tournament.__table__.columns[field]
        if isinstance(column.type, DateTime) and value:
            value = datetime.fromisoformat(value)
        setattr(tournament, field, value)

    model_by_table = {model.__tablename__: model for model in AUTHORITATIVE_TOURNAMENT_ROW_MODELS}
    for model in reversed(DELETE_ORDER):
        for values in payload["tables"].get(model.__tablename__, []):
            db.add(_deserialize_row(model_by_table[model.__tablename__], values))
        db.flush()
    for values in payload["tables"].get("user_squad_selections", []):
        db.add(_deserialize_row(models.UserSquadSelection, values))
    db.flush()
