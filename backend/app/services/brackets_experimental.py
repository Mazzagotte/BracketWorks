"""
Experimental bracket optimizer.

Purpose:
- Keep production logic untouched.
- Try multi-seed runs and pick the best candidate by explicit scoring.

Implements ideas:
1) Objective ordering: maximize placed entries first.
3) Randomized multi-start search over many seeds.
4) Fairness-aware scoring to reduce refund concentration.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from math import ceil
import random
from statistics import pvariance
from typing import Any, Dict, List, Optional, Set, Tuple

from .brackets_advanced import create_brackets_with_history


@dataclass
class ExperimentalConfig:
    """Tuning knobs for experimental multi-start selection."""

    attempts: int = 64
    seed_step: int = 7919

    # Scoring weights (higher is better total score).
    w_placed: float = 1000.0
    w_unique_pairs: float = 5.0
    w_refund_max: float = -50.0
    w_refund_variance: float = -20.0

    # Fairness cap controls (idea #2):
    # cap(player) = ceil(player_entries * global_refund_rate) + cap_buffer
    cap_buffer: int = 1


@dataclass
class CandidateScore:
    """Scoring breakdown for a single candidate layout."""

    placed_entries: int
    refunded_entries: int
    unique_pairs: int
    max_refunds_single_player: int
    refund_variance: float
    cap_violations: int
    feasible_under_cap: bool
    score: float


@dataclass
class ExperimentalResult:
    """Selected best candidate and debugging details."""

    brackets: List[Dict[str, Any]]
    leftovers: List[Dict[str, Any]]
    selected_seed: int
    selected: CandidateScore
    attempts_evaluated: int


def _extract_first_round_pairs(brackets: List[Dict[str, Any]]) -> Set[Tuple[int, int]]:
    pairs: Set[Tuple[int, int]] = set()
    for bracket in brackets:
        rounds = bracket.get("rounds") or []
        if not rounds:
            continue
        matches = rounds[0].get("matches") or []
        for match in matches:
            a = match.get("playerA_id")
            b = match.get("playerB_id")
            if a is None or b is None:
                continue
            if a == b:
                continue
            pairs.add((min(a, b), max(a, b)))
    return pairs


def _refund_distribution(leftovers: List[Dict[str, Any]]) -> Counter:
    counts: Counter = Counter()
    for entry in leftovers:
        player_id = entry.get("player_id")
        if player_id is not None:
            counts[player_id] += 1
    return counts


def _cap_violations(
    entry_counts_by_player: Dict[int, int],
    refund_counts: Counter,
    refunded_entries: int,
    total_entries: int,
    cap_buffer: int,
) -> int:
    """Return how many players exceed their dynamic fairness refund cap."""
    if total_entries <= 0:
        return 0

    global_refund_rate = refunded_entries / total_entries
    violations = 0

    for player_id, refund_count in refund_counts.items():
        player_entries = entry_counts_by_player.get(player_id, 0)
        cap = ceil(player_entries * global_refund_rate) + cap_buffer
        if refund_count > cap:
            violations += 1

    return violations


def _score_candidate(
    total_entries: int,
    entry_counts_by_player: Dict[int, int],
    brackets: List[Dict[str, Any]],
    leftovers: List[Dict[str, Any]],
    config: ExperimentalConfig,
) -> CandidateScore:
    refunded = len(leftovers)
    placed = total_entries - refunded

    unique_pairs = len(_extract_first_round_pairs(brackets))

    refund_counts = list(_refund_distribution(leftovers).values())
    refund_counter = _refund_distribution(leftovers)
    max_refund = max(refund_counts) if refund_counts else 0
    variance = pvariance(refund_counts) if len(refund_counts) > 1 else 0.0

    violations = _cap_violations(
        entry_counts_by_player=entry_counts_by_player,
        refund_counts=refund_counter,
        refunded_entries=refunded,
        total_entries=total_entries,
        cap_buffer=config.cap_buffer,
    )
    feasible_under_cap = violations == 0

    score = (
        config.w_placed * placed
        + config.w_unique_pairs * unique_pairs
        + config.w_refund_max * max_refund
        + config.w_refund_variance * variance
    )

    return CandidateScore(
        placed_entries=placed,
        refunded_entries=refunded,
        unique_pairs=unique_pairs,
        max_refunds_single_player=max_refund,
        refund_variance=variance,
        cap_violations=violations,
        feasible_under_cap=feasible_under_cap,
        score=score,
    )


def generate_brackets_experimental(
    entries: List[Dict[str, Any]],
    bracket_size: int,
    bracket_type: str,
    history_set: Optional[Set[Tuple[int, int]]] = None,
    seed: Optional[int] = None,
    allow_single_bye_per_bracket: bool = False,
    config: Optional[ExperimentalConfig] = None,
) -> ExperimentalResult:
    """
    Run many randomized seeds, score each candidate, return the best.

    This function is intentionally isolated from production orchestration.
    Use it for A/B comparisons before any migration into live generation.
    """
    if config is None:
        config = ExperimentalConfig()

    if history_set is None:
        history_set = set()

    # Salt by bracket type so Scratch/Handicap do not share identical seed paths,
    # then randomize base seed when no explicit seed is provided.
    bracket_seed_offset = sum(ord(ch) for ch in str(bracket_type or ""))
    if seed is None:
        base_seed = random.SystemRandom().randint(1, 2_147_483_647) + bracket_seed_offset
    else:
        base_seed = int(seed) + bracket_seed_offset
    total_entries = len(entries)
    entries_by_player: Counter = Counter()
    for entry in entries:
        player_id = entry.get("player_id")
        if player_id is not None:
            entries_by_player[player_id] += 1

    best_brackets: List[Dict[str, Any]] = []
    best_leftovers: List[Dict[str, Any]] = list(entries)
    best_seed = base_seed
    best_score: Optional[CandidateScore] = None

    # Track the best placement tier first (objective #1).
    best_placed_entries = -1
    best_feasible_in_tier: Optional[Tuple[int, CandidateScore, List[Dict[str, Any]], List[Dict[str, Any]]]] = None
    best_any_in_tier: Optional[Tuple[int, CandidateScore, List[Dict[str, Any]], List[Dict[str, Any]]]] = None

    for i in range(max(1, config.attempts)):
        candidate_seed = base_seed + (i * config.seed_step)

        brackets, leftovers = create_brackets_with_history(
            entries=entries,
            bracket_size=bracket_size,
            bracket_type=bracket_type,
            history_set=history_set,
            seed=candidate_seed,
            allow_single_bye_per_bracket=allow_single_bye_per_bracket,
        )

        candidate_score = _score_candidate(
            total_entries=total_entries,
            entry_counts_by_player=dict(entries_by_player),
            brackets=brackets,
            leftovers=leftovers,
            config=config,
        )

        if candidate_score.placed_entries > best_placed_entries:
            best_placed_entries = candidate_score.placed_entries
            best_feasible_in_tier = None
            best_any_in_tier = None

        if candidate_score.placed_entries == best_placed_entries:
            # Keep best by weighted score regardless of cap feasibility.
            if best_any_in_tier is None or candidate_score.score > best_any_in_tier[1].score:
                best_any_in_tier = (candidate_seed, candidate_score, brackets, leftovers)

            # Keep best feasible (cap-safe) candidate in the same placement tier.
            if candidate_score.feasible_under_cap:
                if best_feasible_in_tier is None or candidate_score.score > best_feasible_in_tier[1].score:
                    best_feasible_in_tier = (candidate_seed, candidate_score, brackets, leftovers)

    # Hard cap policy (#2): pick cap-feasible in best placement tier when possible.
    chosen = best_feasible_in_tier if best_feasible_in_tier is not None else best_any_in_tier
    assert chosen is not None

    best_seed, best_score, best_brackets, best_leftovers = chosen

    return ExperimentalResult(
        brackets=best_brackets,
        leftovers=best_leftovers,
        selected_seed=best_seed,
        selected=best_score,
        attempts_evaluated=max(1, config.attempts),
    )
