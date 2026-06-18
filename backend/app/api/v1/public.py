"""
Public read-only endpoints for the bowler-facing tournament view.
No authentication required — intended for QR-code accessible display pages.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Response
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


def _set_public_cache_headers(response: Response, *, max_age: int, stale_while_revalidate: int = 0) -> None:
    parts = [f"public", f"max-age={max_age}"]
    if stale_while_revalidate > 0:
        parts.append(f"stale-while-revalidate={stale_while_revalidate}")
    response.headers["Cache-Control"] = ", ".join(parts)
    response.headers["Vary"] = "Accept-Encoding"


def _get_tournament_or_404(db: Session, tournament_id: int) -> models.Tournament:
    tournament = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
    if not tournament or not getattr(tournament, "is_public", False):
        raise HTTPException(status_code=404, detail="Tournament not found")
    return tournament


def _get_tournament_by_name_or_404(db: Session, tournament_name: str) -> models.Tournament:
    name = (tournament_name or "").strip()
    if not name:
        raise HTTPException(status_code=404, detail="Tournament not found")

    matches = (
        db.query(models.Tournament)
        .filter(
            func.lower(models.Tournament.name) == name.lower(),
            models.Tournament.is_public.is_(True),
        )
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

    candidates = (
        db.query(models.Tournament)
        .filter(models.Tournament.is_public.is_(True))
        .order_by(models.Tournament.id.desc())
        .all()
    )
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


def _format_public_squads(db: Session, tournament_id: int, squads: list[models.TournamentSquad]) -> list[dict]:
    formatted_squads = []

    for squad in squads:
        bracket_data = load_brackets_simple(db, tournament_id, squad.id)
        bracket_groups = bracket_data.get("bracket_groups", []) if isinstance(bracket_data, dict) else []
        bracket_count = sum(
            len(group.get("brackets", []) or [])
            for group in bracket_groups
            if isinstance(group, dict)
        )

        formatted_squads.append({
            "id": squad.id,
            "date": squad.date,
            "time": squad.time,
            "has_brackets": bracket_count > 0,
            "bracket_group_count": len(bracket_groups),
            "bracket_count": bracket_count,
        })

    return formatted_squads


@router.get("/tournament/{tournament_id}")
def get_public_tournament_info(
    tournament_id: int,
    response: Response,
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
    _set_public_cache_headers(response, max_age=60, stale_while_revalidate=300)
    return {
        "id": tournament.id,
        "name": tournament.name,
        "location": tournament.location,
        "squads": _format_public_squads(db, tournament.id, squads),
    }


@router.get("/tournament/by-name/{tournament_name}")
def get_public_tournament_info_by_name(
    tournament_name: str,
    response: Response,
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
    _set_public_cache_headers(response, max_age=60, stale_while_revalidate=300)
    return {
        "id": tournament.id,
        "name": tournament.name,
        "location": tournament.location,
        "squads": _format_public_squads(db, tournament.id, squads),
    }


@router.get("/tournament/by-slug/{tournament_slug}")
def get_public_tournament_info_by_slug(
    tournament_slug: str,
    response: Response,
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
    _set_public_cache_headers(response, max_age=60, stale_while_revalidate=300)
    return {
        "id": tournament.id,
        "name": tournament.name,
        "location": tournament.location,
        "squads": _format_public_squads(db, tournament.id, squads),
    }


@router.get("/tournament/{tournament_id}/bowlers")
def get_public_bowlers(
    tournament_id: int,
    squad_id: Optional[int] = Query(None),
    response: Response = None,
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

    if response is not None:
        _set_public_cache_headers(response, max_age=30, stale_while_revalidate=120)

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
    response: Response = None,
    db: Session = Depends(get_db),
):
    """Saved bracket data for the public view — no auth required."""
    _get_tournament_or_404(db, tournament_id)

    if response is not None:
        _set_public_cache_headers(response, max_age=15, stale_while_revalidate=45)

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
    response: Response = None,
    db: Session = Depends(get_db),
):
    """Winner summary for the public view — no auth required."""
    _get_tournament_or_404(db, tournament_id)

    if response is not None:
        _set_public_cache_headers(response, max_age=15, stale_while_revalidate=60)

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


@router.get("/tournament/{tournament_id}/scores")
def get_public_scores(
    tournament_id: int,
    squad_id: Optional[int] = Query(None),
    response: Response = None,
    db: Session = Depends(get_db),
):
    """Live scores for the side pots leaderboard — no auth required."""
    _get_tournament_or_404(db, tournament_id)

    # Scores are live-changing; keep cache very short.
    if response is not None:
        _set_public_cache_headers(response, max_age=5, stale_while_revalidate=10)

    query = (
        db.query(models.PlayerScore, models.TournamentPlayer.full_name)
        .join(models.TournamentPlayer, models.PlayerScore.player_id == models.TournamentPlayer.id)
        .filter(models.PlayerScore.tournament_id == tournament_id)
    )
    if squad_id:
        query = query.filter(models.PlayerScore.squad_id == squad_id)

    rows = query.all()
    return [
        {
            "player_id": score.player_id,
            "player_name": full_name,
            "game1_scratch": score.game1_scratch,
            "game2_scratch": score.game2_scratch,
            "game3_scratch": score.game3_scratch,
            "game1_with_handicap": score.game1_with_handicap,
            "game2_with_handicap": score.game2_with_handicap,
            "game3_with_handicap": score.game3_with_handicap,
        }
        for score, full_name in rows
    ]
