"""Versioned recurring legal-disclosure policy and acceptance lookup."""

from __future__ import annotations

import hashlib
from datetime import datetime

from sqlalchemy.orm import Session

from . import models

VERSION = "2026.08"
TITLE = "BracketWorks Periodic Use Disclosure"
EFFECTIVE_DATE = "August 2, 2026"
BODY = (
    "BracketWorks provides tools for managing bowling tournament entries, brackets, scores, standings, side pots, payouts, and public results.",
    "Tournament directors remain responsible for reviewing entries, scores, bracket advancement, standings, payout calculations, and published results for accuracy.",
    "BracketWorks is under active development. Features may change, and temporary errors or interruptions may occur. Maintain an independent backup of important tournament records.",
    "Public Live View information may be provisional until the tournament director has reviewed and finalized the applicable results.",
)
ACKNOWLEDGMENT = (
    "I have reviewed this disclosure and agree to verify tournament data and results before relying on or publishing them."
)


def content_hash() -> str:
    content = "\n".join((VERSION, TITLE, EFFECTIVE_DATE, *BODY, ACKNOWLEDGMENT))
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def latest_acceptance(db: Session, user_id: int) -> models.LegalDisclosureAcceptance | None:
    return (
        db.query(models.LegalDisclosureAcceptance)
        .filter(
            models.LegalDisclosureAcceptance.user_id == user_id,
            models.LegalDisclosureAcceptance.disclosure_version == VERSION,
            models.LegalDisclosureAcceptance.disclosure_hash == content_hash(),
        )
        .order_by(models.LegalDisclosureAcceptance.accepted_at.desc())
        .first()
    )


def acceptance_required(db: Session, user_id: int, now: datetime) -> bool:
    acceptance = latest_acceptance(db, user_id)
    return acceptance is None or acceptance.next_required_at <= now
