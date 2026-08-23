from __future__ import annotations

from typing import Any

from sqlalchemy import and_
from sqlalchemy.orm import Session

from ..core import models
from ..core.money import money_decimal, money_float

DEFAULT_SIDE_POTS: list[dict[str, Any]] = [
    {"key": "high_game_scratch", "name": "High Game Scratch", "enabled": False},
    {"key": "high_series_scratch", "name": "High Series Scratch", "enabled": False},
    {"key": "high_game_handicap", "name": "High Game Handicap", "enabled": False},
    {"key": "high_series_handicap", "name": "High Series Handicap", "enabled": False},
]


def _default_side_pot_settings(tournament_id: int) -> dict[str, Any]:
    return {
        "tournament_id": tournament_id,
        "entry_fee": 0.0,
        "prize_amount": 0.0,
        "pots": [{**pot} for pot in DEFAULT_SIDE_POTS],
    }


def _normalize_side_pot_settings(raw_settings: Any, tournament_id: int) -> dict[str, Any]:
    normalized = _default_side_pot_settings(tournament_id)

    if isinstance(raw_settings, dict):
        entry_fee = raw_settings.get("entry_fee")
        if isinstance(entry_fee, (int, float)):
            normalized["entry_fee"] = money_float(entry_fee)

        prize_amount = raw_settings.get("prize_amount")
        if isinstance(prize_amount, (int, float)):
            normalized["prize_amount"] = money_float(prize_amount)

        raw_pots = raw_settings.get("pots")
        if isinstance(raw_pots, list):
            by_key: dict[str, dict[str, Any]] = {}
            for pot in raw_pots:
                if not isinstance(pot, dict):
                    continue
                key = str(pot.get("key") or "").strip().lower()
                if not key:
                    continue
                by_key[key] = {
                    "key": key,
                    "name": str(pot.get("name") or key).strip() or key,
                    "enabled": bool(pot.get("enabled")),
                }

            next_pots: list[dict[str, Any]] = []
            seen_keys: set[str] = set()

            for template in DEFAULT_SIDE_POTS:
                key = template["key"]
                seen_keys.add(key)
                next_pots.append(by_key.get(key, {**template}))

            for key, pot in by_key.items():
                if key in seen_keys:
                    continue
                next_pots.append(pot)

            normalized["pots"] = next_pots

    return normalized


def _to_metric(pot_key: str, score: models.PlayerScore | None) -> int | None:
    if score is None:
        return None

    scratch_games = [
        score.game1_scratch,
        score.game2_scratch,
        score.game3_scratch,
    ]
    handicap_games = [
        score.game1_with_handicap,
        score.game2_with_handicap,
        score.game3_with_handicap,
    ]

    valid_scratch = [value for value in scratch_games if isinstance(value, int)]
    valid_handicap = [value for value in handicap_games if isinstance(value, int)]

    if pot_key == "high_game_scratch":
        return max(valid_scratch) if valid_scratch else None
    if pot_key == "high_series_scratch":
        return sum(valid_scratch) if len(valid_scratch) == 3 else None
    if pot_key == "high_game_handicap":
        return max(valid_handicap) if valid_handicap else None
    if pot_key == "high_series_handicap":
        return sum(valid_handicap) if len(valid_handicap) == 3 else None

    return None


def load_side_pot_settings(
    db: Session,
    tournament_id: int,
) -> dict[str, Any]:
    settings = db.query(models.BracketSettings).filter(
        models.BracketSettings.tournament_id == tournament_id
    ).first()

    raw_side_pot_settings = settings.side_pots_settings if settings else None
    return _normalize_side_pot_settings(raw_side_pot_settings, tournament_id)


def calculate_side_pot_accounting(
    db: Session,
    tournament_id: int,
    squad_id: int | None = None,
) -> dict[str, Any]:
    settings = load_side_pot_settings(db, tournament_id)
    pots = settings.get("pots") or []
    enabled_pots = [pot for pot in pots if bool(pot.get("enabled"))]

    if not enabled_pots:
        return {
            "tournament_id": tournament_id,
            "squad_id": squad_id,
            "entry_fee": money_float(settings.get("entry_fee")),
            "prize_amount": money_float(settings.get("prize_amount")),
            "total_pool": 0.0,
            "summaries": [],
        }

    query = db.query(models.TournamentPlayer, models.PlayerScore).outerjoin(
        models.PlayerScore,
        and_(
            models.PlayerScore.player_id == models.TournamentPlayer.id,
            models.PlayerScore.tournament_id == tournament_id,
            models.PlayerScore.squad_id == models.TournamentPlayer.squad_id,
        ),
    ).filter(models.TournamentPlayer.tournament_id == tournament_id)

    if squad_id is not None:
        query = query.filter(models.TournamentPlayer.squad_id == squad_id)

    rows = query.all()

    per_entry_pool_value = money_decimal(settings.get("prize_amount"))
    if per_entry_pool_value <= 0:
        per_entry_pool_value = money_decimal(settings.get("entry_fee"))

    summaries: list[dict[str, Any]] = []

    for pot in enabled_pots:
        pot_key = str(pot.get("key") or "").strip().lower()
        pot_name = str(pot.get("name") or pot_key).strip() or pot_key

        entrants: list[dict[str, Any]] = []
        for player, score in rows:
            side_pot_entries = player.side_pot_entries if isinstance(player.side_pot_entries, dict) else {}
            if not bool(side_pot_entries.get(pot_key)):
                continue

            entrants.append(
                {
                    "player_id": player.id,
                    "player_name": player.full_name,
                    "metric": _to_metric(pot_key, score),
                }
            )

        entrants_with_metric = [entrant for entrant in entrants if entrant["metric"] is not None]
        has_incomplete_entrants = len(entrants_with_metric) != len(entrants)

        winning_metric: int | None = None
        winners: list[dict[str, Any]] = []

        if entrants_with_metric:
            winning_metric = max(int(entrant["metric"]) for entrant in entrants_with_metric)
            winners = [
                {
                    "player_id": int(entrant["player_id"]),
                    "player_name": str(entrant["player_name"]),
                }
                for entrant in entrants_with_metric
                if int(entrant["metric"]) == winning_metric
            ]
            winners.sort(key=lambda row: (row["player_name"].lower(), row["player_id"]))

        status = "empty"
        if entrants:
            if not winners or has_incomplete_entrants:
                status = "pending"
                winners = []
                winning_metric = None
            elif len(winners) > 1:
                status = "tied"
            else:
                status = "complete"

        legacy_winner_id: int | None = None
        legacy_winner_name: str | None = None
        legacy_winner_metric: int | None = None
        if status == "complete" and len(winners) == 1 and winning_metric is not None:
            legacy_winner_id = winners[0]["player_id"]
            legacy_winner_name = winners[0]["player_name"]
            legacy_winner_metric = winning_metric

        entry_count = len(entrants)
        pool = money_decimal(entry_count * per_entry_pool_value)

        summaries.append(
            {
                "key": pot_key,
                "name": pot_name,
                "entry_count": entry_count,
                "pool": money_float(pool),
                "status": status,
                "winning_metric": winning_metric,
                "winners": winners,
                "winner_id": legacy_winner_id,
                "winner_name": legacy_winner_name,
                "winner_metric": legacy_winner_metric,
            }
        )

    total_pool = money_float(sum(money_decimal(summary["pool"]) for summary in summaries))

    return {
        "tournament_id": tournament_id,
        "squad_id": squad_id,
        "entry_fee": money_float(settings.get("entry_fee")),
        "prize_amount": money_float(settings.get("prize_amount")),
        "total_pool": total_pool,
        "summaries": summaries,
    }
