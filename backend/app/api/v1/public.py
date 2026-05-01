"""
Public read-only endpoints for the bowler-facing tournament view.
No authentication required — intended for QR-code accessible display pages.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
import logging
import re
import unicodedata

from ..deps import get_db
from ...core import models
from ...core.bracket_programs import normalize_bowler_bracket_entries, normalize_division
from ...services.bracket_persistence_simple import load_brackets_simple, load_generated_brackets
from ...services.payouts import get_tournament_winners_summary, extract_bracket_winners

router = APIRouter()
logger = logging.getLogger(__name__)


def _get_tournament_or_404(db: Session, tournament_id: int) -> models.Tournament:
    tournament = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    return tournament


def _get_tournament_by_name_or_404(db: Session, tournament_name: str) -> models.Tournament:
    name = (tournament_name or "").strip()
    if not name:
        raise HTTPException(status_code=404, detail="Tournament not found")

    matches = (
        db.query(models.Tournament)
        .filter(func.lower(models.Tournament.name) == name.lower())
        .order_by(models.Tournament.id.desc())
        .all()
    )
    if not matches:
        raise HTTPException(status_code=404, detail="Tournament not found")

    if len(matches) > 1:
        logger.warning(
            "Multiple tournaments matched public name lookup '%s'; using most recent id=%s",
            name,
            matches[0].id,
        )

    return matches[0]


def _slugify_tournament_name(name: str) -> str:
    normalized = unicodedata.normalize("NFKD", name or "")
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    lowered = ascii_only.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", lowered).strip("-")
    return slug


def _get_tournament_by_slug_or_404(db: Session, tournament_slug: str) -> models.Tournament:
    slug = (tournament_slug or "").strip().lower()
    if not slug:
        raise HTTPException(status_code=404, detail="Tournament not found")

    candidates = db.query(models.Tournament).order_by(models.Tournament.id.desc()).all()
    matches = [t for t in candidates if _slugify_tournament_name(t.name) == slug]

    if not matches:
        raise HTTPException(status_code=404, detail="Tournament not found")

    if len(matches) > 1:
        logger.warning(
            "Multiple tournaments matched public slug lookup '%s'; using most recent id=%s",
            slug,
            matches[0].id,
        )

    return matches[0]


@router.get("/tournament/{tournament_id}")
def get_public_tournament_info(
    tournament_id: int,
    db: Session = Depends(get_db),
):
    """Tournament name, location, and squads — no auth required."""
    tournament = _get_tournament_or_404(db, tournament_id)
    squads = (
        db.query(models.TournamentSquad)
        .filter(models.TournamentSquad.tournament_id == tournament_id)
        .order_by(models.TournamentSquad.date, models.TournamentSquad.time)
        .all()
    )
    return {
        "id": tournament.id,
        "name": tournament.name,
        "location": tournament.location,
        "squads": [
            {"id": s.id, "date": s.date, "time": s.time}
            for s in squads
        ],
    }


@router.get("/tournament/by-name/{tournament_name}")
def get_public_tournament_info_by_name(
    tournament_name: str,
    db: Session = Depends(get_db),
):
    """Tournament name, location, and squads via name lookup — no auth required."""
    tournament = _get_tournament_by_name_or_404(db, tournament_name)
    squads = (
        db.query(models.TournamentSquad)
        .filter(models.TournamentSquad.tournament_id == tournament.id)
        .order_by(models.TournamentSquad.date, models.TournamentSquad.time)
        .all()
    )
    return {
        "id": tournament.id,
        "name": tournament.name,
        "location": tournament.location,
        "squads": [
            {"id": s.id, "date": s.date, "time": s.time}
            for s in squads
        ],
    }


@router.get("/tournament/by-slug/{tournament_slug}")
def get_public_tournament_info_by_slug(
    tournament_slug: str,
    db: Session = Depends(get_db),
):
    """Tournament name, location, and squads via slug lookup — no auth required."""
    tournament = _get_tournament_by_slug_or_404(db, tournament_slug)
    squads = (
        db.query(models.TournamentSquad)
        .filter(models.TournamentSquad.tournament_id == tournament.id)
        .order_by(models.TournamentSquad.date, models.TournamentSquad.time)
        .all()
    )
    return {
        "id": tournament.id,
        "name": tournament.name,
        "location": tournament.location,
        "squads": [
            {"id": s.id, "date": s.date, "time": s.time}
            for s in squads
        ],
    }


@router.get("/tournament/{tournament_id}/bowlers")
def get_public_bowlers(
    tournament_id: int,
    squad_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Bowler list for the public view — no auth required."""
    _get_tournament_or_404(db, tournament_id)

    query = db.query(models.TournamentPlayer).filter(
        models.TournamentPlayer.tournament_id == tournament_id
    )
    if squad_id:
        query = query.filter(models.TournamentPlayer.squad_id == squad_id)

    players = query.order_by(
        models.TournamentPlayer.lane,
        models.TournamentPlayer.full_name,
    ).all()

    return [
        {
            "id": p.id,
            "full_name": p.full_name,
            "lane": p.lane,
            "average": p.average,
            "division": normalize_division(p.division),
            "handicap_entry_count": p.handicap_entry_count or 0,
            "scratch_entry_count": p.scratch_entry_count or 0,
            "program_entry_counts": normalize_bowler_bracket_entries(
                p.program_entry_counts,
                handicap_entries=p.handicap_entry_count,
                scratch_entries=p.scratch_entry_count,
            ),
        }
        for p in players
    ]


@router.get("/tournament/{tournament_id}/brackets")
def get_public_brackets(
    tournament_id: int,
    squad_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Saved bracket data for the public view — no auth required."""
    _get_tournament_or_404(db, tournament_id)

    data = load_brackets_simple(db, tournament_id, squad_id)
    if not data:
        return {"bracket_groups": [], "no_brackets": True}

    return {
        "tournament_id": tournament_id,
        "squad_id": squad_id,
        "bracket_groups": data.get("bracket_groups", []),
    }


@router.get("/tournament/{tournament_id}/winners")
def get_public_winners(
    tournament_id: int,
    squad_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Winner summary for the public view — no auth required."""
    _get_tournament_or_404(db, tournament_id)

    data = load_generated_brackets(db, tournament_id, squad_id)
    if not data:
        return {"all_winners": [], "no_data": True}

    try:
        # get_tournament_winners_summary uses legacy bracket keys; use
        # bracket_groups if present so all program types are covered.
        groups = data.get("bracket_groups", [])
        if groups:
            all_winners = []
            for group in groups:
                group_name = group.get("name", group.get("key", ""))
                for i, bracket in enumerate(group.get("brackets", [])):
                    winners_info = extract_bracket_winners(bracket)
                    for winner in winners_info.get("winners", []):
                        winner["bracket_name"] = f"{group_name} Bracket {i + 1}"
                        winner["bracket_group"] = group.get("key", "")
                        all_winners.append(winner)
            return {"all_winners": all_winners}

        summary = get_tournament_winners_summary(data)
        return summary
    except Exception as e:
        logger.error(f"Error building winners summary: {e}")
        return {"all_winners": [], "error": True}
