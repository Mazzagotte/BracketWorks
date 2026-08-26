"""
Payout management API endpoints for tournament winner tracking and prize distribution.
"""

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
import logging
from datetime import UTC, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from ..deps import SessionLocal, get_db, get_current_user
from ...services.tournament_audit import record_tournament_event
from ...services.tournament_lifecycle import advance_status
from ...core import models
from ...core.money import CENT, money_decimal, money_float
from ...core.async_jobs import job_store, to_dict
from ...core.idempotency import IdempotencyReplay, begin_request, complete_request, fail_request
from ...core.schemas import UserOut
from ...services.payouts import (
    calculate_tournament_payouts,
    get_tournament_winners_summary,
    validate_payout_integrity,
    extract_bracket_winners,
    count_bracket_entries,
    calculate_bracket_prize_pool,
    DEFAULT_ENTRY_FEES,
    DEFAULT_PRESETS,
)
from ...services.bracket_persistence_simple import load_generated_brackets
from ...services.side_pots import calculate_side_pot_accounting
from ...services.tournament_access import verify_owned_tournament_access
from ...core.bracket_programs import normalize_bracket_programs
from ...services.tournament_snapshots import create_restore_point

router = APIRouter()
logger = logging.getLogger(__name__)


class PayoutAdjustmentRequest(BaseModel):
    new_amount: Decimal = Field(ge=0, le=1_000_000, max_digits=12, decimal_places=2)
    reason: str = Field(min_length=1, max_length=1000)


class PayoutReopenRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=1000)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_entry_fees(
    db: Session,
    tournament_id: int,
    scratch_fee: Optional[float],
    handicap_fee: Optional[float],
) -> Dict[str, float]:
    """Resolve entry fees: explicit params > tournament BracketSettings > global defaults."""
    bracket_settings = db.query(models.BracketSettings).filter(
        models.BracketSettings.tournament_id == tournament_id
    ).first()

    fallback_entry_fee = None
    if bracket_settings and bracket_settings.cost_per_bracket is not None:
        fallback_entry_fee = float(bracket_settings.cost_per_bracket)

    resolved_fees: Dict[str, float] = {
        "scratch": scratch_fee if scratch_fee is not None else DEFAULT_ENTRY_FEES["scratch"],
        "handicap": handicap_fee if handicap_fee is not None else DEFAULT_ENTRY_FEES["handicap"],
    }

    if fallback_entry_fee is not None:
        resolved_fees["scratch"] = scratch_fee if scratch_fee is not None else fallback_entry_fee
        resolved_fees["handicap"] = handicap_fee if handicap_fee is not None else fallback_entry_fee

    if bracket_settings:
        programs = normalize_bracket_programs(bracket_settings.bracket_programs, fallback_entry_fee)
        for program in programs:
            key = str(program.get("key") or "").strip().lower()
            if not key:
                continue
            entry_fee = program.get("entry_fee")
            if entry_fee is not None:
                resolved_fees[key] = float(entry_fee)

    return resolved_fees


# ---------------------------------------------------------------------------
# Calculate
# ---------------------------------------------------------------------------

@router.get("/calculate/{tournament_id}")
def calculate_tournament_payouts_endpoint(
    tournament_id: int,
    squad_id:         Optional[int]   = None,
    scratch_fee:      Optional[float] = Query(None),
    handicap_fee:     Optional[float] = Query(None),
    house_percentage: float           = Query(0.0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Calculate live payouts for all brackets in a tournament."""
    if house_percentage < 0 or house_percentage > 100:
        raise HTTPException(status_code=400, detail="House percentage must be between 0 and 100")

    try:
        tournament = verify_owned_tournament_access(
            db,
            tournament_id,
            current_user,
            permission="view",
            forbidden_detail="Access denied",
        )
        entry_fees  = _get_entry_fees(db, tournament_id, scratch_fee, handicap_fee)

        brackets_data = load_generated_brackets(db, tournament_id, squad_id)
        if not brackets_data:
            raise HTTPException(status_code=404, detail="No brackets found for this tournament")

        payout_data = calculate_tournament_payouts(brackets_data, entry_fees, house_percentage)
        payout_data["side_pots"] = calculate_side_pot_accounting(db, tournament_id, squad_id)

        payout_data["tournament_info"] = {
            "id":               tournament_id,
            "name":             tournament.name,
            "squad_id":         squad_id,
            "entry_fees":       entry_fees,
            "house_percentage": house_percentage,
        }
        payout_data["validation"] = validate_payout_integrity(payout_data)

        logger.info(
            f"Calculated payouts for tournament {tournament_id}: "
            f"total_pool={payout_data.get('total_prize_pool')}"
        )
        return payout_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error calculating tournament payouts: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to calculate payouts")


# ---------------------------------------------------------------------------
# Winners summary
# ---------------------------------------------------------------------------

@router.get("/winners/{tournament_id}")
def get_tournament_winners_endpoint(
    tournament_id: int,
    squad_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: UserOut = Depends(get_current_user),
):
    """Get summary of all winners for a tournament."""
    try:
        tournament = verify_owned_tournament_access(
            db,
            tournament_id,
            current_user,
            permission="view",
            forbidden_detail="Access denied",
        )
        brackets_data = load_generated_brackets(db, tournament_id, squad_id)
        if not brackets_data:
            raise HTTPException(status_code=404, detail="No brackets found for this tournament")

        winners_summary = get_tournament_winners_summary(brackets_data)
        winners_summary["tournament_info"] = {
            "id": tournament_id, "name": tournament.name, "squad_id": squad_id
        }
        return winners_summary

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting tournament winners: {e}")
        raise HTTPException(status_code=500, detail="Unable to load payout winners")


# ---------------------------------------------------------------------------
# Live entries  (no saved PayoutSummary required)
# ---------------------------------------------------------------------------

@router.get("/live-entries/{tournament_id}")
def get_live_entry_analysis(
    tournament_id: int,
    squad_id:         Optional[int]   = None,
    scratch_fee:      Optional[float] = Query(None),
    handicap_fee:     Optional[float] = Query(None),
    house_percentage: float           = Query(0.0),
    db: Session = Depends(get_db),
    current_user: UserOut = Depends(get_current_user),
):
    """
    Live entry analysis derived directly from bracket data.
    Shows every player's entries and winnings without needing a saved PayoutSummary.
    """
    try:
        tournament = verify_owned_tournament_access(
            db,
            tournament_id,
            current_user,
            permission="view",
            forbidden_detail="Access denied",
        )
        entry_fees = _get_entry_fees(db, tournament_id, scratch_fee, handicap_fee)

        bowlers_query = db.query(models.Bowler).filter(
            models.Bowler.tournament_id == tournament_id
        )
        if squad_id:
            bowlers_query = bowlers_query.filter(models.Bowler.squad_id == squad_id)
        bowlers = bowlers_query.all()

        entries: Dict[int, Dict[str, Any]] = {}
        for b in bowlers:
            entries[b.id] = {
                "id":   b.id,
                "name": b.name,
                "scratch_brackets_entered":  0,
                "handicap_brackets_entered": 0,
                "total_brackets_entered":    0,
                "scratch_brackets_won":      0,
                "handicap_brackets_won":     0,
                "total_brackets_won":        0,
                "total_amount_won":          0.0,
                "scratch_amount_won":        0.0,
                "handicap_amount_won":       0.0,
                "placement_details":         [],
            }

        brackets_data = load_generated_brackets(db, tournament_id, squad_id)
        if not brackets_data:
            return {
                "tournament_info": {"id": tournament_id, "name": tournament.name, "squad_id": squad_id},
                "entries": [],
                "summary": {
                    "total_players": 0,
                    "total_scratch_entries": 0,
                    "total_handicap_entries": 0,
                    "total_amount_distributed": 0.0,
                    "average_per_player": 0.0,
                },
            }

        def _scan_bracket(bracket: Dict, bracket_name: str, bracket_type: str):
            if not bracket.get('rounds'):
                return

            # Count entries from round 1
            for match in bracket['rounds'][0].get('matches', []):
                for name_key, id_key in [('playerA', 'playerA_id'), ('playerB', 'playerB_id')]:
                    pname = match.get(name_key, '')
                    pid   = match.get(id_key)
                    if pname and pname != 'BYE' and pid and pid in entries:
                        if bracket_type == 'scratch':
                            entries[pid]['scratch_brackets_entered'] += 1
                        else:
                            entries[pid]['handicap_brackets_entered'] += 1

            # Winnings from completed bracket
            winners_info = extract_bracket_winners(bracket)
            if winners_info.get('status') != 'completed':
                return

            bracket_size       = bracket.get('size', 8)
            actual_entries_cnt = count_bracket_entries(bracket)
            prize_pool         = calculate_bracket_prize_pool(
                {'bracket_type': bracket_type, 'size': bracket_size},
                entry_fees, house_percentage, actual_entries_cnt,
            )
            pct_map = DEFAULT_PRESETS.get(bracket_size, DEFAULT_PRESETS[8])

            # Detect split-pot: two place=1 winners with split_pot=True
            split_pot_winners = [w for w in winners_info.get('winners', [])
                                  if w.get('place') == 1 and w.get('split_pot')]
            is_split = len(split_pot_winners) == 2

            for winner in winners_info.get('winners', []):
                pid      = winner.get('player_id')
                position = winner.get('position', '')

                if not pid or pid not in entries:
                    continue

                if is_split and winner.get('split_pot'):
                    pct        = 50
                    payout_amt = float((Decimal(str(prize_pool)) * Decimal('50') / Decimal('100')).quantize(CENT, rounding=ROUND_HALF_UP))
                else:
                    pct = pct_map.get(position.lower(), 0)
                    if pct == 0:
                        continue
                    payout_amt = float((Decimal(str(prize_pool)) * Decimal(str(pct)) / Decimal('100')).quantize(CENT, rounding=ROUND_HALF_UP))

                place = winner.get('place', 0)
                if bracket_type == 'scratch':
                    entries[pid]['scratch_brackets_won'] += 1
                    entries[pid]['scratch_amount_won']   += payout_amt
                else:
                    entries[pid]['handicap_brackets_won'] += 1
                    entries[pid]['handicap_amount_won']   += payout_amt

                suffix = {1: 'st', 2: 'nd', 3: 'rd'}.get(place, 'th')
                entries[pid]['placement_details'].append({
                    "bracket_name":   bracket_name,
                    "bracket_type":   bracket_type,
                    "placement":      place,
                    "placement_text": f"{place}{suffix}",
                    "amount_won":     payout_amt,
                })

        for i, b in enumerate(brackets_data.get('scratch_brackets', [])):
            _scan_bracket(b, f"Scratch Bracket {i+1}", 'scratch')
        for i, b in enumerate(brackets_data.get('handicap_brackets', [])):
            _scan_bracket(b, f"Handicap Bracket {i+1}", 'handicap')

        entries_list = []
        for entry in entries.values():
            entry['total_brackets_entered'] = (
                entry['scratch_brackets_entered'] + entry['handicap_brackets_entered']
            )
            entry['total_brackets_won'] = (
                entry['scratch_brackets_won'] + entry['handicap_brackets_won']
            )
            entry['total_amount_won'] = round(
                entry['scratch_amount_won'] + entry['handicap_amount_won'], 2
            )
            entries_list.append(entry)

        entries_list.sort(key=lambda x: x['total_amount_won'], reverse=True)

        total_distributed = sum(e['total_amount_won'] for e in entries_list)
        summary = {
            "total_players":            len(entries_list),
            "total_scratch_entries":    sum(e['scratch_brackets_entered'] for e in entries_list),
            "total_handicap_entries":   sum(e['handicap_brackets_entered'] for e in entries_list),
            "total_amount_distributed": round(total_distributed, 2),
            "average_per_player":       round(total_distributed / len(entries_list), 2) if entries_list else 0.0,
        }

        return {
            "tournament_info": {"id": tournament_id, "name": tournament.name, "squad_id": squad_id},
            "entries": entries_list,
            "summary": summary,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in live entry analysis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Unable to analyze payout entries")


# ---------------------------------------------------------------------------
# Save payouts
# ---------------------------------------------------------------------------

@router.post("/save/{tournament_id}")
def save_tournament_payouts_endpoint(
    tournament_id: int,
    squad_id:         Optional[int]   = None,
    scratch_fee:      Optional[float] = Query(None),
    handicap_fee:     Optional[float] = Query(None),
    house_percentage: float           = Query(0.0),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Save calculated payouts and winners to database for record keeping."""
    if house_percentage < 0 or house_percentage > 100:
        raise HTTPException(status_code=400, detail="House percentage must be between 0 and 100")

    try:
        idempotency_record = None
        if idempotency_key:
            replay_or_record = begin_request(
                db,
                endpoint_scope="payouts:save",
                idempotency_key=idempotency_key,
                request_payload={
                    "tournament_id": tournament_id,
                    "squad_id": squad_id,
                    "scratch_fee": scratch_fee,
                    "handicap_fee": handicap_fee,
                    "house_percentage": house_percentage,
                },
                user_id=current_user.id,
            )
            if isinstance(replay_or_record, IdempotencyReplay):
                return JSONResponse(status_code=replay_or_record.status_code, content=replay_or_record.response_body)
            idempotency_record = replay_or_record

        tournament = verify_owned_tournament_access(
            db,
            tournament_id,
            current_user,
            permission="manage_payouts",
            forbidden_detail="Access denied",
        )
        entry_fees  = _get_entry_fees(db, tournament_id, scratch_fee, handicap_fee)

        brackets_data = load_generated_brackets(db, tournament_id, squad_id)
        if not brackets_data:
            raise HTTPException(status_code=404, detail="No brackets found for this tournament")

        payout_data = calculate_tournament_payouts(brackets_data, entry_fees, house_percentage)

        existing_summary = db.query(models.TournamentPayoutSummary).filter(
            models.TournamentPayoutSummary.tournament_id == tournament_id,
            models.TournamentPayoutSummary.squad_id == squad_id,
        ).first()

        if existing_summary and existing_summary.is_finalized:
            raise HTTPException(status_code=400, detail="Payouts already finalized for this tournament")

        current_time = datetime.now(UTC).isoformat()
        total_winners = len(payout_data.get("winners_by_bracket", []))

        try:
            if existing_summary:
                payout_summary = existing_summary
                payout_summary.updated_at = current_time
            else:
                payout_summary = models.TournamentPayoutSummary(
                    tournament_id=tournament_id,
                    squad_id=squad_id,
                    created_at=current_time,
                    updated_at=current_time,
                )

            payout_summary.total_prize_pool        = payout_data.get("total_prize_pool", 0)
            payout_summary.total_scratch_pool      = payout_data.get("total_scratch_pool", 0)
            payout_summary.total_handicap_pool     = payout_data.get("total_handicap_pool", 0)
            payout_summary.scratch_brackets_count  = len(payout_data.get("scratch_brackets", []))
            payout_summary.handicap_brackets_count = len(payout_data.get("handicap_brackets", []))
            payout_summary.scratch_entry_fee       = entry_fees["scratch"]
            payout_summary.handicap_entry_fee      = entry_fees["handicap"]
            payout_summary.house_percentage        = house_percentage
            total_collected                        = payout_data.get("total_collected", 0)
            payout_summary.house_amount            = total_collected * (house_percentage / 100)
            payout_summary.total_winners           = total_winners
            payout_summary.calculated_at            = datetime.now(timezone.utc)
            payout_summary.calculated_by_user_id    = current_user.id

            if not existing_summary:
                db.add(payout_summary)

            db.flush()

            _save_winners_and_payouts(
                db, tournament_id, squad_id, payout_summary.id, payout_data, current_time
            )

            record_tournament_event(
                db,
                tournament_id=tournament_id,
                event_type="payouts.calculated",
                user=current_user,
                summary="Calculated and saved tournament payouts",
                after_values={
                    "total_prize_pool": payout_summary.total_prize_pool,
                    "house_amount": payout_summary.house_amount,
                    "total_winners": total_winners,
                    "squad_id": squad_id,
                },
                entity_type="payout_summary",
                entity_id=payout_summary.id,
            )
            advance_status(db, tournament_id, "payout_review")

            db.commit()

            logger.info(
                f"Saved payouts for tournament {tournament_id}: "
                f"total_pool={payout_summary.total_prize_pool}, winners={total_winners}"
            )

            response_body = {
                "status":  "success",
                "message": "Payouts saved successfully",
                "summary": {
                    "total_prize_pool": payout_summary.total_prize_pool,
                    "house_take":       payout_summary.house_amount,
                    "total_winners":    total_winners,
                }
            }

            if idempotency_record:
                complete_request(db, idempotency_record, status_code=200, response_body=response_body)
                db.commit()

            return response_body

        except Exception as save_error:
            db.rollback()
            logger.error(f"Error during payout save transaction: {save_error}", exc_info=True)
            if idempotency_record:
                fail_request(db, idempotency_record)
                db.commit()
            raise HTTPException(status_code=500, detail="Failed to save payouts - transaction rolled back")

    except HTTPException:
        if 'idempotency_record' in locals() and idempotency_record is not None:
            fail_request(db, idempotency_record)
            db.commit()
        raise
    except Exception as e:
        logger.error(f"Error saving tournament payouts: {e}", exc_info=True)
        if 'idempotency_record' in locals() and idempotency_record is not None:
            fail_request(db, idempotency_record)
            db.commit()
        raise HTTPException(status_code=500, detail="Failed to save payouts")


@router.post("/save/{tournament_id}/async")
def save_tournament_payouts_async(
    tournament_id: int,
    background_tasks: BackgroundTasks,
    squad_id: Optional[int] = None,
    scratch_fee: Optional[float] = Query(None),
    handicap_fee: Optional[float] = Query(None),
    house_percentage: float = Query(0.0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Queue payout save and return a job handle for polling."""
    verify_owned_tournament_access(
        db,
        tournament_id,
        current_user,
        permission="manage_payouts",
        forbidden_detail="Access denied",
    )
    job = job_store.create(
        "payouts.save",
        owner_user_id=current_user.id,
        tournament_id=tournament_id,
    )
    actor_user_id = current_user.id

    def _run_job() -> dict:
        db = SessionLocal()
        try:
            actor_user = db.query(models.User).filter(models.User.id == actor_user_id).first()
            if not actor_user:
                raise RuntimeError("Job owner no longer exists")
            return save_tournament_payouts_endpoint(
                tournament_id=tournament_id,
                squad_id=squad_id,
                scratch_fee=scratch_fee,
                handicap_fee=handicap_fee,
                house_percentage=house_percentage,
                idempotency_key=None,
                db=db,
                current_user=actor_user,
            )
        finally:
            db.close()

    background_tasks.add_task(job_store.run, job.job_id, _run_job)
    return {"job_id": job.job_id, "status": job.status}


@router.get("/jobs/{job_id}")
def get_payout_job_status(
    job_id: str,
    current_user: models.User = Depends(get_current_user),
):
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.owner_user_id != current_user.id and not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=404, detail="Job not found")
    return to_dict(job)


# ---------------------------------------------------------------------------
# Payout history (from saved records)
# ---------------------------------------------------------------------------

@router.post("/{tournament_id}/reopen")
def reopen_finalized_payouts(tournament_id: int, payload: PayoutReopenRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    tournament = verify_owned_tournament_access(
        db, tournament_id, current_user, permission="manage_payouts", allow_read_only_mutation=True,
        forbidden_detail="Access denied",
    )
    summaries = db.query(models.TournamentPayoutSummary).filter(models.TournamentPayoutSummary.tournament_id == tournament_id).all()
    if not tournament.finalized_at and not any(summary.is_finalized for summary in summaries):
        return {"status": "open", "results_may_be_affected": False}
    create_restore_point(db, tournament_id=tournament_id, user=current_user, trigger="payouts.reopen", summary="Before finalized payouts were reopened")
    for summary in summaries:
        summary.is_finalized = False
        summary.finalized_date = None
        summary.finalized_by_user_id = None
    tournament.lifecycle_status = "payout_review"
    tournament.finalized_at = None
    tournament.finalized_by_user_id = None
    tournament.scores_locked = True
    db.add(models.PayoutAdjustment(
        tournament_id=tournament_id, payout_id=None, adjustment_type="reopen",
        old_amount=None, new_amount=None, reason=payload.reason.strip(), adjusted_by_user_id=current_user.id,
    ))
    record_tournament_event(
        db, tournament_id=tournament_id, event_type="payouts.reopened", user=current_user,
        summary="Reopened finalized payouts for adjustment", reason=payload.reason.strip(),
        before_values={"status": "finalized"}, after_values={"status": "payout_review", "scores_locked": True},
        entity_type="tournament", entity_id=tournament_id,
    )
    db.commit()
    return {"status": "payout_review", "results_may_be_affected": bool(tournament.is_public)}


@router.patch("/{tournament_id}/items/{payout_id}")
def adjust_payout(tournament_id: int, payout_id: int, payload: PayoutAdjustmentRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    verify_owned_tournament_access(db, tournament_id, current_user, permission="manage_payouts", forbidden_detail="Access denied")
    payout = db.query(models.BracketPayout).filter_by(id=payout_id, tournament_id=tournament_id).first()
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")
    summary = db.query(models.TournamentPayoutSummary).filter_by(tournament_id=tournament_id, squad_id=payout.squad_id).first()
    if summary and summary.is_finalized:
        raise HTTPException(status_code=409, detail="Reopen finalized payouts before making an adjustment")
    old_amount = money_decimal(payout.payout_amount)
    new_amount = money_decimal(payload.new_amount)
    if old_amount == new_amount:
        return {"id": payout.id, "payout_amount": old_amount, "adjusted": False}
    delta = new_amount - old_amount
    payout.payout_amount = float(new_amount)
    payout.updated_at = datetime.now(timezone.utc).isoformat()
    if summary:
        summary.total_prize_pool = money_float(Decimal(str(summary.total_prize_pool)) + delta)
        if payout.bracket_group_key == "scratch":
            summary.total_scratch_pool = money_float(Decimal(str(summary.total_scratch_pool)) + delta)
        elif payout.bracket_group_key == "handicap":
            summary.total_handicap_pool = money_float(Decimal(str(summary.total_handicap_pool)) + delta)
        summary.updated_at = payout.updated_at
    db.add(models.PayoutAdjustment(
        tournament_id=tournament_id, payout_id=payout.id, adjustment_type="manual",
        old_amount=old_amount, new_amount=new_amount, reason=payload.reason.strip(), adjusted_by_user_id=current_user.id,
    ))
    record_tournament_event(
        db, tournament_id=tournament_id, event_type="payouts.adjusted", user=current_user,
        summary=f"Adjusted payout for {payout.player_name} from ${old_amount:,.2f} to ${new_amount:,.2f}",
        reason=payload.reason.strip(), before_values={"payout_amount": float(old_amount)}, after_values={"payout_amount": float(new_amount)},
        entity_type="payout", entity_id=payout.id,
    )
    db.commit()
    return {"id": payout.id, "payout_amount": float(new_amount), "adjusted": True, "results_may_be_affected": True}

@router.get("/history/{tournament_id}")
def get_payout_history_endpoint(
    tournament_id: int,
    squad_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: UserOut = Depends(get_current_user),
):
    """Get saved payout history for a tournament."""
    try:
        tournament = verify_owned_tournament_access(
            db,
            tournament_id,
            current_user,
            permission="view",
            forbidden_detail="Access denied",
        )
        payout_summary = db.query(models.TournamentPayoutSummary).filter(
            models.TournamentPayoutSummary.tournament_id == tournament_id,
            models.TournamentPayoutSummary.squad_id == squad_id,
        ).first()

        if not payout_summary:
            raise HTTPException(status_code=404, detail="No payout history found")

        winners = db.query(models.BracketWinner).filter(
            models.BracketWinner.tournament_id == tournament_id,
            models.BracketWinner.squad_id == squad_id,
        ).order_by(models.BracketWinner.bracket_group_key, models.BracketWinner.placement).all()

        payouts = db.query(models.BracketPayout).filter(
            models.BracketPayout.tournament_id == tournament_id,
            models.BracketPayout.squad_id == squad_id,
        ).order_by(models.BracketPayout.bracket_group_key, models.BracketPayout.placement).all()
        adjustments = db.query(models.PayoutAdjustment, models.User).join(
            models.User, models.User.id == models.PayoutAdjustment.adjusted_by_user_id
        ).filter(models.PayoutAdjustment.tournament_id == tournament_id).order_by(models.PayoutAdjustment.created_at.desc()).all()

        return {
            "tournament_info": {"id": tournament_id, "name": tournament.name, "squad_id": squad_id},
            "summary": {
                "total_prize_pool":    payout_summary.total_prize_pool,
                "total_scratch_pool":  payout_summary.total_scratch_pool,
                "total_handicap_pool": payout_summary.total_handicap_pool,
                "total_paid_out":      payout_summary.total_paid_out,
                "total_unpaid":        payout_summary.total_unpaid,
                "house_amount":        payout_summary.house_amount,
                "is_finalized":        payout_summary.is_finalized,
                "created_at":          payout_summary.created_at,
                "calculated_at":       payout_summary.calculated_at,
                "calculated_by_user_id": payout_summary.calculated_by_user_id,
                "finalized_date":      payout_summary.finalized_date,
                "finalized_by_user_id": payout_summary.finalized_by_user_id,
            },
            "winners": [
                {
                    "id":             w.id,
                    "bracket_type":   w.bracket_type,
                    "bracket_name":   w.bracket_name,
                    "placement":      w.placement,
                    "placement_text": w.placement_text,
                    "player_name":    w.player_name,
                    "winning_score":  w.winning_score,
                    "bowler_id":      w.bowler_id,
                }
                for w in winners
            ],
            "payouts": [
                {
                    "id":                p.id,
                    "bracket_type":      p.bracket_type,
                    "bracket_name":      p.bracket_name,
                    "placement":         p.placement,
                    "player_name":       p.player_name,
                    "payout_amount":     p.payout_amount,
                    "payout_percentage": p.payout_percentage,
                    "is_paid":           p.is_paid,
                    "paid_date":         p.paid_date,
                    "payment_method":    p.payment_method,
                    "notes":             p.notes,
                }
                for p in payouts
            ],
            "adjustments": [{
                "id": adjustment.id, "payout_id": adjustment.payout_id,
                "adjustment_type": adjustment.adjustment_type, "old_amount": adjustment.old_amount,
                "new_amount": adjustment.new_amount, "reason": adjustment.reason,
                "adjusted_by": f"{actor.first_name} {actor.last_name}".strip() or actor.username,
                "adjusted_by_user_id": adjustment.adjusted_by_user_id, "created_at": adjustment.created_at,
            } for adjustment, actor in adjustments],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting payout history: {e}")
        raise HTTPException(status_code=500, detail="Unable to load payout history")


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------

def _save_winners_and_payouts(
    db:            Session,
    tournament_id: int,
    squad_id:      Optional[int],
    summary_id:    int,
    payout_data:   Dict[str, Any],
    current_time:  str,
):
    """
    Save winner and payout rows inside the caller's transaction.
    Does NOT commit — the calling endpoint owns the transaction.
    Raises on error so the caller can roll back.
    """
    db.query(models.BracketWinner).filter(
        models.BracketWinner.tournament_id == tournament_id,
        models.BracketWinner.squad_id == squad_id,
    ).delete()
    db.query(models.BracketPayout).filter(
        models.BracketPayout.tournament_id == tournament_id,
        models.BracketPayout.squad_id == squad_id,
    ).delete()

    all_bracket_data = payout_data["scratch_brackets"] + payout_data["handicap_brackets"]
    total_saved = 0

    snapshot_record = db.query(models.BracketSnapshot).filter(
        models.BracketSnapshot.tournament_id == tournament_id,
        models.BracketSnapshot.squad_id == squad_id if squad_id else models.BracketSnapshot.squad_id.is_(None),
        models.BracketSnapshot.is_current == True,
    ).order_by(models.BracketSnapshot.created_at.desc()).first()
    snapshot_id = snapshot_record.id if snapshot_record else None

    for bracket_data in all_bracket_data:
        bracket_name = bracket_data["bracket_name"]
        bracket_type = bracket_data["bracket_type"]
        bracket_size = bracket_data["bracket_size"]
        prize_pool   = float(bracket_data["prize_pool"])

        for winner_data in bracket_data["winners"]:
            total_saved += 1

            winner = models.BracketWinner(
                tournament_id=  tournament_id,
                squad_id=       squad_id,
                bracket_snapshot_id=snapshot_id,
                player_id=      winner_data.get("player_id") or 0,
                bracket_group_key=bracket_type,
                bracket_label=  bracket_name,
                placement=      winner_data["place"],
                placement_text= winner_data["position"],
                player_name=    winner_data["player_name"],
                winning_score=  winner_data.get("score"),
                created_at=     current_time,
            )
            db.add(winner)
            db.flush()

            payout = models.BracketPayout(
                tournament_id=     tournament_id,
                squad_id=          squad_id,
                bracket_snapshot_id=snapshot_id,
                bracket_winner_id= winner.id,
                player_id=         winner_data.get("player_id") or 0,
                bracket_group_key= bracket_type,
                bracket_label=     bracket_name,
                placement=         winner_data["place"],
                player_name=       winner_data["player_name"],
                prize_pool_total=  prize_pool,
                payout_percentage= winner_data["payout_percentage"],
                payout_amount=     float(winner_data["payout_amount"]),
                entry_fee=         winner_data.get("entry_fee", 0.0),
                bracket_size=      bracket_size,
                is_paid=           False,
                created_at=        current_time,
                updated_at=        current_time,
            )
            db.add(payout)

    logger.info(f"Staged {total_saved} winner/payout rows for tournament {tournament_id}")
    return total_saved
