from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import models


@dataclass
class IdempotencyReplay:
    status_code: int
    response_body: dict[str, Any]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _fingerprint(payload: dict[str, Any] | None) -> str:
    encoded = json.dumps(payload or {}, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def begin_request(
    db: Session,
    *,
    endpoint_scope: str,
    idempotency_key: str,
    request_payload: dict[str, Any] | None,
    user_id: int | None,
    ttl_minutes: int = 1440,
) -> IdempotencyReplay | models.IdempotencyKey:
    key = (idempotency_key or "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="Idempotency key cannot be empty")

    now = _utcnow()
    fingerprint = _fingerprint(request_payload)

    existing = (
        db.query(models.IdempotencyKey)
        .filter(
            models.IdempotencyKey.idempotency_key == key,
            models.IdempotencyKey.endpoint_scope == endpoint_scope,
        )
        .first()
    )

    if existing:
        if existing.request_fingerprint != fingerprint:
            raise HTTPException(
                status_code=409,
                detail="Idempotency key was already used with a different request payload",
            )
        if existing.state == "completed" and existing.response_body is not None and existing.status_code is not None:
            return IdempotencyReplay(status_code=existing.status_code, response_body=existing.response_body)
        if existing.state == "processing" and existing.expires_at > now:
            raise HTTPException(status_code=409, detail="Request with this idempotency key is still processing")

        existing.state = "processing"
        existing.updated_at = now
        existing.expires_at = now + timedelta(minutes=ttl_minutes)
        existing.status_code = None
        existing.response_body = None
        db.flush()
        return existing

    record = models.IdempotencyKey(
        idempotency_key=key,
        endpoint_scope=endpoint_scope,
        request_fingerprint=fingerprint,
        user_id=user_id,
        state="processing",
        created_at=now,
        updated_at=now,
        expires_at=now + timedelta(minutes=ttl_minutes),
    )
    db.add(record)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        duplicate = (
            db.query(models.IdempotencyKey)
            .filter(
                models.IdempotencyKey.idempotency_key == key,
                models.IdempotencyKey.endpoint_scope == endpoint_scope,
            )
            .first()
        )
        if duplicate and duplicate.request_fingerprint == fingerprint and duplicate.state == "completed" and duplicate.response_body:
            return IdempotencyReplay(status_code=duplicate.status_code or 200, response_body=duplicate.response_body)
        raise HTTPException(status_code=409, detail="Idempotency key collision, please retry")

    return record


def complete_request(db: Session, record: models.IdempotencyKey, *, status_code: int, response_body: dict[str, Any]) -> None:
    now = _utcnow()
    record.state = "completed"
    record.status_code = status_code
    record.response_body = response_body
    record.updated_at = now


def fail_request(db: Session, record: models.IdempotencyKey) -> None:
    record.state = "failed"
    record.updated_at = _utcnow()
