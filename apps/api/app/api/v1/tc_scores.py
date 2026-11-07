"""Tournament Central scoring: the director's score grid, standings, finals, and the public live standings.

Works on TC tables only (tc_entries, tc_registration_bowlers, tc_scores, tc_finals). The standings
math lives in ``services/tc_standings.py``.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ...api import deps
from ...core import models
from ...services import tc_standings as engine
from ...services.tournament_access import require_tc_tournament_permission

router = APIRouter()
public_router = APIRouter()

MIN_GRID_GAMES = 3
MAX_EXTRA_GAMES = 10
MAX_FINALS_ROUND = 64


class ScoreChange(BaseModel):
    entry_id: int
    bowler_id: int
    game: int
    score: Optional[int] = None


class ScoresPayload(BaseModel):
    scores: list[ScoreChange]


class FinalsTarget(BaseModel):
    event_config_id: str
    division_config_id: Optional[str] = None


class FinalsGameChange(BaseModel):
    round: int
    match: int = 1
    seed: int
    game: int = 1
    score: Optional[int] = None


class FinalsGamesPayload(FinalsTarget):
    games: list[FinalsGameChange]


def _logo_url(tournament: models.TournamentCentral) -> Optional[str]:
    if tournament.logo_blob and tournament.is_public:
        return f"/api/v1/public/tc-tournament/{tournament.id}/logo"
    return None


def _load(db: Session, tournament: models.TournamentCentral) -> engine.StandingsInput:
    return engine.load_standings_input(db, tournament, logo_url=_logo_url(tournament))


def _setup_event(data: engine.StandingsInput, event_id: str) -> Optional[dict]:
    for event in data.setup.get("events") or []:
        if isinstance(event, dict) and str(event.get("id")) == event_id:
            return event
    return None


def _division_id(value: Optional[str]) -> Optional[str]:
    text = (value or "").strip()
    return text or None


def _validate_score(value: Optional[int], label: str) -> None:
    if value is not None and not 0 <= value <= engine.MAX_SCORE:
        raise HTTPException(status_code=422, detail=f"{label} must be between 0 and {engine.MAX_SCORE}.")


# ---------------------------------------------------------------------------
# Score grid


@router.get("/{tournament_id}/scores")
def get_score_grid(
    tournament_id: int,
    event_config_id: Optional[str] = Query(default=None),
    squad_config_id: Optional[str] = Query(default=None),
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    tournament = require_tc_tournament_permission(db, tournament_id, user, "view")
    data = _load(db, tournament)
    standings, _ = engine.compute_standings_detail(data)
    events = standings["events"]
    if not events:
        return {"events": [], "event_id": None, "squads": [], "games": MIN_GRID_GAMES, "shared_score": False, "rows": []}

    event_payload = next((event for event in events if event["id"] == event_config_id), None)
    if event_payload is None:
        with_entries = {entry.event_id for entry in data.entries}
        event_payload = next((event for event in events if event["id"] in with_entries), events[0])
    event_id = event_payload["id"]
    setup_event = _setup_event(data, event_id) or {"id": event_id, "scoring": event_payload["scoring"]}
    rules = engine.rules_for_event(setup_event)
    scoring = engine.event_scoring(setup_event)

    event_entries = [entry for entry in data.entries if entry.event_id == event_id]
    squads: dict[str, str] = {}
    for squad in data.setup.get("squads") or []:
        if not isinstance(squad, dict) or not squad.get("id"):
            continue
        event_ids = [str(item) for item in (squad.get("eventIds") or [])]
        if event_ids and event_id not in event_ids:
            continue
        squads[str(squad["id"])] = engine.squad_label(squad.get("name"), squad.get("dateIso"), squad.get("startTime")) or "Squad"
    for entry in event_entries:
        if entry.squad_id and entry.squad_id not in squads:
            squads[entry.squad_id] = entry.squad_label or "Squad"

    squad_id = (squad_config_id or "").strip() or None
    if squad_id:
        event_entries = [entry for entry in event_entries if entry.squad_id == squad_id]

    max_bowled = max(
        (max(games, default=0) for (entry_id, _), games in data.scores.items() if entry_id in {e.id for e in event_entries}),
        default=0,
    )
    games_count = max(int(rules["games"] or 0) or max(max_bowled, MIN_GRID_GAMES), max_bowled)
    division_names = {division["id"]: division["name"] for division in event_payload["divisions"]}

    rows = []
    for entry in event_entries:
        row = engine.build_entry_row(
            entry, bowlers=data.bowlers, scores=data.scores, rules=rules, scoring=scoring, games_count=games_count
        )
        rows.append({
            "entry_id": entry.id,
            "label": row.name,
            "division": division_names.get(entry.division_id) if entry.division_id else None,
            "squad": entry.squad_label,
            "squad_id": entry.squad_id,
            "bowlers": [
                {
                    "bowler_id": bowler_id,
                    "name": bowler["name"],
                    "average": bowler["average"],
                    "handicap_per_game": bowler["handicapPerGame"],
                }
                for bowler_id, bowler in zip(row.bowler_ids, row.bowlers)
            ],
            "scores": {
                str(bowler_id): [data.scores.get((entry.id, bowler_id), {}).get(game) for game in range(1, games_count + 1)]
                for bowler_id in row.bowler_ids
            },
            "totals": {
                "games_bowled": row.games_bowled,
                "scratch": row.scratch_total,
                "handicap": row.handicap_total,
                "total": row.total,
            },
        })
    rows.sort(key=lambda item: ((item["squad"] or "").lower(), item["label"].lower(), item["entry_id"]))

    return {
        "events": [
            {
                "id": event["id"],
                "name": event["name"],
                "format": event["format"],
                "scoring": event["scoring"],
                "scoring_label": event["scoringLabel"],
                "games": event["games"],
                "divisions": [
                    {
                        "id": division["id"],
                        "name": division["name"],
                        "entry_count": division["entryCount"],
                        "advancing_count": division["advancingCount"],
                        "cashing_count": division["cashingCount"],
                    }
                    for division in event["divisions"]
                ],
            }
            for event in events
        ],
        "event_id": event_id,
        "squads": [{"id": key, "label": label} for key, label in squads.items()],
        "squad_id": squad_id,
        "games": games_count,
        "max_game": max(games_count, MAX_EXTRA_GAMES),
        "shared_score": rules["format"] in engine.SHARED_SCORE_FORMATS,
        "rows": rows,
        "updated_at": standings["updatedAt"],
    }


@router.put("/{tournament_id}/scores")
def save_scores(
    tournament_id: int,
    payload: ScoresPayload,
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    tournament = require_tc_tournament_permission(db, tournament_id, user, "manage_scores")
    if not payload.scores:
        return {"saved": 0, "updated_at": None}
    if len(payload.scores) > 500:
        raise HTTPException(status_code=422, detail="Save at most 500 scores at a time.")

    entry_ids = {change.entry_id for change in payload.scores}
    entries = {
        entry.id: entry
        for entry in db.query(models.TcEntry).filter(
            models.TcEntry.id.in_(entry_ids), models.TcEntry.tournament_id == tournament.id
        ).all()
    }
    members = {
        (link.entry_id, link.bowler_id)
        for link in db.query(models.TcEntryBowler).filter(models.TcEntryBowler.entry_id.in_(entry_ids)).all()
    }
    state = db.query(models.TournamentCentralSetupState).filter(
        models.TournamentCentralSetupState.tournament_id == tournament.id
    ).first()
    setup = engine.published_setup(state)
    games_by_event: dict[str, int] = {}
    for event in setup.get("events") or []:
        if isinstance(event, dict) and event.get("id"):
            games_by_event[str(event["id"])] = int(engine.rules_for_event(event)["games"] or 0)

    for change in payload.scores:
        entry = entries.get(change.entry_id)
        if entry is None:
            raise HTTPException(status_code=404, detail="Entry not found")
        if (change.entry_id, change.bowler_id) not in members:
            raise HTTPException(status_code=422, detail="That bowler isn't on this entry.")
        max_game = max(games_by_event.get(entry.event_config_id, 0), MAX_EXTRA_GAMES)
        if not 1 <= change.game <= max_game:
            raise HTTPException(status_code=422, detail=f"Game must be between 1 and {max_game}.")
        _validate_score(change.score, "Score")

    now = datetime.now(timezone.utc)
    existing = {
        (score.entry_id, score.bowler_id, score.game_number): score
        for score in db.query(models.TcScore).filter(models.TcScore.entry_id.in_(entry_ids)).all()
    }
    saved = 0
    for change in payload.scores:
        key = (change.entry_id, change.bowler_id, change.game)
        row = existing.get(key)
        if row is None:
            if change.score is None:
                continue
            row = models.TcScore(
                tournament_id=tournament.id,
                entry_id=change.entry_id,
                bowler_id=change.bowler_id,
                game_number=change.game,
            )
            db.add(row)
            existing[key] = row
        elif row.score == change.score:
            continue
        # Cleared scores keep their row (score null) so the live page's "updated" time moves forward.
        row.score = change.score
        row.entered_by_user_id = user.id
        row.updated_at = now
        saved += 1
    db.commit()
    return {"saved": saved, "updated_at": engine.isoformat(now)}


# ---------------------------------------------------------------------------
# Standings


@router.get("/{tournament_id}/standings")
def get_standings(
    tournament_id: int,
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    tournament = require_tc_tournament_permission(db, tournament_id, user, "view")
    return engine.compute_standings(_load(db, tournament))


@public_router.get("/tc-tournament/{tournament_id}/standings")
def get_public_standings(
    tournament_id: int,
    response: Response,
    db: Session = Depends(deps.get_db),
):
    """LiveStandings for the public live page. Only public tournaments; 404 otherwise."""
    tournament = db.query(models.TournamentCentral).filter(
        models.TournamentCentral.id == tournament_id,
        models.TournamentCentral.is_public.is_(True),
    ).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    payload = engine.compute_standings(_load(db, tournament))
    response.headers["Cache-Control"] = "public, max-age=5, stale-while-revalidate=10"
    response.headers["Vary"] = "Accept-Encoding"
    return payload


# ---------------------------------------------------------------------------
# Finals


def _finals_row(db: Session, tournament_id: int, event_id: str, division_id: Optional[str]) -> Optional[models.TcFinals]:
    return db.query(models.TcFinals).filter(
        models.TcFinals.tournament_id == tournament_id,
        models.TcFinals.event_config_id == event_id,
        models.TcFinals.division_key == (division_id or ""),
    ).first()


def _finals_response(db: Session, tournament: models.TournamentCentral, event_id: str, division_id: Optional[str]) -> dict:
    data = _load(db, tournament)
    standings, divisions = engine.compute_standings_detail(data)
    event = next((item for item in standings["events"] if item["id"] == event_id), None)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    result = divisions.get((event_id, division_id))
    if result is None:
        raise HTTPException(status_code=404, detail="Division not found")
    setup_event = _setup_event(data, event_id) or {"id": event_id}
    rules = engine.rules_for_event(setup_event)
    stored = _finals_row(db, tournament.id, event_id, division_id)
    finals_type = stored.finals_type if stored else rules["finals"]["type"]
    finals = result.payload["finals"]

    entered: dict[tuple[int, int, int], Optional[int]] = {}
    if stored:
        for game in db.query(models.TcFinalsGame).filter(models.TcFinalsGame.finals_id == stored.id).all():
            entered[(game.round, game.match_number, game.seed)] = game.score
    handicap = {int(seed["seed"]): int(seed.get("handicapPerGame") or 0) for seed in (stored.seeds if stored else [])}
    is_handicap = event["scoring"] == "handicap"

    def slot(round_: int, match: int, seed: int, name: str, label: str) -> dict:
        return {
            "round": round_,
            "match": match,
            "seed": seed,
            "name": name,
            "label": label,
            "score": entered.get((round_, match, seed)),
            "handicap": handicap.get(seed, 0) if is_handicap else 0,
        }

    slots = []
    if finals and stored:
        for match in finals["matches"]:
            a, b = match["a"], match["b"]
            if not a or not b:
                continue  # a bye, or a side still waiting on an earlier match
            number = int(match["id"].split("-m")[1])
            for side in (a, b):
                slots.append(slot(match["round"], number, side["seed"], side["name"], match["label"]))
        for round_ in finals["rounds"]:
            for row in round_["rows"]:
                slots.append(slot(round_["round"], 1, row["seed"], row["name"], round_["label"]))

    can_start = (
        stored is None
        and finals_type in engine.BRACKETED_FINALS
        and finals_type != "match-play-double"
        and len(engine.finals_seeds(result.payload, result.rows)) >= 2
    )
    return {
        "event_id": event_id,
        "division_id": division_id,
        "event_name": event["name"],
        "division_name": result.payload["name"],
        "finals_type": finals_type,
        "started": stored is not None,
        "can_start": can_start,
        "advancing_count": result.payload["advancingCount"],
        "qualifiers": [row for row in result.payload["rows"] if row["status"] == "advancing"],
        "seeds": stored.seeds if stored else [],
        "finals": finals,
        "slots": slots,
    }


@router.get("/{tournament_id}/finals")
def get_finals(
    tournament_id: int,
    event_config_id: str = Query(...),
    division_config_id: Optional[str] = Query(default=None),
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    tournament = require_tc_tournament_permission(db, tournament_id, user, "view")
    return _finals_response(db, tournament, event_config_id, _division_id(division_config_id))


@router.post("/{tournament_id}/finals/start")
def start_finals(
    tournament_id: int,
    payload: FinalsTarget,
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    tournament = require_tc_tournament_permission(db, tournament_id, user, "manage_scores")
    event_id = payload.event_config_id
    division_id = _division_id(payload.division_config_id)
    if _finals_row(db, tournament.id, event_id, division_id):
        raise HTTPException(status_code=409, detail="Finals have already started for this event and division.")
    data = _load(db, tournament)
    _, divisions = engine.compute_standings_detail(data)
    result = divisions.get((event_id, division_id))
    if result is None:
        raise HTTPException(status_code=404, detail="Event or division not found")
    rules = engine.rules_for_event(_setup_event(data, event_id) or {"id": event_id})
    finals_type = rules["finals"]["type"]
    if finals_type == "match-play-double":
        raise HTTPException(status_code=400, detail=engine.DOUBLE_ELIMINATION_NOTE)
    if finals_type not in engine.BRACKETED_FINALS:
        raise HTTPException(status_code=400, detail="This event doesn't have bowled finals.")
    seeds = engine.finals_seeds(result.payload, result.rows)
    if len(seeds) < 2:
        raise HTTPException(status_code=400, detail="At least two entries need qualifying scores before finals can start.")
    db.add(models.TcFinals(
        tournament_id=tournament.id,
        event_config_id=event_id,
        division_config_id=division_id,
        division_key=division_id or "",
        finals_type=finals_type,
        seeds=seeds,
        status="in-progress",
        created_by_user_id=user.id,
    ))
    db.commit()
    return _finals_response(db, tournament, event_id, division_id)


@router.put("/{tournament_id}/finals/games")
def save_finals_games(
    tournament_id: int,
    payload: FinalsGamesPayload,
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    tournament = require_tc_tournament_permission(db, tournament_id, user, "manage_scores")
    division_id = _division_id(payload.division_config_id)
    finals = _finals_row(db, tournament.id, payload.event_config_id, division_id)
    if finals is None:
        raise HTTPException(status_code=404, detail="Finals haven't started for this event and division.")
    seeds = {int(seed["seed"]) for seed in finals.seeds or []}
    for change in payload.games:
        if change.seed not in seeds:
            raise HTTPException(status_code=422, detail=f"Seed {change.seed} isn't in these finals.")
        if not 1 <= change.round <= MAX_FINALS_ROUND or not 1 <= change.match <= MAX_FINALS_ROUND or not 1 <= change.game <= 10:
            raise HTTPException(status_code=422, detail="That finals game doesn't exist.")
        _validate_score(change.score, "Score")

    now = datetime.now(timezone.utc)
    existing = {
        (game.round, game.match_number, game.seed, game.game_number): game
        for game in db.query(models.TcFinalsGame).filter(models.TcFinalsGame.finals_id == finals.id).all()
    }
    for change in payload.games:
        key = (change.round, change.match, change.seed, change.game)
        row = existing.get(key)
        if row is None:
            if change.score is None:
                continue
            row = models.TcFinalsGame(
                finals_id=finals.id, round=change.round, match_number=change.match, seed=change.seed, game_number=change.game
            )
            db.add(row)
            existing[key] = row
        row.score = change.score
        row.entered_by_user_id = user.id
        row.updated_at = now
    finals.updated_at = now
    db.commit()
    response = _finals_response(db, tournament, payload.event_config_id, division_id)
    status = (response["finals"] or {}).get("status")
    if status and finals.status != status:
        finals.status = status
        db.commit()
    return response


@router.delete("/{tournament_id}/finals")
def reset_finals(
    tournament_id: int,
    event_config_id: str = Query(...),
    division_config_id: Optional[str] = Query(default=None),
    db: Session = Depends(deps.get_db),
    user=Depends(deps.get_current_user),
):
    tournament = require_tc_tournament_permission(db, tournament_id, user, "manage_scores")
    division_id = _division_id(division_config_id)
    finals = _finals_row(db, tournament.id, event_config_id, division_id)
    if finals is None:
        raise HTTPException(status_code=404, detail="Finals haven't started for this event and division.")
    db.query(models.TcFinalsGame).filter(models.TcFinalsGame.finals_id == finals.id).delete(synchronize_session=False)
    db.delete(finals)
    db.commit()
    return {"reset": True}
