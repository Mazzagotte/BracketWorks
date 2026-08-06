from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Ensure imports work when running this file directly.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.api.deps import SessionLocal  # noqa: E402
from app.core import models  # noqa: E402
from app.services.brackets_simple import generate_tournament_brackets, validate_all_brackets  # noqa: E402


@dataclass
class RunMetrics:
    mode: str
    seed: int
    placed_entries: int
    refund_entries: int
    max_refunds_single_player: int
    refund_variance: float
    unique_pairs: int
    total_brackets: int
    duration_ms: float
    valid_structure: bool
    cap_violations: Optional[int]


@dataclass
class TrialResult:
    seed: int
    standard: RunMetrics
    experimental: RunMetrics


@dataclass
class AggregateSummary:
    trials: int
    standard_avg_placed: float
    experimental_avg_placed: float
    standard_avg_refunds: float
    experimental_avg_refunds: float
    standard_avg_max_refund_player: float
    experimental_avg_max_refund_player: float
    standard_avg_refund_variance: float
    experimental_avg_refund_variance: float
    standard_avg_unique_pairs: float
    experimental_avg_unique_pairs: float
    standard_avg_duration_ms: float
    experimental_avg_duration_ms: float
    experimental_better_placement_trials: int
    experimental_better_max_refund_trials: int
    experimental_better_variance_trials: int
    experimental_better_unique_pairs_trials: int
    experimental_higher_weighted_score_trials: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Benchmark standard vs experimental bracket generation on the same tournament/squad inputs.",
    )
    parser.add_argument("--tournament-id", type=int, required=True, help="Tournament ID to benchmark")
    parser.add_argument("--squad-id", type=int, default=None, help="Optional squad ID (defaults to all squads in tournament records)")
    parser.add_argument("--trials", type=int, default=20, help="Number of seed trials")
    parser.add_argument("--base-seed", type=int, default=42, help="Base seed")
    parser.add_argument("--seed-step", type=int, default=9973, help="Seed increment per trial")
    parser.add_argument("--experimental-attempts", type=int, default=64, help="Seed attempts inside experimental optimizer")
    parser.add_argument("--no-history", action="store_true", help="Disable historical matchup constraints")
    parser.add_argument("--json", dest="json_out", action="store_true", help="Print full JSON output")
    return parser.parse_args()


def apply_squad_filter(query: Any, squad_id: Optional[int], squad_column: Any) -> Any:
    if squad_id is None:
        return query
    return query.filter(squad_column == squad_id)


def build_players_data(db, tournament_id: int, squad_id: Optional[int]) -> Tuple[List[Dict[str, Any]], int, Any, str]:
    tournament = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
    if not tournament:
        raise ValueError(f"Tournament {tournament_id} not found")

    bracket_settings = db.query(models.BracketSettings).filter(
        models.BracketSettings.tournament_id == tournament_id
    ).first()
    if not bracket_settings or not bracket_settings.bracket_size:
        raise ValueError("Tournament bracket settings missing or bracket_size not configured")

    bowlers_query = apply_squad_filter(
        db.query(models.Bowler).filter(models.Bowler.tournament_id == tournament_id),
        squad_id,
        models.Bowler.squad_id,
    )

    bowlers = bowlers_query.all()
    if not bowlers:
        raise ValueError("No bowlers found for the selected tournament/squad")

    scores_query = apply_squad_filter(
        db.query(models.Score).filter(models.Score.tournament_id == tournament_id),
        squad_id,
        models.Score.squad_id,
    )
    scores_map = {s.bowler_id: s for s in scores_query.all()}

    players_data: List[Dict[str, Any]] = []
    for bowler in bowlers:
        score_record = scores_map.get(bowler.id)
        name_parts = bowler.name.split(" ", 1)
        first_name = name_parts[0] if len(name_parts) > 0 else ""
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        scores_dict = {
            "game1_scratch": score_record.game1_scratch if score_record else None,
            "game1_total": score_record.game1_total if score_record else None,
            "game2_scratch": score_record.game2_scratch if score_record else None,
            "game2_total": score_record.game2_total if score_record else None,
            "game3_scratch": score_record.game3_scratch if score_record else None,
            "game3_total": score_record.game3_total if score_record else None,
        } if score_record else {}

        players_data.append(
            {
                "id": bowler.id,
                "firstName": first_name,
                "lastName": last_name,
                "average": bowler.average or 0,
                "handicap": bowler.handicap_entries or 0,
                "scratch": bowler.scratch_entries or 0,
                "division": bowler.division or "Open",
                "bracket_entries": bowler.bracket_entries or {},
                "scores": scores_dict,
            }
        )

    return players_data, int(bracket_settings.bracket_size), bracket_settings.bracket_programs, tournament.name


def extract_refund_stats(result: Dict[str, Any]) -> Tuple[int, float]:
    by_player = Counter()
    for group in result.get("bracket_groups", []):
        for skipped in group.get("skipped_players", []):
            pid = skipped.get("player_id")
            if pid is not None:
                by_player[pid] += 1

    if not by_player:
        return 0, 0.0

    values = list(by_player.values())
    max_refund = max(values)
    variance = statistics.pvariance(values) if len(values) > 1 else 0.0
    return max_refund, float(variance)


def extract_unique_pairs(result: Dict[str, Any]) -> int:
    pairs = set()
    for group in result.get("bracket_groups", []):
        for bracket in group.get("brackets", []):
            rounds = bracket.get("rounds") or []
            if not rounds:
                continue
            for match in rounds[0].get("matches", []):
                a = match.get("playerA_id")
                b = match.get("playerB_id")
                if a is None or b is None:
                    continue
                if a == b:
                    continue
                pairs.add((min(a, b), max(a, b)))
    return len(pairs)


def collect_metrics(mode: str, seed: int, result: Dict[str, Any], duration_ms: float) -> RunMetrics:
    summary = result.get("summary", {})
    validation = validate_all_brackets(result)

    max_refund, refund_variance = extract_refund_stats(result)
    cap_violations_total: Optional[int] = None

    generation_debug = result.get("generation_debug", {}) or {}
    programs_debug = generation_debug.get("programs", {}) or {}
    cap_values = []
    for data in programs_debug.values():
        cv = data.get("cap_violations")
        if isinstance(cv, int):
            cap_values.append(cv)
    if cap_values:
        cap_violations_total = sum(cap_values)

    return RunMetrics(
        mode=mode,
        seed=seed,
        placed_entries=int(summary.get("total_placed_entries", 0)),
        refund_entries=int(summary.get("total_refunds", 0)),
        max_refunds_single_player=max_refund,
        refund_variance=refund_variance,
        unique_pairs=extract_unique_pairs(result),
        total_brackets=int(summary.get("total_brackets", 0)),
        duration_ms=duration_ms,
        valid_structure=bool(validation.get("is_valid", False)),
        cap_violations=cap_violations_total,
    )


def weighted_score(m: RunMetrics) -> float:
    return (
        1000.0 * m.placed_entries
        + 5.0 * m.unique_pairs
        - 50.0 * m.max_refunds_single_player
        - 20.0 * m.refund_variance
    )


def avg(values: List[float]) -> float:
    return float(sum(values) / len(values)) if values else 0.0


def summarize(trials: List[TrialResult]) -> AggregateSummary:
    std = [t.standard for t in trials]
    exp = [t.experimental for t in trials]

    return AggregateSummary(
        trials=len(trials),
        standard_avg_placed=avg([m.placed_entries for m in std]),
        experimental_avg_placed=avg([m.placed_entries for m in exp]),
        standard_avg_refunds=avg([m.refund_entries for m in std]),
        experimental_avg_refunds=avg([m.refund_entries for m in exp]),
        standard_avg_max_refund_player=avg([m.max_refunds_single_player for m in std]),
        experimental_avg_max_refund_player=avg([m.max_refunds_single_player for m in exp]),
        standard_avg_refund_variance=avg([m.refund_variance for m in std]),
        experimental_avg_refund_variance=avg([m.refund_variance for m in exp]),
        standard_avg_unique_pairs=avg([m.unique_pairs for m in std]),
        experimental_avg_unique_pairs=avg([m.unique_pairs for m in exp]),
        standard_avg_duration_ms=avg([m.duration_ms for m in std]),
        experimental_avg_duration_ms=avg([m.duration_ms for m in exp]),
        experimental_better_placement_trials=sum(1 for t in trials if t.experimental.placed_entries > t.standard.placed_entries),
        experimental_better_max_refund_trials=sum(1 for t in trials if t.experimental.max_refunds_single_player < t.standard.max_refunds_single_player),
        experimental_better_variance_trials=sum(1 for t in trials if t.experimental.refund_variance < t.standard.refund_variance),
        experimental_better_unique_pairs_trials=sum(1 for t in trials if t.experimental.unique_pairs > t.standard.unique_pairs),
        experimental_higher_weighted_score_trials=sum(1 for t in trials if weighted_score(t.experimental) > weighted_score(t.standard)),
    )


def print_summary(summary: AggregateSummary) -> None:
    print("\n=== Bracket Mode Benchmark Summary ===")
    print(f"Trials: {summary.trials}")
    print("")
    print("Metric                          Standard       Experimental")
    print("-----------------------------------------------------------")
    print(f"Avg placed entries            {summary.standard_avg_placed:10.2f}   {summary.experimental_avg_placed:12.2f}")
    print(f"Avg refunds                   {summary.standard_avg_refunds:10.2f}   {summary.experimental_avg_refunds:12.2f}")
    print(f"Avg max refund/player         {summary.standard_avg_max_refund_player:10.2f}   {summary.experimental_avg_max_refund_player:12.2f}")
    print(f"Avg refund variance           {summary.standard_avg_refund_variance:10.3f}   {summary.experimental_avg_refund_variance:12.3f}")
    print(f"Avg unique first-round pairs  {summary.standard_avg_unique_pairs:10.2f}   {summary.experimental_avg_unique_pairs:12.2f}")
    print(f"Avg runtime (ms)              {summary.standard_avg_duration_ms:10.2f}   {summary.experimental_avg_duration_ms:12.2f}")
    print("")
    print("Experimental wins by trial")
    print("--------------------------")
    print(f"Better placement:            {summary.experimental_better_placement_trials}/{summary.trials}")
    print(f"Better max refund fairness:  {summary.experimental_better_max_refund_trials}/{summary.trials}")
    print(f"Better refund variance:      {summary.experimental_better_variance_trials}/{summary.trials}")
    print(f"Better unique pairs:         {summary.experimental_better_unique_pairs_trials}/{summary.trials}")
    print(f"Higher weighted score:       {summary.experimental_higher_weighted_score_trials}/{summary.trials}")


def main() -> int:
    args = parse_args()

    db = SessionLocal()
    try:
        players_data, bracket_size, bracket_programs, tournament_name = build_players_data(
            db,
            tournament_id=args.tournament_id,
            squad_id=args.squad_id,
        )

        print(f"Benchmarking tournament {args.tournament_id} ({tournament_name})")
        print(f"Squad: {args.squad_id if args.squad_id is not None else 'ALL'}")
        print(f"Players: {len(players_data)} | Bracket size: {bracket_size} | Trials: {args.trials}")

        trials: List[TrialResult] = []
        use_history = not args.no_history

        for i in range(max(1, args.trials)):
            seed = int(args.base_seed + (i * args.seed_step))

            t0 = time.perf_counter()
            standard_result = generate_tournament_brackets(
                players=players_data,
                bracket_size=bracket_size,
                db=db,
                tournament_id=args.tournament_id,
                bracket_programs=bracket_programs,
                use_history=use_history,
                seed=seed,
                use_experimental_optimizer=False,
            )
            std_ms = (time.perf_counter() - t0) * 1000.0

            t1 = time.perf_counter()
            experimental_result = generate_tournament_brackets(
                players=players_data,
                bracket_size=bracket_size,
                db=db,
                tournament_id=args.tournament_id,
                bracket_programs=bracket_programs,
                use_history=use_history,
                seed=seed,
                use_experimental_optimizer=True,
                experimental_attempts=args.experimental_attempts,
            )
            exp_ms = (time.perf_counter() - t1) * 1000.0

            trials.append(
                TrialResult(
                    seed=seed,
                    standard=collect_metrics("standard", seed, standard_result, std_ms),
                    experimental=collect_metrics("experimental", seed, experimental_result, exp_ms),
                )
            )

        summary = summarize(trials)
        print_summary(summary)

        if args.json_out:
            payload = {
                "config": {
                    "tournament_id": args.tournament_id,
                    "squad_id": args.squad_id,
                    "trials": args.trials,
                    "base_seed": args.base_seed,
                    "seed_step": args.seed_step,
                    "experimental_attempts": args.experimental_attempts,
                    "use_history": use_history,
                },
                "summary": asdict(summary),
                "trials": [
                    {
                        "seed": t.seed,
                        "standard": asdict(t.standard),
                        "experimental": asdict(t.experimental),
                    }
                    for t in trials
                ],
            }
            print("\n=== JSON ===")
            print(json.dumps(payload, indent=2))

        return 0
    except Exception as exc:
        print(f"Benchmark failed: {exc}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
