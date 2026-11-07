"""Live standings for Tournament Central: qualifying totals, cut and cash lines, All Events, and finals.

The core functions are pure: they take plain inputs (``StandingsInput``) and return the public
``LiveStandings`` payload described in
``apps/tournament-central-web/components/live/liveStandingsTypes.ts`` (camelCase on purpose).
``load_standings_input`` is the only function here that touches the database.

Rules come from the TC setup payload (``events[].rules``, see ``EventRules`` in ``formatTypes.ts``).
``normalize_event_rules`` mirrors ``normalizeEventRules`` so tournaments saved before the rules
existed keep working.

Domain notes:
- No-tap (9-pin) is scored as scratch: handicap is never applied to it.
- Scotch doubles and Baker team bowl one shared game per entry. Their score is stored on the
  entry's first bowler.
- Finals game scores are stored as entered (scratch). The seed's per-game handicap, snapshotted when
  finals start, is added when the event is handicap.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any, Iterable, Mapping, Optional, Sequence

EVENT_FORMATS = ("singles", "doubles", "scotch-doubles", "team", "baker-team")
FINALS_TYPES = ("none", "cut", "stepladder", "match-play-single", "match-play-double", "round-robin", "survivor")
BRACKETED_FINALS = ("stepladder", "match-play-single", "match-play-double", "round-robin", "survivor")
# Formats where the entry bowls one shared game (stored on the entry's first bowler).
SHARED_SCORE_FORMATS = {"scotch-doubles", "baker-team"}
# Finals field size when the organizer didn't set a cut.
DEFAULT_FINALS_FIELD = {
    "stepladder": 5,
    "match-play-single": 8,
    "match-play-double": 8,
    "round-robin": 6,
    "survivor": 8,
}
DEFAULT_WIN_BONUS_PINS = 30
MAX_SCORE = 300
ACTIVE_STATUSES = ("pending", "confirmed")
DOUBLE_ELIMINATION_NOTE = "Double elimination finals are coming soon."
_ALL_EVENTS_NAME = re.compile(r"\ball[\s-]*events?\b", re.IGNORECASE)


# ---------------------------------------------------------------------------
# Rules


def _as_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _num(value: Any, fallback: Any = None) -> Any:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return fallback
    if isinstance(value, float) and not math.isfinite(value):
        return fallback
    return value


def event_scoring(event: Mapping[str, Any]) -> str:
    """'handicap', 'scratch', or 'no-tap'. Legacy 'both' became no-tap (see setupSerialization.ts)."""
    raw = event.get("scoring")
    if raw == "both":
        return "no-tap"
    return raw if raw in ("handicap", "scratch", "no-tap") else "scratch"


def normalize_event_rules(raw: Any, *, scoring: str, max_players: int) -> dict:
    """Python mirror of ``normalizeEventRules`` in formatTypes.ts. Keys stay camelCase."""
    inferred = "team" if max_players >= 4 else "doubles" if max_players == 2 else "singles"
    data = _as_dict(raw)
    fmt = data.get("format") if data.get("format") in EVENT_FORMATS else inferred
    default_handicap = {"percent": 90, "basis": 220, "maxPins": None, "perPair": fmt == "scotch-doubles"}
    handicap_raw = data.get("handicap") if isinstance(data.get("handicap"), dict) else None
    if scoring != "handicap":
        handicap = None
    elif handicap_raw is not None:
        handicap = {
            "percent": _num(handicap_raw.get("percent"), 90),
            "basis": _num(handicap_raw.get("basis"), 220),
            "maxPins": _num(handicap_raw.get("maxPins"), None),
            "perPair": bool(handicap_raw.get("perPair")),
        }
    else:
        handicap = default_handicap
    average_raw = _as_dict(data.get("average"))
    finals_raw = _as_dict(data.get("finals"))
    cut_raw = finals_raw.get("cut") if isinstance(finals_raw.get("cut"), dict) else None
    rr = finals_raw.get("roundRobinScoring")
    return {
        "format": fmt,
        "games": _num(data.get("games"), 0),
        "handicap": handicap,
        "average": {
            "source": average_raw.get("source") or "highest-current-or-last",
            "minGames": _num(average_raw.get("minGames"), 21),
            "noAverage": "not-eligible" if average_raw.get("noAverage") == "not-eligible" else "assigned-average",
            "assignedAverage": _num(average_raw.get("assignedAverage"), None),
        },
        "reentryScoring": "best-counts" if data.get("reentryScoring") == "best-counts" else "all-count",
        "finals": {
            "type": finals_raw.get("type") if finals_raw.get("type") in FINALS_TYPES else "none",
            "cut": {
                "by": "percent" if cut_raw.get("by") == "percent" else "count",
                "value": _num(cut_raw.get("value"), 0),
            } if cut_raw is not None else None,
            "roundRobinScoring": rr if rr in ("petersen", "bonus-pins") else None,
            "winBonusPins": _num(finals_raw.get("winBonusPins"), None),
            "notes": finals_raw.get("notes") if isinstance(finals_raw.get("notes"), str) else "",
        },
        "payoutRatio": _num(data.get("payoutRatio"), None),
        "usbcRequired": bool(data.get("usbcRequired")),
    }


def rules_for_event(event: Mapping[str, Any]) -> dict:
    max_players = _num(event.get("maxPlayers"), 1)
    return normalize_event_rules(event.get("rules"), scoring=event_scoring(event), max_players=int(max_players))


def handicap_pins(rule: Mapping[str, Any], average: float) -> int:
    """Per-game handicap for one average: floor(max(0, basis - average) * percent / 100), capped."""
    gap = max(0.0, float(rule["basis"]) - float(average))
    pins = int(math.floor(gap * float(rule["percent"]) / 100 + 1e-9))
    max_pins = rule.get("maxPins")
    return pins if max_pins is None else min(pins, int(max_pins))


def effective_average(average: Optional[float], rules: Mapping[str, Any]) -> Optional[float]:
    if average is not None:
        return average
    return _as_dict(rules.get("average")).get("assignedAverage")


def entry_handicaps(rules: Mapping[str, Any], scoring: str, averages: Sequence[Optional[float]]) -> list[int]:
    """Per-game handicap for each bowler of an entry, in bowler order.

    Scratch and no-tap are always 0. With ``perPair`` the pair's combined average is compared to the
    basis and the pair handicap is split across the bowlers (first bowlers take any odd pin), so the
    entry's handicap is still the sum.
    """
    rule = rules.get("handicap")
    count = len(averages)
    if scoring != "handicap" or not rule or count == 0:
        return [0] * count
    resolved = [effective_average(average, rules) for average in averages]
    if rule.get("perPair") and count >= 2:
        if any(average is None for average in resolved):
            return [0] * count
        pair = handicap_pins(rule, sum(resolved))  # type: ignore[arg-type]
        base, extra = divmod(pair, count)
        return [base + (1 if index < extra else 0) for index in range(count)]
    return [0 if average is None else handicap_pins(rule, average) for average in resolved]


def scoring_label(scoring: str, rules: Mapping[str, Any]) -> str:
    if scoring == "no-tap":
        return "9-pin no-tap, scratch"
    rule = rules.get("handicap")
    if scoring != "handicap" or not rule:
        return "Scratch"
    label = f"Handicap {_plain_number(rule['percent'])}% of {_plain_number(rule['basis'])}"
    if rule.get("perPair"):
        label += " per pair"
    if rule.get("maxPins") is not None:
        label += f", max {_plain_number(rule['maxPins'])}"
    return label


def _plain_number(value: float) -> str:
    return str(int(value)) if float(value).is_integer() else f"{value:g}"


def finals_field_size(rules: Mapping[str, Any], ranked_count: int, entry_count: int) -> Optional[int]:
    """How many advance from qualifying (null: no cut)."""
    finals = rules["finals"]
    cut = finals.get("cut")
    if cut and cut.get("value"):
        if cut["by"] == "percent":
            base = ranked_count or entry_count
            size = int(math.ceil(float(cut["value"]) / 100 * base - 1e-9))
        else:
            size = int(cut["value"])
        return max(0, min(size, entry_count))
    default = DEFAULT_FINALS_FIELD.get(finals["type"])
    if default is None:
        return None
    return min(default, entry_count)


def cashing_count(payout_ratio: Optional[float], entry_count: int) -> Optional[int]:
    if not payout_ratio or payout_ratio <= 0:
        return None
    return int(math.ceil(entry_count / float(payout_ratio) - 1e-9))


# ---------------------------------------------------------------------------
# Inputs


@dataclass(frozen=True)
class BowlerIn:
    id: int
    first_name: str
    last_name: str
    average: Optional[int] = None
    usbc_number: Optional[str] = None
    registration_id: Optional[int] = None

    @property
    def name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip() or "Bowler"

    @property
    def identity(self) -> str:
        digits = re.sub(r"\D", "", self.usbc_number or "")
        if digits:
            return f"usbc:{digits}"
        return "name:" + re.sub(r"\s+", " ", self.name.lower()).strip()


@dataclass(frozen=True)
class EntryIn:
    id: int
    event_id: str
    bowler_ids: tuple[int, ...]
    division_id: Optional[str] = None
    event_name: str = ""
    division_name: Optional[str] = None
    squad_id: Optional[str] = None
    squad_label: Optional[str] = None
    reentry_number: int = 0
    registration_id: Optional[int] = None


@dataclass(frozen=True)
class FinalsGameIn:
    round: int
    match: int
    seed: int
    score: Optional[int]
    game: int = 1


@dataclass
class FinalsIn:
    event_id: str
    division_id: Optional[str]
    type: str
    seeds: list[dict]
    games: list[FinalsGameIn] = field(default_factory=list)


@dataclass
class TournamentIn:
    id: int
    name: str
    date_text: str = ""
    location_text: str = ""
    logo_url: Optional[str] = None


@dataclass
class StandingsInput:
    tournament: TournamentIn
    setup: dict
    bowlers: dict[int, BowlerIn]
    entries: list[EntryIn]
    # (entry_id, bowler_id) -> {game_number: score}
    scores: dict[tuple[int, int], dict[int, int]]
    finals: list[FinalsIn] = field(default_factory=list)
    # (fee_config_id, registration_id, bowler_id or None) for side events bought.
    side_events: list[tuple[str, int, Optional[int]]] = field(default_factory=list)
    updated_at: Optional[str] = None


# ---------------------------------------------------------------------------
# Qualifying


@dataclass
class _Row:
    key: str
    name: str
    entry_ids: list[int]
    bowler_ids: list[int]
    bowlers: list[dict]
    games: list[Optional[int]]
    games_bowled: int
    scratch_total: int
    handicap_total: int
    handicap_per_game: int
    squad_label: Optional[str]
    identity: tuple[str, ...]
    # bowler_id -> (games bowled, scratch, handicap) for All Events.
    shares: dict[int, tuple[int, int, int]]
    rank: Optional[int] = None
    tied: bool = False
    status: Optional[str] = None

    @property
    def total(self) -> int:
        return self.scratch_total + self.handicap_total

    def as_payload(self) -> dict:
        return {
            "key": self.key,
            "rank": self.rank,
            "tied": self.tied,
            "name": self.name,
            "bowlers": self.bowlers,
            "games": self.games,
            "gamesBowled": self.games_bowled,
            "scratchTotal": self.scratch_total,
            "handicapTotal": self.handicap_total,
            "total": self.total,
            "status": self.status,
            "squadLabel": self.squad_label,
        }


def entry_name(bowlers: Sequence[BowlerIn]) -> str:
    if not bowlers:
        return "Entry"
    if len(bowlers) == 1:
        return bowlers[0].name
    if len(bowlers) == 2:
        return f"{bowlers[0].name} & {bowlers[1].name}"
    last_names = [bowler.last_name or bowler.first_name for bowler in bowlers]
    return ", ".join(last_names[:-1]) + f" & {last_names[-1]}"


def build_entry_row(
    entry: EntryIn,
    *,
    bowlers: Mapping[int, BowlerIn],
    scores: Mapping[tuple[int, int], Mapping[int, int]],
    rules: Mapping[str, Any],
    scoring: str,
    games_count: int,
) -> _Row:
    members = [bowlers[bowler_id] for bowler_id in entry.bowler_ids if bowler_id in bowlers]
    handicaps = entry_handicaps(rules, scoring, [member.average for member in members])
    shared = rules["format"] in SHARED_SCORE_FORMATS
    per_bowler_games = [dict(scores.get((entry.id, member.id), {})) for member in members]
    max_game = max([games_count, *[max(games, default=0) for games in per_bowler_games]])
    games: list[Optional[int]] = []
    for game in range(1, max_game + 1):
        values = [games_[game] for games_ in per_bowler_games if game in games_]
        games.append(sum(values) if values else None)
    games_bowled = sum(1 for value in games if value is not None)
    scratch_total = sum(value for value in games if value is not None)
    entry_handicap = sum(handicaps)
    shares: dict[int, tuple[int, int, int]] = {}
    if shared:
        handicap_total = entry_handicap * games_bowled
        count = len(members) or 1
        for index, member in enumerate(members):
            shares[member.id] = (
                games_bowled,
                int(round(scratch_total / count)),
                handicaps[index] * games_bowled,
            )
    else:
        handicap_total = 0
        for index, member in enumerate(members):
            own = per_bowler_games[index]
            own_games = len(own)
            handicap_total += handicaps[index] * own_games
            shares[member.id] = (own_games, sum(own.values()), handicaps[index] * own_games)
    return _Row(
        key=str(entry.id),
        name=entry_name(members),
        entry_ids=[entry.id],
        bowler_ids=[member.id for member in members],
        bowlers=[
            {"name": member.name, "average": member.average, "handicapPerGame": handicaps[index]}
            for index, member in enumerate(members)
        ],
        games=games,
        games_bowled=games_bowled,
        scratch_total=scratch_total,
        handicap_total=handicap_total,
        handicap_per_game=entry_handicap,
        squad_label=entry.squad_label,
        identity=tuple(sorted(member.identity for member in members)),
        shares=shares,
    )


def rank_rows(rows: list, *, total=lambda row: row.total, bowled=lambda row: row.games_bowled > 0) -> list:
    """Sort by total (bowled rows first), set shared ranks for ties and ``tied``. Returns a new list."""
    ranked = sorted((row for row in rows if bowled(row)), key=lambda row: (-total(row), row.name.lower()))
    unranked = sorted((row for row in rows if not bowled(row)), key=lambda row: row.name.lower())
    counts: dict[int, int] = {}
    for row in ranked:
        counts[total(row)] = counts.get(total(row), 0) + 1
    previous = None
    for index, row in enumerate(ranked):
        if previous is None or total(row) != total(previous):
            row.rank = index + 1
        else:
            row.rank = previous.rank
        row.tied = counts[total(row)] > 1
        previous = row
    for row in unranked:
        row.rank = None
        row.tied = False
    return ranked + unranked


def _label_reentries(rows: list[_Row], entries_by_id: Mapping[int, EntryIn]) -> None:
    """All-count: a bowler's (or pair's) later entries in an event add " (re-entry N)"."""
    seen: dict[tuple[str, ...], int] = {}
    for row in sorted(rows, key=lambda item: item.entry_ids[0]):
        number = seen.get(row.identity, 0)
        seen[row.identity] = number + 1
        stored = entries_by_id[row.entry_ids[0]].reentry_number
        label = stored if stored > 0 else number
        if label > 0:
            row.name = f"{row.name} (re-entry {label})"


def _best_counts(rows: list[_Row]) -> list[_Row]:
    """One row per bowler (or pair/team) identity, keeping the best set."""
    groups: dict[tuple[str, ...], list[_Row]] = {}
    for row in rows:
        groups.setdefault(row.identity, []).append(row)
    best_rows = []
    for group in groups.values():
        first = min(group, key=lambda row: row.entry_ids[0])
        best = max(group, key=lambda row: (row.total, row.games_bowled, -row.entry_ids[0]))
        best.key = f"bowler:{first.bowler_ids[0]}" if first.bowler_ids else f"entry:{first.entry_ids[0]}"
        best_rows.append(best)
    return best_rows


def apply_lines(rows: list[_Row], advancing: Optional[int], cashing: Optional[int]) -> None:
    for row in rows:
        row.status = None
        if row.rank is None:
            continue
        if advancing and row.rank <= advancing:
            row.status = "advancing"
        elif cashing and row.rank <= cashing:
            row.status = "cashing"


# ---------------------------------------------------------------------------
# Finals


def _side(seed: int, name: str, score: Optional[int], winner: bool = False) -> dict:
    return {"seed": seed, "name": name, "score": score, "winner": winner}


class _FinalsScores:
    def __init__(self, seeds: Sequence[Mapping[str, Any]], games: Iterable[FinalsGameIn], handicap: bool):
        self.seeds = {int(seed["seed"]): seed for seed in seeds}
        self.handicap = handicap
        self.values: dict[tuple[int, int, int], int] = {}
        for game in games:
            if game.score is not None:
                self.values[(game.round, game.match, game.seed)] = game.score

    def key(self, seed: int) -> str:
        return str(self.seeds.get(seed, {}).get("key") or f"seed:{seed}")

    def name(self, seed: int) -> str:
        return str(self.seeds.get(seed, {}).get("name") or f"Seed {seed}")

    def score(self, round_: int, match: int, seed: int) -> Optional[int]:
        raw = self.values.get((round_, match, seed))
        if raw is None:
            return None
        extra = int(self.seeds.get(seed, {}).get("handicapPerGame") or 0) if self.handicap else 0
        return raw + extra


def _decide(a: dict, b: dict) -> Optional[int]:
    """Seed of the winner, or None while a score is missing or the game is tied (roll-off pending)."""
    if a["score"] is None or b["score"] is None or a["score"] == b["score"]:
        return None
    winner = a if a["score"] > b["score"] else b
    winner["winner"] = True
    return winner["seed"]


def _tie_note(label: str) -> str:
    return f"{label} is tied. Bowl a roll-off and enter the result as a corrected score."


def stepladder_finals(scores: _FinalsScores) -> dict:
    seeds = sorted(scores.seeds)
    n = len(seeds)
    matches, notes = [], []
    champion = None
    challenger: Optional[int] = seeds[-1] if n >= 2 else None
    for round_ in range(1, n):
        waiting = seeds[n - 1 - round_]
        label = "Title match" if round_ == n - 1 else f"Match {round_}"
        # a: the challenger climbing the ladder (null until the previous match is decided); b: the seed waiting.
        b = _side(waiting, scores.name(waiting), scores.score(round_, 1, waiting))
        if challenger is None:
            a = None
            b["score"] = None
            winner = None
        else:
            a = _side(challenger, scores.name(challenger), scores.score(round_, 1, challenger))
            winner = _decide(a, b)
            if winner is None and a["score"] is not None and a["score"] == b["score"]:
                notes.append(_tie_note(label))
        matches.append({"id": f"r{round_}-m1", "round": round_, "label": label, "a": a, "b": b})
        if challenger is not None and winner is None:
            challenger = None
        elif winner is not None:
            challenger = winner
            if round_ == n - 1:
                loser = b if winner == a["seed"] else a
                champion = {
                    "name": scores.name(winner),
                    "detail": f"Won the title match {max(a['score'], b['score'])} to {loser['score']}",
                }
    return {"matches": matches, "champion": champion, "notes": notes}


def seeding_order(size: int) -> list[int]:
    """Standard bracket order: 1 v 8, 4 v 5, 2 v 7, 3 v 6 for eight."""
    order = [1]
    while len(order) < size:
        total = len(order) * 2 + 1
        order = [seed for item in order for seed in (item, total - item)]
    return order


def _match_play_label(round_: int, rounds: int, match: int) -> str:
    if round_ == rounds:
        return "Final"
    if round_ == rounds - 1:
        return f"Semifinal {match}"
    if round_ == rounds - 2:
        return f"Quarterfinal {match}"
    return f"Round {round_}, match {match}"


def match_play_finals(scores: _FinalsScores) -> dict:
    seeds = sorted(scores.seeds)
    n = len(seeds)
    if n < 2:
        return {"matches": [], "champion": None, "notes": []}
    size = 1
    while size < n:
        size *= 2
    rounds = int(math.log2(size))
    order = seeding_order(size)
    seed_at = {index + 1: seed for index, seed in enumerate(seeds)}  # position -> stored seed number
    matches, notes = [], []
    winners: list[Optional[int]] = []
    champion = None
    for round_ in range(1, rounds + 1):
        count = size >> round_
        next_winners: list[Optional[int]] = []
        for match in range(1, count + 1):
            label = _match_play_label(round_, rounds, match)
            if round_ == 1:
                pa, pb = order[2 * (match - 1)], order[2 * (match - 1) + 1]
                sa = seed_at.get(pa)
                sb = seed_at.get(pb)
            else:
                sa, sb = winners[2 * (match - 1)], winners[2 * (match - 1) + 1]
            winner: Optional[int] = None
            if round_ == 1 and sb is None:
                a = _side(sa, scores.name(sa), None, True)  # bye
                b = None
                winner = sa
            elif sa and sb:
                a = _side(sa, scores.name(sa), scores.score(round_, match, sa))
                b = _side(sb, scores.name(sb), scores.score(round_, match, sb))
                winner = _decide(a, b)
                if winner is None and a["score"] is not None and a["score"] == b["score"]:
                    notes.append(_tie_note(label))
            else:
                # Contract: a null means "waiting on an earlier match"; b null with a set would read as a bye,
                # so a lone known side goes in b until both are decided.
                known = sa or sb
                a = None
                b = _side(known, scores.name(known), None) if known else None
            matches.append({"id": f"r{round_}-m{match}", "round": round_, "label": label, "a": a, "b": b})
            next_winners.append(winner)
            if round_ == rounds and winner is not None and a is not None and b is not None:
                loser = b if winner == a["seed"] else a
                champion = {
                    "name": scores.name(winner),
                    "detail": f"Won the final {max(a['score'], b['score'])} to {loser['score']}",
                }
        winners = next_winners
    return {"matches": matches, "champion": champion, "notes": notes}


def round_robin_schedule(seeds: Sequence[int]) -> list[list[tuple[int, int]]]:
    """Circle method: everyone bowls everyone once. Returns pairs per round (byes dropped)."""
    players: list[Optional[int]] = list(seeds)
    if len(players) % 2:
        players.append(None)
    count = len(players)
    schedule = []
    for _ in range(count - 1):
        pairs = []
        for index in range(count // 2):
            a, b = players[index], players[count - 1 - index]
            if a is not None and b is not None:
                pairs.append((min(a, b), max(a, b)))
        schedule.append(pairs)
        players = [players[0], players[-1], *players[1:-1]]
    return schedule


def _number(value: float) -> float | int:
    return int(value) if float(value).is_integer() else value


def round_robin_finals(scores: _FinalsScores, *, scoring: Optional[str], win_bonus: Optional[float]) -> dict:
    seeds = sorted(scores.seeds)
    method = scoring or "petersen"
    bonus = float(win_bonus if win_bonus is not None else DEFAULT_WIN_BONUS_PINS)
    stats = {seed: {"wins": 0, "losses": 0, "ties": 0, "pins": 0, "petersen": 0.0} for seed in seeds}
    matches = []
    open_matches = 0
    for round_index, pairs in enumerate(round_robin_schedule(seeds), start=1):
        for match_index, (sa, sb) in enumerate(pairs, start=1):
            a = _side(sa, scores.name(sa), scores.score(round_index, match_index, sa))
            b = _side(sb, scores.name(sb), scores.score(round_index, match_index, sb))
            for side in (a, b):
                if side["score"] is not None:
                    stats[side["seed"]]["pins"] += side["score"]
                    stats[side["seed"]]["petersen"] += side["score"] // 50
            if a["score"] is None or b["score"] is None:
                open_matches += 1
            elif a["score"] == b["score"]:
                stats[sa]["ties"] += 1
                stats[sb]["ties"] += 1
            else:
                winner = _decide(a, b)
                loser = sb if winner == sa else sa
                stats[winner]["wins"] += 1
                stats[loser]["losses"] += 1
            matches.append({
                "id": f"r{round_index}-m{match_index}",
                "round": round_index,
                "label": f"Round {round_index}, match {match_index}",
                "a": a,
                "b": b,
            })
    table = []
    for seed in seeds:
        item = stats[seed]
        if method == "petersen":
            points = item["petersen"] + item["wins"] + 0.5 * item["ties"]
        else:
            points = item["pins"] + bonus * item["wins"] + bonus / 2 * item["ties"]
        table.append({
            "key": scores.key(seed),
            "seed": seed,
            "name": scores.name(seed),
            "wins": item["wins"],
            "losses": item["losses"],
            "ties": item["ties"],
            "pins": item["pins"],
            "points": _number(points),
        })
    table.sort(key=lambda row: (-row["points"], -row["pins"], row["seed"]))
    previous = None
    for index, row in enumerate(table):
        same = previous is not None and row["points"] == previous["points"]
        row["rank"] = previous["rank"] if same else index + 1
        previous = row
    table = [{"key": row.pop("key"), "rank": row.pop("rank"), **row} for row in table]
    champion = None
    if matches and open_matches == 0 and table:
        top = table[0]
        unit = "Petersen points" if method == "petersen" else "points with bonus pins"
        champion = {"name": top["name"], "detail": f"Won with {top['points']:,} {unit}"}
    return {"matches": matches, "table": table, "champion": champion, "notes": []}


def survivor_finals(scores: _FinalsScores) -> dict:
    remaining = sorted(scores.seeds)
    rounds, notes = [], []
    champion = None
    round_ = 1
    while len(remaining) >= 2:
        rows = [
            {"key": scores.key(seed), "seed": seed, "name": scores.name(seed), "score": scores.score(round_, 1, seed), "eliminated": False}
            for seed in remaining
        ]
        rounds.append({"round": round_, "label": f"Round {round_}", "rows": rows})
        if any(row["score"] is None for row in rows):
            break
        cut = max(1, len(rows) // 2)
        ordered = sorted(rows, key=lambda row: (row["score"], -row["seed"]))
        if ordered[cut - 1]["score"] == ordered[cut]["score"]:
            notes.append(_tie_note(f"Round {round_} cut"))
            break
        for row in ordered[:cut]:
            row["eliminated"] = True
        remaining = [row["seed"] for row in rows if not row["eliminated"]]
        if len(remaining) == 1:
            champion = {
                "name": scores.name(remaining[0]),
                "detail": f"Last one standing after {round_} round{'s' if round_ > 1 else ''}",
            }
            break
        round_ += 1
    return {"rounds": rounds, "champion": champion, "notes": notes}


def finals_label(finals_type: str, field_size: Optional[int], rules: Mapping[str, Any]) -> str:
    size = f", top {field_size}" if field_size else ""
    if finals_type == "stepladder":
        return f"Stepladder{size}"
    if finals_type == "match-play-single":
        return f"Match play{size}"
    if finals_type == "match-play-double":
        return f"Match play, double elimination{size}"
    if finals_type == "round-robin":
        if rules["finals"].get("roundRobinScoring") == "bonus-pins":
            bonus = rules["finals"].get("winBonusPins")
            bonus = DEFAULT_WIN_BONUS_PINS if bonus is None else bonus
            return f"Round robin, {_plain_number(bonus)} bonus pins per win"
        return "Round robin, Petersen points"
    if finals_type == "survivor":
        return "Survivor"
    return "Finals"


def compute_finals(
    finals_type: str,
    rules: Mapping[str, Any],
    stored: Optional[FinalsIn],
    *,
    handicap: bool,
    field_size: Optional[int],
) -> Optional[dict]:
    """LiveFinals for one event and division, or None when the event has no bracketed finals."""
    if stored is not None:
        finals_type = stored.type
    if finals_type not in BRACKETED_FINALS:
        return None
    rule_notes = rules["finals"].get("notes") or ""
    size = len(stored.seeds) if stored else field_size
    result = {
        "type": finals_type,
        "label": finals_label(finals_type, size, rules),
        "status": "not-started",
        "champion": None,
        "matches": [],
        "rounds": [],
        "table": [],
        "notes": rule_notes,
    }
    if finals_type == "match-play-double":
        result["notes"] = DOUBLE_ELIMINATION_NOTE
        return result
    if stored is None:
        return result
    scores = _FinalsScores(stored.seeds, stored.games, handicap)
    if finals_type == "stepladder":
        computed = stepladder_finals(scores)
    elif finals_type == "match-play-single":
        computed = match_play_finals(scores)
    elif finals_type == "round-robin":
        computed = round_robin_finals(
            scores,
            scoring=rules["finals"].get("roundRobinScoring"),
            win_bonus=rules["finals"].get("winBonusPins"),
        )
    else:
        computed = survivor_finals(scores)
    result.update({key: value for key, value in computed.items() if key != "notes"})
    result["status"] = "complete" if computed["champion"] else "in-progress"
    result["notes"] = " ".join(note for note in [rule_notes, *computed["notes"]] if note)
    return result


# ---------------------------------------------------------------------------
# Tournament


def _enabled(items: Any) -> list[dict]:
    rows = [item for item in (items or []) if isinstance(item, dict) and item.get("enabled", True) is not False]
    return sorted(
        (item for item in rows if str(item.get("id") or "").strip()),
        key=lambda item: (_num(item.get("displayOrder"), 0), ),
    )


def _event_divisions(event: Mapping[str, Any], divisions: Sequence[Mapping[str, Any]]) -> list[dict]:
    event_id = str(event.get("id"))
    connected = {str(item) for item in (event.get("connectedDivisionIds") or [])}
    return [
        division for division in divisions
        if event_id in {str(item) for item in (division.get("eventIds") or [])} or str(division.get("id")) in connected
    ]


@dataclass
class _DivisionResult:
    payload: dict
    rows: list[_Row]
    event_id: str
    division_id: Optional[str]


def all_events_fee_ids(setup: Mapping[str, Any]) -> list[str]:
    ids = []
    for fee in _enabled(setup.get("fees")):
        kind = _as_dict(fee.get("sideEvent")).get("kind") or "fee"
        if kind in ("fee", "other") and _ALL_EVENTS_NAME.search(str(fee.get("name") or "")):
            ids.append(str(fee["id"]))
    return ids


def compute_standings(data: StandingsInput) -> dict:
    """The full LiveStandings payload (camelCase), including ``fingerprint``."""
    return compute_standings_detail(data)[0]


def compute_standings_detail(data: StandingsInput) -> tuple[dict, dict[tuple[str, Optional[str]], _DivisionResult]]:
    """The payload plus each division's ranked rows (with entry and bowler ids), keyed by (event, division)."""
    setup = data.setup if isinstance(data.setup, dict) else {}
    setup_events = _enabled(setup.get("events"))
    setup_divisions = _enabled(setup.get("divisions"))
    entries = list(data.entries)
    entries_by_id = {entry.id: entry for entry in entries}
    finals_by_key = {(item.event_id, item.division_id): item for item in data.finals}

    known_event_ids = {str(event["id"]) for event in setup_events}
    for entry in sorted(entries, key=lambda item: item.id):
        if entry.event_id not in known_event_ids:
            known_event_ids.add(entry.event_id)
            setup_events.append({"id": entry.event_id, "name": entry.event_name or "Event", "scoring": "scratch", "maxPlayers": len(entry.bowler_ids)})

    events_payload = []
    division_results: list[_DivisionResult] = []
    event_meta: list[tuple[dict, dict, str]] = []
    for event in setup_events:
        event_id = str(event["id"])
        scoring = event_scoring(event)
        rules = rules_for_event(event)
        event_entries = [entry for entry in entries if entry.event_id == event_id]
        event_entry_ids = {entry.id for entry in event_entries}
        max_bowled = max(
            (max(games, default=0) for (entry_id, _), games in data.scores.items() if entry_id in event_entry_ids),
            default=0,
        )
        games_count = max(int(rules["games"] or 0), max_bowled)
        rows_all = [
            build_entry_row(entry, bowlers=data.bowlers, scores=data.scores, rules=rules, scoring=scoring, games_count=games_count)
            for entry in event_entries
        ]
        if rules["reentryScoring"] == "all-count":
            _label_reentries(rows_all, entries_by_id)
        row_by_entry = {row.entry_ids[0]: row for row in rows_all}

        division_list: list[tuple[Optional[str], Optional[str]]] = [
            (str(division["id"]), str(division.get("name") or "Division")) for division in _event_divisions(event, setup_divisions)
        ]
        listed = {division_id for division_id, _ in division_list}
        for entry in sorted(event_entries, key=lambda item: item.id):
            if entry.division_id and entry.division_id not in listed:
                listed.add(entry.division_id)
                division_list.append((entry.division_id, entry.division_name or "Division"))
        if not division_list or any(entry.division_id is None for entry in event_entries):
            division_list.append((None, None))

        divisions_payload = []
        for division_id, division_name in division_list:
            division_entries = [entry for entry in event_entries if entry.division_id == division_id]
            rows = [row_by_entry[entry.id] for entry in division_entries]
            if rules["reentryScoring"] == "best-counts":
                rows = _best_counts(rows)
            rows = rank_rows(rows)
            ranked_count = sum(1 for row in rows if row.rank is not None)
            entry_count = len(division_entries)
            advancing = finals_field_size(rules, ranked_count, len(rows))
            cashing = cashing_count(rules["payoutRatio"], entry_count)
            apply_lines(rows, advancing, cashing)
            finals = compute_finals(
                rules["finals"]["type"],
                rules,
                finals_by_key.get((event_id, division_id)),
                handicap=scoring == "handicap",
                field_size=advancing,
            )
            payload = {
                "id": division_id,
                "name": division_name,
                "entryCount": entry_count,
                "advancingCount": advancing,
                "cashingCount": cashing,
                "rows": [row.as_payload() for row in rows],
                "finals": finals,
            }
            divisions_payload.append(payload)
            division_results.append(_DivisionResult(payload, rows, event_id, division_id))
        events_payload.append({
            "id": event_id,
            "name": str(event.get("name") or "Event"),
            "format": rules["format"],
            "scoring": scoring,
            "games": int(rules["games"] or 0),
            "scoringLabel": scoring_label(scoring, rules),
            "divisions": divisions_payload,
        })
        event_meta.append((event, rules, scoring))

    all_events = compute_all_events(data, division_results, event_meta)
    has_scores = any(games for games in data.scores.values())
    payload = {
        "tournament": {
            "id": data.tournament.id,
            "name": data.tournament.name,
            "dateText": data.tournament.date_text,
            "locationText": data.tournament.location_text,
            "status": tournament_status(has_scores, events_payload, division_results),
            "logoUrl": data.tournament.logo_url,
        },
        "updatedAt": data.updated_at,
        "fingerprint": "",
        "events": events_payload,
        "allEvents": all_events,
    }
    payload["fingerprint"] = fingerprint(payload)
    return payload, {(result.event_id, result.division_id): result for result in division_results}


def tournament_status(has_scores: bool, events: Sequence[Mapping[str, Any]], divisions: Sequence[_DivisionResult]) -> str:
    if not has_scores:
        return "upcoming"
    games_by_event = {event["id"]: event["games"] for event in events}
    for result in divisions:
        if not result.rows:
            continue
        finals = result.payload["finals"]
        if finals is not None:
            if finals["status"] != "complete":
                return "in-progress"
            continue
        needed = games_by_event.get(result.event_id) or max((row.games_bowled for row in result.rows), default=0)
        if needed <= 0 or any(row.games_bowled < needed for row in result.rows):
            return "in-progress"
    return "final"


def compute_all_events(
    data: StandingsInput,
    divisions: Sequence[_DivisionResult],
    event_meta: Sequence[tuple[dict, dict, str]],
) -> Optional[dict]:
    setup = data.setup if isinstance(data.setup, dict) else {}
    details = _as_dict(setup.get("details"))
    fee_ids = all_events_fee_ids(setup)
    if details.get("formatTemplateId") != "association" and not fee_ids:
        return None
    events = [(str(event["id"]), str(event.get("name") or "Event")) for event, _, _ in event_meta]
    # All Events adds up several events; with one event it would only repeat that event's standings.
    if len(events) < 2:
        return None
    event_index = {event_id: index for index, (event_id, _) in enumerate(events)}

    # identity -> per event best (games, total), plus a display name and key.
    totals: dict[str, dict[str, Any]] = {}
    entered: dict[str, set[str]] = {}
    for entry in data.entries:
        for bowler_id in entry.bowler_ids:
            bowler = data.bowlers.get(bowler_id)
            if bowler:
                entered.setdefault(bowler.identity, set()).add(entry.event_id)

    for result in divisions:
        for row in result.rows:
            for bowler_id, (games, scratch, handicap) in row.shares.items():
                bowler = data.bowlers.get(bowler_id)
                if bowler is None:
                    continue
                item = totals.setdefault(bowler.identity, {"name": bowler.name, "key": f"bowler:{bowler.id}", "events": {}})
                current = item["events"].get(result.event_id)
                candidate = (scratch + handicap, games)
                if games > 0 and (current is None or candidate > current):
                    item["events"][result.event_id] = candidate

    if fee_ids:
        allowed_registrations = {reg for fee, reg, bowler in data.side_events if fee in fee_ids and bowler is None}
        allowed_bowlers = {bowler for fee, _, bowler in data.side_events if fee in fee_ids and bowler is not None}
        identities = {
            bowler.identity for bowler in data.bowlers.values()
            if bowler.id in allowed_bowlers or (bowler.registration_id is not None and bowler.registration_id in allowed_registrations)
        }
    else:
        every = set(event_index)
        identities = {identity for identity, events_entered in entered.items() if every <= events_entered}

    @dataclass
    class _AllRow:
        key: str
        name: str
        event_totals: list
        total: int
        games: int
        rank: Optional[int] = None
        tied: bool = False

    rows = []
    for identity in identities:
        item = totals.get(identity)
        if item is None:
            bowler = next(b for b in data.bowlers.values() if b.identity == identity)
            item = {"name": bowler.name, "key": f"bowler:{bowler.id}", "events": {}}
        event_totals: list[Optional[int]] = [None] * len(events)
        games = 0
        for event_id, (value, played) in item["events"].items():
            if event_id in event_index:
                event_totals[event_index[event_id]] = value
                games += played
        rows.append(_AllRow(item["key"], item["name"], event_totals, sum(v for v in event_totals if v is not None), games))
    rows = rank_rows(rows, bowled=lambda row: row.games > 0)
    first_rules = event_meta[0][1]
    cashing = cashing_count(first_rules["payoutRatio"], len(rows))
    return {
        "events": [{"id": event_id, "name": name} for event_id, name in events],
        "cashingCount": cashing,
        "rows": [
            {
                "key": row.key,
                "rank": row.rank,
                "tied": row.tied,
                "name": row.name,
                "eventTotals": row.event_totals,
                "total": row.total,
                "status": "cashing" if cashing and row.rank is not None and row.rank <= cashing else None,
            }
            for row in rows
        ],
    }


def fingerprint(payload: Mapping[str, Any]) -> str:
    body = {key: value for key, value in payload.items() if key != "fingerprint"}
    return hashlib.sha1(json.dumps(body, sort_keys=True, default=str).encode("utf-8")).hexdigest()


def finals_seeds(division_payload: Mapping[str, Any], rows: Sequence[_Row]) -> list[dict]:
    """Seed snapshot for starting finals: the advancing rows in standings order."""
    advancing = division_payload.get("advancingCount") or 0
    ranked = [row for row in rows if row.rank is not None][:advancing]
    return [
        {
            "seed": index + 1,
            "key": row.key,
            "name": row.name,
            "entryIds": list(row.entry_ids),
            "bowlerIds": list(row.bowler_ids),
            "handicapPerGame": row.handicap_per_game,
            "qualifyingTotal": row.total,
        }
        for index, row in enumerate(ranked)
    ]


# ---------------------------------------------------------------------------
# Display text


_MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
_WEEKDAYS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")


def _parse_date(value: Any) -> Optional[date]:
    text = str(value or "").strip()[:10]
    if not text:
        return None
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def date_text(start: Any, end: Any) -> str:
    first, last = _parse_date(start), _parse_date(end)
    if first is None:
        return ""
    if last is None or last == first:
        return f"{_MONTHS[first.month - 1]} {first.day}, {first.year}"
    if first.year == last.year:
        return f"{_MONTHS[first.month - 1]} {first.day} - {_MONTHS[last.month - 1]} {last.day}, {last.year}"
    return f"{_MONTHS[first.month - 1]} {first.day}, {first.year} - {_MONTHS[last.month - 1]} {last.day}, {last.year}"


def _parse_time(value: Any) -> Optional[str]:
    text = str(value or "").strip().upper()
    for pattern in ("%H:%M", "%H:%M:%S", "%I:%M %p", "%I:%M%p", "%I %p"):
        try:
            parsed = datetime.strptime(text, pattern)
        except ValueError:
            continue
        hour = parsed.hour % 12 or 12
        return f"{hour}:{parsed.minute:02d} {'AM' if parsed.hour < 12 else 'PM'}"
    return None


def squad_label(name: Any, date_value: Any, time_value: Any) -> Optional[str]:
    day = _parse_date(date_value)
    clock = _parse_time(time_value)
    if day and clock:
        return f"{_WEEKDAYS[day.weekday()]} {clock}"
    text = str(name or "").strip()
    return text or None


def location_text(details: Mapping[str, Any], fallback: Optional[str]) -> str:
    center = str(details.get("bowlingCenter") or "").strip()
    city = str(details.get("city") or "").strip()
    state = str(details.get("state") or "").strip()
    parts = [part for part in (center, city, state) if part]
    if parts:
        return ", ".join(parts)
    return str(fallback or "").strip()


def as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def isoformat(value: Optional[datetime]) -> Optional[str]:
    return None if value is None else as_utc(value).isoformat()


# ---------------------------------------------------------------------------
# Database loader


def published_setup(state: Any) -> dict:
    if state is None:
        return {}
    payload = state.payload if isinstance(state.payload, dict) else {}
    snapshot = payload.get("_publishedSnapshot")
    return snapshot if isinstance(snapshot, dict) else payload


def load_standings_input(db: Any, tournament: Any, *, logo_url: Optional[str] = None) -> StandingsInput:
    from ..core import models  # local import keeps the engine importable without the app

    state = db.query(models.TournamentCentralSetupState).filter(
        models.TournamentCentralSetupState.tournament_id == tournament.id
    ).first()
    setup = published_setup(state)
    details = _as_dict(setup.get("details"))

    entry_rows = (
        db.query(models.TcEntry)
        .join(models.TcRegistration, models.TcRegistration.id == models.TcEntry.registration_id)
        .filter(
            models.TcEntry.tournament_id == tournament.id,
            models.TcEntry.status.in_(ACTIVE_STATUSES),
            models.TcRegistration.status.in_(ACTIVE_STATUSES),
        )
        .order_by(models.TcEntry.id)
        .all()
    )
    entry_ids = [entry.id for entry in entry_rows]
    links = (
        db.query(models.TcEntryBowler)
        .filter(models.TcEntryBowler.entry_id.in_(entry_ids))
        .order_by(models.TcEntryBowler.entry_id, models.TcEntryBowler.position, models.TcEntryBowler.id)
        .all()
        if entry_ids else []
    )
    bowler_ids_by_entry: dict[int, list[int]] = {}
    for link in links:
        bowler_ids_by_entry.setdefault(link.entry_id, []).append(link.bowler_id)
    all_bowler_ids = {bowler_id for ids in bowler_ids_by_entry.values() for bowler_id in ids}
    bowlers = {
        bowler.id: BowlerIn(
            id=bowler.id,
            first_name=bowler.first_name or "",
            last_name=bowler.last_name or "",
            average=bowler.average,
            usbc_number=bowler.usbc_number,
            registration_id=bowler.registration_id,
        )
        for bowler in (
            db.query(models.TcRegistrationBowler).filter(models.TcRegistrationBowler.id.in_(all_bowler_ids)).all()
            if all_bowler_ids else []
        )
    }
    entries = [
        EntryIn(
            id=entry.id,
            event_id=entry.event_config_id,
            bowler_ids=tuple(bowler_ids_by_entry.get(entry.id, [])),
            division_id=entry.division_config_id or None,
            event_name=entry.event_name_snapshot,
            division_name=entry.division_name_snapshot,
            squad_id=entry.squad_config_id,
            squad_label=squad_label(entry.squad_name_snapshot, entry.squad_date_snapshot, entry.squad_time_snapshot),
            reentry_number=entry.reentry_number or 0,
            registration_id=entry.registration_id,
        )
        for entry in entry_rows
    ]

    latest: list[datetime] = []
    scores: dict[tuple[int, int], dict[int, int]] = {}
    active_entries = set(entry_ids)
    for score in db.query(models.TcScore).filter(models.TcScore.tournament_id == tournament.id).all():
        if score.updated_at:
            latest.append(as_utc(score.updated_at))
        if score.score is None or score.entry_id not in active_entries:
            continue
        scores.setdefault((score.entry_id, score.bowler_id), {})[score.game_number] = score.score

    finals = []
    finals_rows = db.query(models.TcFinals).filter(models.TcFinals.tournament_id == tournament.id).all()
    games_by_finals: dict[int, list[Any]] = {}
    if finals_rows:
        for game in db.query(models.TcFinalsGame).filter(
            models.TcFinalsGame.finals_id.in_([item.id for item in finals_rows])
        ).all():
            games_by_finals.setdefault(game.finals_id, []).append(game)
    for item in finals_rows:
        if item.updated_at:
            latest.append(as_utc(item.updated_at))
        games = []
        for game in games_by_finals.get(item.id, []):
            if game.updated_at:
                latest.append(as_utc(game.updated_at))
            games.append(FinalsGameIn(round=game.round, match=game.match_number, seed=game.seed, score=game.score, game=game.game_number))
        finals.append(FinalsIn(
            event_id=item.event_config_id,
            division_id=item.division_config_id or None,
            type=item.finals_type,
            seeds=list(item.seeds or []),
            games=games,
        ))

    side_events = [
        (row.fee_config_id, row.registration_id, row.bowler_id)
        for row in db.query(models.TcRegistrationSideEvent).filter(
            models.TcRegistrationSideEvent.tournament_id == tournament.id
        ).all()
    ]

    return StandingsInput(
        tournament=TournamentIn(
            id=tournament.id,
            name=str(tournament.name or details.get("name") or ""),
            date_text=date_text(details.get("startDateIso") or tournament.start_date, details.get("endDateIso") or tournament.end_date),
            location_text=location_text(details, tournament.location),
            logo_url=logo_url,
        ),
        setup=setup,
        bowlers=bowlers,
        entries=entries,
        scores=scores,
        finals=finals,
        side_events=side_events,
        updated_at=isoformat(max(latest)) if latest else None,
    )
