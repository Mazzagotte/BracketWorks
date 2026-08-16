"""
Public read-only endpoints for the bowler-facing tournament view.
No authentication required — intended for QR-code accessible display pages.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Any, Literal, Optional
import logging
import json
import re
import unicodedata
from datetime import datetime, timezone
from uuid import uuid4

from pydantic import BaseModel, Field

from ..deps import get_db
from ...core import models
from ...core.bracket_programs import normalize_bowler_bracket_entries, normalize_division
from ...services.bracket_persistence_simple import load_brackets_simple, load_generated_brackets
from ...services.payouts import get_tournament_winners_summary, extract_bracket_winners

router = APIRouter()
logger = logging.getLogger(__name__)

_STATE_NAME_BY_CODE: dict[str, str] = {
    "AL": "Alabama",
    "AK": "Alaska",
    "AZ": "Arizona",
    "AR": "Arkansas",
    "CA": "California",
    "CO": "Colorado",
    "CT": "Connecticut",
    "DE": "Delaware",
    "FL": "Florida",
    "GA": "Georgia",
    "HI": "Hawaii",
    "ID": "Idaho",
    "IL": "Illinois",
    "IN": "Indiana",
    "IA": "Iowa",
    "KS": "Kansas",
    "KY": "Kentucky",
    "LA": "Louisiana",
    "ME": "Maine",
    "MD": "Maryland",
    "MA": "Massachusetts",
    "MI": "Michigan",
    "MN": "Minnesota",
    "MS": "Mississippi",
    "MO": "Missouri",
    "MT": "Montana",
    "NE": "Nebraska",
    "NV": "Nevada",
    "NH": "New Hampshire",
    "NJ": "New Jersey",
    "NM": "New Mexico",
    "NY": "New York",
    "NC": "North Carolina",
    "ND": "North Dakota",
    "OH": "Ohio",
    "OK": "Oklahoma",
    "OR": "Oregon",
    "PA": "Pennsylvania",
    "RI": "Rhode Island",
    "SC": "South Carolina",
    "SD": "South Dakota",
    "TN": "Tennessee",
    "TX": "Texas",
    "UT": "Utah",
    "VT": "Vermont",
    "VA": "Virginia",
    "WA": "Washington",
    "WV": "West Virginia",
    "WI": "Wisconsin",
    "WY": "Wyoming",
    "DC": "District of Columbia",
}

_STATE_CODE_BY_NAME: dict[str, str] = {
    name.upper(): code
    for code, name in _STATE_NAME_BY_CODE.items()
}


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


def _count_tc_squads_from_payload(squad_times: Optional[str]) -> int:
    if not squad_times:
        return 0

    try:
        parsed = json.loads(squad_times)
    except (TypeError, ValueError):
        return 0

    if not isinstance(parsed, dict):
        return 0

    count = 0
    for times in parsed.values():
        if not isinstance(times, list):
            continue
        count += sum(1 for value in times if isinstance(value, str) and value.strip())
    return count


def _resolve_state_code(raw_value: Optional[str]) -> str:
    value = (raw_value or "").strip()
    if not value:
        return ""

    normalized_code = re.sub(r"[^A-Za-z]", "", value).upper()
    if len(normalized_code) == 2 and normalized_code in _STATE_NAME_BY_CODE:
        return normalized_code

    normalized_name = re.sub(r"\s+", " ", value.replace(".", " ")).strip().upper()
    return _STATE_CODE_BY_NAME.get(normalized_name, "")


def _parse_location_state(location: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    if not location:
        return None, None

    pieces = [piece.strip() for piece in location.split(",") if piece.strip()]

    state_code = ""
    for piece in reversed(pieces):
        state_code = _resolve_state_code(piece)
        if state_code:
            break

    if not state_code:
        upper_location = location.upper()
        for code in _STATE_NAME_BY_CODE:
            if re.search(rf"\b{re.escape(code)}\b", upper_location):
                state_code = code
                break

    if not state_code:
        normalized_upper_location = re.sub(r"\s+", " ", location.replace(".", " ")).upper().strip()
        for name, code in _STATE_CODE_BY_NAME.items():
            if name in normalized_upper_location:
                state_code = code
                break

    if not state_code:
        return None, None

    return state_code, _STATE_NAME_BY_CODE.get(state_code)


class PublicRegistrationSubmissionForm(BaseModel):
    firstName: str
    lastName: str
    email: str
    phone: str = ""
    usbcNumber: str = ""
    bowlers: list[dict[str, str]] = Field(default_factory=list)
    eventId: str = ""
    divisionId: str = ""
    squadId: str = ""
    notes: str = ""
    questionAnswers: dict[str, Any] = Field(default_factory=dict)
    bowlerQuestionAnswers: list[dict[str, Any]] = Field(default_factory=list)
    fieldValues: dict[str, str] = Field(default_factory=dict)
    acceptTerms: bool


class PublicRegistrationSubmissionRequest(BaseModel):
    tournamentId: str
    tournamentName: str
    submittedAt: str
    form: PublicRegistrationSubmissionForm


def _normalize_public_question_answers(raw_answers: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}

    for key, value in (raw_answers or {}).items():
        normalized_key = str(key).strip()
        if not normalized_key:
            continue

        if isinstance(value, str):
            normalized[normalized_key] = value.strip()
            continue

        if isinstance(value, bool):
            normalized[normalized_key] = value
            continue

        if isinstance(value, list):
            cleaned = [str(item).strip() for item in value if str(item).strip()]
            normalized[normalized_key] = cleaned
            continue

        if value is None:
            normalized[normalized_key] = ""
            continue

        normalized[normalized_key] = str(value).strip()

    return normalized


def _is_question_answered(answer: Any) -> bool:
    if isinstance(answer, list):
        return any(str(item).strip() for item in answer)

    if isinstance(answer, bool):
        return True

    if isinstance(answer, str):
        return bool(answer.strip())

    if answer is None:
        return False

    return bool(str(answer).strip())


def _required_bowler_count_for_submission(
    squads: list[dict[str, Any]],
    events: list[dict[str, Any]],
    *,
    selected_event_id: str,
    selected_squad_id: str,
) -> int:
    def _event_player_count(event_row: dict[str, Any]) -> int:
        min_players = int(event_row.get("minPlayers") or 1)
        max_players = int(event_row.get("maxPlayers") or min_players)
        return max(min_players, max_players, 1)

    selected_squad = next(
        (
            squad for squad in squads
            if str(squad.get("id") or "") == selected_squad_id
        ),
        None,
    )
    if selected_squad:
        raw_squad_count = selected_squad.get("requiredBowlerCount")
        if raw_squad_count is None:
            raw_squad_count = selected_squad.get("required_bowler_count")

        try:
            squad_count = int(raw_squad_count)
        except (TypeError, ValueError):
            squad_count = 0

        if squad_count > 0:
            return squad_count

    selected_event = next(
        (
            event for event in events
            if str(event.get("id") or "") == selected_event_id
        ),
        None,
    )
    if selected_event:
        return _event_player_count(selected_event)

    squad_linked_events = [
        event for event in events
        if selected_squad_id
        and selected_squad_id in [str(value) for value in (event.get("connectedSquadIds") or [])]
    ]
    if squad_linked_events:
        return _event_player_count(squad_linked_events[0])

    if events:
        return _event_player_count(events[0])

    return 1


@router.get("/tournaments")
def list_public_tournaments(
    response: Response,
    limit: int = Query(100, ge=1, le=500),
    source: Literal["all", "bw", "tc"] = Query("all"),
    db: Session = Depends(get_db),
):
    """Directory of public tournaments, optionally limited to BW or TC."""
    tournaments = []
    if source != "tc":
        tournaments = (
            db.query(models.Tournament)
            .filter(
                models.Tournament.is_public.is_(True),
                models.Tournament.archived_at.is_(None),
            )
            .order_by(models.Tournament.id.desc())
            .limit(limit)
            .all()
        )

    tc_tournaments = []
    if source != "bw":
        tc_tournaments = (
            db.query(models.TournamentCentral)
            .filter(models.TournamentCentral.is_public.is_(True))
            .order_by(models.TournamentCentral.id.desc())
            .limit(limit)
            .all()
        )

    tc_tournament_ids = [t.id for t in tc_tournaments]
    tc_registration_ready_ids: set[int] = set()
    if tc_tournament_ids:
        tc_registration_ready_rows = (
            db.query(models.TournamentCentralSetupState.tournament_id)
            .filter(
                models.TournamentCentralSetupState.tournament_id.in_(tc_tournament_ids),
                models.TournamentCentralSetupState.is_published.is_(True),
            )
            .all()
        )
        tc_registration_ready_ids = {int(row[0]) for row in tc_registration_ready_rows}

    tournament_ids = [t.id for t in tournaments]
    squad_count_by_tournament: dict[int, int] = {}
    bracket_stats_by_tournament: dict[int, tuple[Optional[object], int]] = {}
    score_stats_by_tournament: dict[int, tuple[int, int, int, int, int, int, int]] = {}
    if tournament_ids:
        squad_counts = (
            db.query(
                models.TournamentSquad.tournament_id,
                func.count(models.TournamentSquad.id),
            )
            .filter(models.TournamentSquad.tournament_id.in_(tournament_ids))
            .group_by(models.TournamentSquad.tournament_id)
            .all()
        )
        squad_count_by_tournament = {int(tid): int(count) for tid, count in squad_counts}

        bracket_stats = (
            db.query(
                models.BracketSnapshot.tournament_id,
                func.max(models.BracketSnapshot.updated_at),
                func.count(models.BracketSnapshot.id),
            )
            .filter(models.BracketSnapshot.tournament_id.in_(tournament_ids))
            .group_by(models.BracketSnapshot.tournament_id)
            .all()
        )
        bracket_stats_by_tournament = {
            int(tid): (updated_at, int(count))
            for tid, updated_at, count in bracket_stats
        }

        score_stats = (
            db.query(
                models.PlayerScore.tournament_id,
                func.count(models.PlayerScore.id),
                func.coalesce(func.sum(models.PlayerScore.game1_scratch), 0),
                func.coalesce(func.sum(models.PlayerScore.game2_scratch), 0),
                func.coalesce(func.sum(models.PlayerScore.game3_scratch), 0),
                func.coalesce(func.sum(models.PlayerScore.game1_with_handicap), 0),
                func.coalesce(func.sum(models.PlayerScore.game2_with_handicap), 0),
                func.coalesce(func.sum(models.PlayerScore.game3_with_handicap), 0),
            )
            .filter(models.PlayerScore.tournament_id.in_(tournament_ids))
            .group_by(models.PlayerScore.tournament_id)
            .all()
        )
        score_stats_by_tournament = {
            int(tid): (
                int(score_count),
                int(g1_s),
                int(g2_s),
                int(g3_s),
                int(g1_h),
                int(g2_h),
                int(g3_h),
            )
            for tid, score_count, g1_s, g2_s, g3_s, g1_h, g2_h, g3_h in score_stats
        }

    _set_public_cache_headers(response, max_age=60, stale_while_revalidate=300)

    directory_rows: list[dict] = [
        {
            "id": t.id,
            "name": t.name,
            "slug": _slugify_tournament_name(t.name),
            "location": t.location,
            "state_code": state_code,
            "state_name": state_name,
            "start_date": t.start_date,
            "end_date": t.end_date,
            "squad_count": squad_count_by_tournament.get(t.id, 0),
            "public_url": f"/view/{_slugify_tournament_name(t.name)}",
            "has_logo": False,
            "logo_url": None,
            "last_activity_at": (
                bracket_stats_by_tournament.get(t.id, (None, 0))[0].isoformat()
                if bracket_stats_by_tournament.get(t.id, (None, 0))[0] is not None
                else None
            ),
            "live_fingerprint": (
                f"b:{bracket_stats_by_tournament.get(t.id, (None, 0))[1]}:"
                f"{int(bracket_stats_by_tournament.get(t.id, (None, 0))[0].timestamp()) if bracket_stats_by_tournament.get(t.id, (None, 0))[0] is not None else 0}|"
                f"s:{score_stats_by_tournament.get(t.id, (0, 0, 0, 0, 0, 0, 0))[0]}:"
                f"{score_stats_by_tournament.get(t.id, (0, 0, 0, 0, 0, 0, 0))[1]}:"
                f"{score_stats_by_tournament.get(t.id, (0, 0, 0, 0, 0, 0, 0))[2]}:"
                f"{score_stats_by_tournament.get(t.id, (0, 0, 0, 0, 0, 0, 0))[3]}:"
                f"{score_stats_by_tournament.get(t.id, (0, 0, 0, 0, 0, 0, 0))[4]}:"
                f"{score_stats_by_tournament.get(t.id, (0, 0, 0, 0, 0, 0, 0))[5]}:"
                f"{score_stats_by_tournament.get(t.id, (0, 0, 0, 0, 0, 0, 0))[6]}"
            ),
        }
        for t in tournaments
        for state_code, state_name in [_parse_location_state(t.location)]
    ]

    directory_rows.extend(
        {
            # Prefix with "tc-" so ids are unique across source tables in React list keys.
            "id": f"tc-{t.id}",
            "name": t.name,
            "slug": _slugify_tournament_name(t.name),
            "location": t.location,
            "state_code": state_code,
            "state_name": state_name,
            "start_date": t.start_date,
            "end_date": t.end_date,
            "squad_count": _count_tc_squads_from_payload(t.squad_times),
            "public_url": None,
            "registration_url": (
                f"/api/v1/public/tc-tournament/{t.id}/registration"
                if t.id in tc_registration_ready_ids
                else None
            ),
            "has_logo": bool(t.logo_blob),
            "logo_url": f"/api/v1/public/tc-tournament/{t.id}/logo" if t.logo_blob else None,
            "last_activity_at": None,
            "live_fingerprint": f"tc:{t.id}",
        }
        for t in tc_tournaments
        for state_code, state_name in [_parse_location_state(t.location)]
    )

    directory_rows.sort(
        key=lambda row: (
            row.get("start_date") or "",
            str(row.get("id") or ""),
        ),
        reverse=True,
    )

    return {
        "tournaments": directory_rows[:limit]
    }


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


@router.get("/tc-tournament/{tournament_id}/logo")
def get_public_tc_tournament_logo(
    tournament_id: int,
    response: Response,
    db: Session = Depends(get_db),
):
    """Public logo file for published Tournament Central tournaments."""
    tournament = db.query(models.TournamentCentral).filter(
        models.TournamentCentral.id == tournament_id,
        models.TournamentCentral.is_public.is_(True),
    ).first()

    if not tournament or not tournament.logo_blob:
        raise HTTPException(status_code=404, detail="Tournament logo not found")

    _set_public_cache_headers(response, max_age=300, stale_while_revalidate=1200)

    headers = {}
    if tournament.logo_file_name:
        headers["Content-Disposition"] = f'inline; filename="{tournament.logo_file_name}"'

    return Response(
        content=tournament.logo_blob,
        media_type=tournament.logo_mime_type or "application/octet-stream",
        headers=headers,
    )


@router.get("/tc-tournament/{tournament_id}/registration")
def get_public_tc_tournament_registration_config(
    tournament_id: int,
    response: Response,
    db: Session = Depends(get_db),
):
    """Published Tournament Central registration config for public sign-up modal."""
    tournament = db.query(models.TournamentCentral).filter(
        models.TournamentCentral.id == tournament_id,
        models.TournamentCentral.is_public.is_(True),
    ).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    state = db.query(models.TournamentCentralSetupState).filter(
        models.TournamentCentralSetupState.tournament_id == tournament_id,
        models.TournamentCentralSetupState.is_published.is_(True),
    ).first()
    if not state:
        raise HTTPException(status_code=404, detail="Registration setup not available")

    payload = state.payload if isinstance(state.payload, dict) else {}

    events = [
        event for event in (payload.get("events") or [])
        if isinstance(event, dict) and bool(event.get("enabled", True))
    ]
    divisions = [
        division for division in (payload.get("divisions") or [])
        if isinstance(division, dict) and bool(division.get("enabled", True))
    ]
    squads = [
        squad for squad in (payload.get("squads") or [])
        if isinstance(squad, dict)
    ]
    fields = [
        field for field in (payload.get("fields") or [])
        if isinstance(field, dict) and field.get("mode") != "dont-ask"
    ]
    questions = [
        question for question in (payload.get("questions") or [])
        if isinstance(question, dict) and bool(question.get("enabled", True))
    ]

    _set_public_cache_headers(response, max_age=120, stale_while_revalidate=600)
    return {
        "tournament_id": tournament.id,
        "tournament_name": tournament.name,
        "events": events,
        "divisions": divisions,
        "squads": squads,
        "fields": fields,
        "questions": questions,
    }


@router.post("/tc-tournament/{tournament_id}/registration")
def submit_public_tc_tournament_registration(
    tournament_id: int,
    payload: PublicRegistrationSubmissionRequest,
    db: Session = Depends(get_db),
):
    """Persist a public registration submission for organizer follow-up."""
    tournament = db.query(models.TournamentCentral).filter(
        models.TournamentCentral.id == tournament_id,
        models.TournamentCentral.is_public.is_(True),
    ).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    state = db.query(models.TournamentCentralSetupState).filter(
        models.TournamentCentralSetupState.tournament_id == tournament_id,
        models.TournamentCentralSetupState.is_published.is_(True),
    ).first()
    if not state:
        raise HTTPException(status_code=404, detail="Registration setup not available")

    form = payload.form

    state_payload = state.payload if isinstance(state.payload, dict) else {}
    configured_fields = [
        field for field in (state_payload.get("fields") or [])
        if isinstance(field, dict) and field.get("mode") != "dont-ask"
    ]
    required_fields = [
        field for field in configured_fields
        if str(field.get("mode") or "").strip().lower() == "required"
    ]

    submitted_field_values = {
        str(key).strip().lower(): (value.strip() if isinstance(value, str) else "")
        for key, value in (form.fieldValues or {}).items()
        if str(key).strip()
    }

    # Backward-compatible fallback for legacy clients still sending fixed keys only.
    legacy_key_map = {
        "first_name": form.firstName,
        "last_name": form.lastName,
        "email": form.email,
        "phone": form.phone,
        "usbc_number": form.usbcNumber,
    }
    for key, value in legacy_key_map.items():
        if key not in submitted_field_values and isinstance(value, str) and value.strip():
            submitted_field_values[key] = value.strip()

    normalized_bowlers: list[dict[str, str]] = []
    for bowler in (form.bowlers or []):
        if not isinstance(bowler, dict):
            continue

        normalized_bowler = {
            str(key).strip().lower(): (value.strip() if isinstance(value, str) else "")
            for key, value in bowler.items()
            if str(key).strip()
        }
        normalized_bowlers.append(normalized_bowler)

    if not normalized_bowlers:
        normalized_bowlers = [submitted_field_values.copy()]

    required_bowler_count = _required_bowler_count_for_submission(
        [squad for squad in (state_payload.get("squads") or []) if isinstance(squad, dict)],
        [event for event in (state_payload.get("events") or []) if isinstance(event, dict) and bool(event.get("enabled", True))],
        selected_event_id=form.eventId,
        selected_squad_id=form.squadId,
    )

    if len(normalized_bowlers) != required_bowler_count:
        raise HTTPException(
            status_code=400,
            detail=f"This squad requires {required_bowler_count} bowler form{'s' if required_bowler_count != 1 else ''}",
        )

    missing_required = None
    for bowler_index, bowler_values in enumerate(normalized_bowlers):
        for field in required_fields:
            field_key = str(field.get("key") or "").strip().lower()
            if not field_key:
                continue

            if not bowler_values.get(field_key, "").strip():
                label = str(field.get("customLabel") or field.get("label") or field_key)
                missing_required = f"Bowler {bowler_index + 1}: {label} is required"
                break
        if missing_required:
            break

    if missing_required:
        raise HTTPException(status_code=400, detail=missing_required)

    configured_questions = [
        question for question in (state_payload.get("questions") or [])
        if isinstance(question, dict) and bool(question.get("enabled", True))
    ]
    required_questions = [
        question for question in configured_questions
        if bool(question.get("required", False))
    ]

    normalized_bowler_question_answers = [
        _normalize_public_question_answers(answer_set)
        for answer_set in (form.bowlerQuestionAnswers or [])
        if isinstance(answer_set, dict)
    ]

    if not normalized_bowler_question_answers:
        normalized_bowler_question_answers = [
            _normalize_public_question_answers(form.questionAnswers)
        ]

    while len(normalized_bowler_question_answers) < required_bowler_count:
        normalized_bowler_question_answers.append({})

    normalized_bowler_question_answers = normalized_bowler_question_answers[:required_bowler_count]

    for bowler_index, answer_set in enumerate(normalized_bowler_question_answers):
        for question in required_questions:
            question_id = str(question.get("id") or "").strip()
            if not question_id:
                continue

            if _is_question_answered(answer_set.get(question_id)):
                continue

            question_label = str(question.get("label") or "Required question")
            raise HTTPException(
                status_code=400,
                detail=f"Bowler {bowler_index + 1}: {question_label} is required",
            )

    if not form.acceptTerms:
        raise HTTPException(status_code=400, detail="Tournament terms must be accepted")

    existing_submissions = state_payload.get("public_registration_submissions")
    submissions = existing_submissions if isinstance(existing_submissions, list) else []

    submission_id = f"reg-{uuid4().hex}"
    now_iso = datetime.now(timezone.utc).isoformat()

    submissions.append({
        "id": submission_id,
        "tournament_id": tournament_id,
        "tournament_name": tournament.name,
        "submitted_at": now_iso,
        "client_submitted_at": payload.submittedAt,
        "form": {
            "first_name": form.firstName.strip(),
            "last_name": form.lastName.strip(),
            "email": form.email.strip(),
            "phone": form.phone.strip(),
            "usbc_number": form.usbcNumber.strip(),
            "event_id": form.eventId,
            "division_id": form.divisionId,
            "squad_id": form.squadId,
            "notes": form.notes.strip(),
            "question_answers": _normalize_public_question_answers(form.questionAnswers),
            "bowler_question_answers": normalized_bowler_question_answers,
            "field_values": submitted_field_values,
            "bowlers": normalized_bowlers,
            "required_bowler_count": required_bowler_count,
            "accept_terms": form.acceptTerms,
        },
    })

    # Keep storage bounded for this first pass while preserving recent requests.
    state_payload["public_registration_submissions"] = submissions[-1000:]
    state.payload = state_payload

    try:
        db.add(state)
        db.commit()
    except Exception as error:
        db.rollback()
        logger.error(
            "Failed to persist public registration submission",
            extra={
                "tournament_id": tournament_id,
                "error": str(error),
            },
        )
        raise HTTPException(status_code=500, detail="Failed to submit registration")

    return {
        "status": "accepted",
        "submission_id": submission_id,
        "submitted_at": now_iso,
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
