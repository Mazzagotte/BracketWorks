from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core import models
from .side_pots import calculate_side_pot_accounting


def _bracket_count(payload: dict | None) -> int:
    if not isinstance(payload, dict):
        return 0
    groups = payload.get("bracket_groups")
    if isinstance(groups, list):
        return sum(len(group.get("brackets") or []) for group in groups if isinstance(group, dict))
    return sum(len(payload.get(key) or []) for key in ("scratch_brackets", "handicap_brackets"))


def build_final_reconciliation(db: Session, tournament_id: int) -> dict:
    tournament = db.get(models.Tournament, tournament_id)
    players = db.query(models.TournamentPlayer).filter(models.TournamentPlayer.tournament_id == tournament_id).all()
    entry_count = len(players)
    missing_averages = sum(1 for player in players if not player.average or player.average <= 0)
    unpaid_entries = sum(1 for player in players if float(player.amount_paid or 0) <= 0)
    resolved_pairs = {
        tuple(sorted((row.left_player_id, row.right_player_id)))
        for row in db.query(models.DuplicatePlayerResolution).filter_by(tournament_id=tournament_id).all()
    }
    duplicate_players = 0
    for index, left in enumerate(players):
        for right in players[index + 1:]:
            if tuple(sorted((left.id, right.id))) in resolved_pairs:
                continue
            same_name = " ".join(left.full_name.lower().split()) == " ".join(right.full_name.lower().split())
            same_usbc = bool(left.usbc_number and right.usbc_number and str(left.usbc_number).strip().lower() == str(right.usbc_number).strip().lower())
            if same_name or same_usbc:
                duplicate_players += 1

    snapshots = db.query(models.BracketSnapshot).filter(
        models.BracketSnapshot.tournament_id == tournament_id,
        models.BracketSnapshot.is_current.is_(True),
    ).all()
    bracket_count = sum(_bracket_count(snapshot.payload) for snapshot in snapshots)
    bracket_mismatch = any(snapshot.player_count is not None and snapshot.player_count != entry_count for snapshot in snapshots)

    complete_scores = db.query(func.count(models.PlayerScore.id)).filter(
        models.PlayerScore.tournament_id == tournament_id,
        models.PlayerScore.game1_scratch.isnot(None),
        models.PlayerScore.game2_scratch.isnot(None),
        models.PlayerScore.game3_scratch.isnot(None),
    ).scalar() or 0
    side_pots = calculate_side_pot_accounting(db, tournament_id)
    side_pot_warnings = [row["name"] for row in side_pots["summaries"] if row["status"] in {"pending", "tied"}]
    summaries = db.query(models.TournamentPayoutSummary).filter(
        models.TournamentPayoutSummary.tournament_id == tournament_id
    ).all()
    collected = round(sum(float(player.amount_paid or 0) for player in players), 2)
    bracket_payouts = round(sum(float(summary.total_prize_pool or 0) for summary in summaries), 2)
    house_retained = round(sum(float(summary.house_fee_amount or 0) for summary in summaries), 2)
    side_pot_payouts = round(float(side_pots.get("total_pool") or 0), 2)
    expected_payout = round(bracket_payouts + side_pot_payouts, 2)
    difference = round(collected - expected_payout - house_retained, 2)

    warnings: list[str] = []
    if entry_count == 0: warnings.append("No tournament entries")
    if missing_averages: warnings.append(f"{missing_averages} missing averages")
    if unpaid_entries: warnings.append(f"{unpaid_entries} unpaid entries")
    if duplicate_players: warnings.append(f"{duplicate_players} possible duplicate players")
    if bracket_count == 0: warnings.append("Brackets have not been generated")
    if bracket_mismatch: warnings.append("Entries no longer match generated brackets")
    if complete_scores < entry_count: warnings.append(f"{entry_count - complete_scores} incomplete score records")
    if not summaries: warnings.append("Payouts have not been calculated")
    if side_pot_warnings: warnings.append("Unresolved side pots: " + ", ".join(side_pot_warnings))
    if abs(difference) > 0.009: warnings.append(f"Payout reconciliation difference is ${difference:,.2f}")
    if not tournament.is_public: warnings.append("Public results are not enabled")

    return {
        "tournament_id": tournament_id,
        "entries": {"count": entry_count, "missing_averages": missing_averages, "unpaid": unpaid_entries, "duplicates": duplicate_players},
        "brackets": {"count": bracket_count, "generated": bracket_count > 0, "entries_match": not bracket_mismatch},
        "scores": {"complete": complete_scores, "total": entry_count, "all_complete": entry_count > 0 and complete_scores >= entry_count, "locked": tournament.scores_locked},
        "side_pots": {"total_pool": side_pot_payouts, "unresolved": side_pot_warnings},
        "payouts": {"calculated": bool(summaries), "collected": collected, "bracket_payouts": bracket_payouts, "side_pot_payouts": side_pot_payouts, "expected_payout": expected_payout, "house_retained": house_retained, "difference": difference},
        "public_results_ready": bool(tournament.is_public and complete_scores >= entry_count and entry_count > 0),
        "warnings": warnings,
        "ready_to_finalize": len(warnings) == 0,
    }
