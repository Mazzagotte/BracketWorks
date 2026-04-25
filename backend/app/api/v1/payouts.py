"""
Payout management API endpoints for tournament winner tracking and prize distribution.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
import logging
from datetime import datetime

from ..deps import get_db, get_current_user
from ...core import models
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

router = APIRouter()
logger = logging.getLogger(__name__)


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
    if scratch_fee is not None and handicap_fee is not None:
        return {"scratch": scratch_fee, "handicap": handicap_fee}

    bracket_settings = db.query(models.BracketSettings).filter(
        models.BracketSettings.tournament_id == tournament_id
    ).first()

    if bracket_settings and bracket_settings.cost_per_bracket is not None:
        cost = float(bracket_settings.cost_per_bracket)
        return {"scratch": cost, "handicap": cost}

    return {
        "scratch":  scratch_fee  if scratch_fee  is not None else DEFAULT_ENTRY_FEES["scratch"],
        "handicap": handicap_fee if handicap_fee is not None else DEFAULT_ENTRY_FEES["handicap"],
    }


def _verify_tournament_access(db: Session, tournament_id: int, current_user) -> models.Tournament:
    tournament = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if tournament.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    return tournament


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
        tournament  = _verify_tournament_access(db, tournament_id, current_user)
        entry_fees  = _get_entry_fees(db, tournament_id, scratch_fee, handicap_fee)

        brackets_data = load_generated_brackets(db, tournament_id, squad_id)
        if not brackets_data:
            raise HTTPException(status_code=404, detail="No brackets found for this tournament")

        payout_data = calculate_tournament_payouts(brackets_data, entry_fees, house_percentage)

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
        tournament    = _verify_tournament_access(db, tournament_id, current_user)
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
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


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
    from decimal import Decimal as _D, ROUND_HALF_UP as _RHU

    try:
        tournament = _verify_tournament_access(db, tournament_id, current_user)
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
                    payout_amt = float((_D(str(prize_pool)) * _D('50') / _D('100')).quantize(_D('0.01'), rounding=_RHU))
                else:
                    pct = pct_map.get(position.lower(), 0)
                    if pct == 0:
                        continue
                    payout_amt = float((_D(str(prize_pool)) * _D(str(pct)) / _D('100')).quantize(_D('0.01'), rounding=_RHU))

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
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


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
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Save calculated payouts and winners to database for record keeping."""
    if house_percentage < 0 or house_percentage > 100:
        raise HTTPException(status_code=400, detail="House percentage must be between 0 and 100")

    try:
        tournament  = _verify_tournament_access(db, tournament_id, current_user)
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

        current_time  = datetime.utcnow().isoformat()
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

            if not existing_summary:
                db.add(payout_summary)

            db.flush()

            _save_winners_and_payouts(
                db, tournament_id, squad_id, payout_summary.id, payout_data, current_time
            )

            db.commit()

            logger.info(
                f"Saved payouts for tournament {tournament_id}: "
                f"total_pool={payout_summary.total_prize_pool}, winners={total_winners}"
            )

            return {
                "status":  "success",
                "message": "Payouts saved successfully",
                "summary": {
                    "total_prize_pool": payout_summary.total_prize_pool,
                    "house_take":       payout_summary.house_amount,
                    "total_winners":    total_winners,
                }
            }

        except Exception as save_error:
            db.rollback()
            logger.error(f"Error during payout save transaction: {save_error}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to save payouts - transaction rolled back")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving tournament payouts: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to save payouts")


# ---------------------------------------------------------------------------
# Payout history (from saved records)
# ---------------------------------------------------------------------------

@router.get("/history/{tournament_id}")
def get_payout_history_endpoint(
    tournament_id: int,
    squad_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: UserOut = Depends(get_current_user),
):
    """Get saved payout history for a tournament."""
    try:
        tournament     = _verify_tournament_access(db, tournament_id, current_user)
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
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting payout history: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


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
