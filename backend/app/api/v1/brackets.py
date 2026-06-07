
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel, field_validator
import hashlib
import json
import logging

from ..deps import SessionLocal, get_current_user, get_db
from ...core import models
from ...core.async_jobs import job_store, to_dict
from ...core.config import settings
from ...core.validators import BracketValidation
from ...core.errors import handle_error, ValidationError
from ...core.idempotency import IdempotencyReplay, begin_request, complete_request, fail_request
from ...services.brackets_simple import (
    generate_bracket_preview, 
    generate_tournament_brackets, 
    update_match_score,
    validate_all_brackets
)
from ...services.bracket_persistence_simple import (
    save_brackets_simple, 
    load_brackets_simple, 
    delete_brackets_simple,
    brackets_exist_simple,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _verify_tournament_access(db: Session, tournament_id: int, current_user: models.User) -> models.Tournament:
    tournament = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if tournament.user_id != current_user.id and not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Not authorized to access this tournament")
    return tournament


def _normalized_program_entry_counts(player: models.TournamentPlayer) -> dict[str, int]:
    raw_entries = player.bracket_entries if isinstance(player.bracket_entries, dict) else {}
    normalized: dict[str, int] = {}
    for key, value in raw_entries.items():
        try:
            normalized[str(key)] = max(0, int(value or 0))
        except (TypeError, ValueError):
            normalized[str(key)] = 0

    # Keep legacy top-level counts in the signature for compatibility.
    normalized.setdefault("scratch", max(0, int(player.scratch_entries or 0)))
    normalized.setdefault("handicap", max(0, int(player.handicap_entries or 0)))
    return dict(sorted(normalized.items()))


def _build_entries_signature(players: list[models.TournamentPlayer]) -> str:
    signature_payload = [
        {
            "id": int(player.id),
            "entries": _normalized_program_entry_counts(player),
        }
        for player in sorted(players, key=lambda p: p.id)
    ]
    raw = json.dumps(signature_payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _current_entries_signature(db: Session, tournament_id: int, squad_id: Optional[int]) -> str:
    players_query = db.query(models.TournamentPlayer).filter(
        models.TournamentPlayer.tournament_id == tournament_id
    )
    if squad_id:
        players_query = players_query.filter(models.TournamentPlayer.squad_id == squad_id)
    return _build_entries_signature(players_query.all())


def detect_bye_misconfiguration_errors(brackets_result: dict, bracket_size: int) -> list[str]:
    """Return user-facing errors when strict BYE program settings are likely misconfigured."""
    errors: list[str] = []
    for group in brackets_result.get('bracket_groups', []):
        entries_count = int(group.get('entries_count', 0) or 0)
        allow_byes = bool(group.get('allow_byes', False))
        brackets_count = len(group.get('brackets', []) or [])
        refunds_count = int(group.get('refund_entries', 0) or 0)
        name = str(group.get('name') or group.get('key') or 'Bracket program')

        # Strong signal: one short of a full bracket with no generated bracket.
        if entries_count == (bracket_size - 1) and brackets_count == 0 and not allow_byes:
            errors.append(
                f"{name}: {entries_count} entries is one short of bracket size {bracket_size}. "
                f"Enable allow_byes for this program to generate a bracket with one BYE."
            )
            continue

        # Do not hard-fail for larger pools where at least one full bracket exists;
        # one-slot remainders are expected and can be validly refunded.

    return errors

class MatchScoreUpdate(BaseModel):
    bracket_id: str  # Format: "scratch_1" or "handicap_2"
    round_index: int
    match_index: int
    score_a: int
    score_b: int

    @field_validator("score_a", "score_b")
    @classmethod
    def validate_scores(cls, v: int) -> int:
        return BracketValidation.validate_score(v)

@router.get("/preview")
def preview(bracket_size: int = 8):
    """Generate a single bracket preview"""
    try:
        return generate_bracket_preview(bracket_size)
    except ValueError as e:
        raise handle_error(ValidationError(str(e)))
    except Exception as e:
        raise handle_error(e)

@router.post("/update-match-score")
def update_match_score_endpoint(
    score_update: MatchScoreUpdate,
    tournament_id: int,
    squad_id: Optional[int] = None,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Update match score and auto-advance winner to next round"""
    try:
        idempotency_record = None
        if idempotency_key:
            replay_or_record = begin_request(
                db,
                endpoint_scope="brackets:update-match-score",
                idempotency_key=idempotency_key,
                request_payload={
                    "tournament_id": tournament_id,
                    "squad_id": squad_id,
                    "score_update": score_update.model_dump(),
                },
                user_id=getattr(current_user, "id", None),
            )
            if isinstance(replay_or_record, IdempotencyReplay):
                return JSONResponse(status_code=replay_or_record.status_code, content=replay_or_record.response_body)
            idempotency_record = replay_or_record

        _verify_tournament_access(db, tournament_id, current_user)

        # Get the current tournament brackets
        brackets_data = load_brackets_simple(db, tournament_id, squad_id)
        if not brackets_data:
            raise HTTPException(status_code=404, detail="No brackets found for this tournament")
        
        # Update the specific match and auto-advance
        updated_result = update_match_score(
            brackets_data, 
            score_update.bracket_id,
            score_update.round_index,
            score_update.match_index,
            score_update.score_a,
            score_update.score_b
        )
        
        # Save the updated bracket state back to database
        try:
            save_brackets_simple(db, tournament_id, squad_id, updated_result)
            logger.info(f"Updated match score and saved brackets for tournament {tournament_id}")
        except Exception as save_error:
            logger.error(f"Failed to save updated brackets: {save_error}")
            raise HTTPException(status_code=500, detail="Failed to save bracket updates")

        if idempotency_record:
            complete_request(db, idempotency_record, status_code=200, response_body=updated_result)
            db.commit()
        
        return updated_result
        
    except HTTPException:
        if 'idempotency_record' in locals() and idempotency_record is not None:
            fail_request(db, idempotency_record)
            db.commit()
        raise
    except Exception as e:
        logger.error(f"Error updating match score: {e}")
        if 'idempotency_record' in locals() and idempotency_record is not None:
            fail_request(db, idempotency_record)
            db.commit()
        raise HTTPException(status_code=500, detail=f"Error updating match score: {str(e)}")

@router.get("/generate-multiple")
def generate_tournament_brackets_endpoint(
    tournament_id: int,
    squad_id: Optional[int] = None,
    force_regenerate: bool = Query(False, description="Force regeneration even if brackets exist"),
    use_experimental: Optional[bool] = Query(None, description="Override experimental optimizer feature flag"),
    experimental_attempts: Optional[int] = Query(None, ge=1, le=500, description="Experimental optimizer seed attempts"),
    seed: Optional[int] = Query(None, description="Optional deterministic seed for bracket generation"),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Generate multiple brackets for a tournament based on player entries and scores"""
    try:
        idempotency_record = None
        if idempotency_key:
            replay_or_record = begin_request(
                db,
                endpoint_scope="brackets:generate-multiple",
                idempotency_key=idempotency_key,
                request_payload={
                    "tournament_id": tournament_id,
                    "squad_id": squad_id,
                    "force_regenerate": force_regenerate,
                    "use_experimental": use_experimental,
                    "experimental_attempts": experimental_attempts,
                    "seed": seed,
                },
                user_id=getattr(current_user, "id", None),
            )
            if isinstance(replay_or_record, IdempotencyReplay):
                return JSONResponse(status_code=replay_or_record.status_code, content=replay_or_record.response_body)
            idempotency_record = replay_or_record

        # Validate tournament_id
        tournament_id = BracketValidation.validate_tournament_id(tournament_id)
        tournament = _verify_tournament_access(db, tournament_id, current_user)

        experimental_enabled = settings.BRACKETS_EXPERIMENTAL_ENABLED if use_experimental is None else use_experimental
        configured_attempts = settings.BRACKETS_EXPERIMENTAL_ATTEMPTS
        selected_attempts = experimental_attempts if experimental_attempts is not None else configured_attempts
        
        # Experimental runs should regenerate so we can compare outputs.
        if use_experimental is True:
            force_regenerate = True

        # Check database for existing brackets (skip cache to always get fresh scores)
        if not force_regenerate:
            # Load with refresh_scores=True to get current scores (single query, no separate exist check)
            existing_brackets = load_brackets_simple(db, tournament_id, squad_id, refresh_scores=True)
            if existing_brackets:
                result = {
                    "tournament_id": tournament_id,
                    "tournament_name": tournament.name,
                    "bracket_size": existing_brackets.get('bracket_size', 8),
                    "squad_id": squad_id,
                    "loaded_from_database": True,
                    **existing_brackets
                }
                # DON'T cache - we want fresh scores every time
                logger.info(f"Loaded brackets with refreshed scores for tournament {tournament_id}")
                if idempotency_record:
                    complete_request(db, idempotency_record, status_code=200, response_body=result)
                    db.commit()
                return result
        
        # Generate new brackets (either no existing brackets or forced regeneration)
        # Get bracket settings for the tournament
        bracket_settings = db.query(models.BracketSettings).filter(
            models.BracketSettings.tournament_id == tournament_id
        ).first()
        
        if not bracket_settings or not bracket_settings.bracket_size:
            raise HTTPException(
                status_code=400, 
                detail="Tournament bracket size not configured. Please set bracket size in tournament settings."
            )

        # Enforce supported bracket sizes for three-game sets
        try:
            BracketValidation.validate_bracket_size(bracket_settings.bracket_size)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        # Get bowlers for this tournament/squad
        bowlers_query = db.query(models.Bowler).filter(models.Bowler.tournament_id == tournament_id)
        if squad_id:
            bowlers_query = bowlers_query.filter(models.Bowler.squad_id == squad_id)
        
        bowlers = bowlers_query.all()
        
        if not bowlers:
            logger.info(
                "No players found for tournament %s squad %s; returning empty bracket result",
                tournament_id,
                squad_id,
            )
            empty_result = generate_tournament_brackets(
                players=[],
                bracket_size=bracket_settings.bracket_size,
                db=db,
                tournament_id=tournament_id,
                bracket_programs=bracket_settings.bracket_programs,
                use_history=True,
                seed=seed,
                use_experimental_optimizer=experimental_enabled,
                experimental_attempts=selected_attempts,
            )
            result = {
                "tournament_id": tournament_id,
                "tournament_name": tournament.name,
                "bracket_size": bracket_settings.bracket_size,
                "squad_id": squad_id,
                "generated_new": False,
                "no_players": True,
                **empty_result,
            }
            if idempotency_record:
                complete_request(db, idempotency_record, status_code=200, response_body=result)
                db.commit()
            return result
        
        # Get scores for these bowlers — single query, build lookup map
        players_data = []

        logger.info(f"Fetching scores for {len(bowlers)} bowlers")

        scores_query = db.query(models.Score).filter(
            models.Score.tournament_id == tournament_id
        )
        if squad_id:
            scores_query = scores_query.filter(models.Score.squad_id == squad_id)
        scores_map = {s.bowler_id: s for s in scores_query.all()}

        for bowler in bowlers:
            score_record = scores_map.get(bowler.id)

            logger.debug(f"Player: {bowler.name} (ID: {bowler.id})")
            if score_record:
                logger.debug(f"  Scores found: G1={score_record.game1_total}, G2={score_record.game2_total}, G3={score_record.game3_total}")
            else:
                logger.debug(f"  No scores found")
            
            # Split name into first and last name
            name_parts = bowler.name.split(' ', 1)
            first_name = name_parts[0] if len(name_parts) > 0 else ''
            last_name = name_parts[1] if len(name_parts) > 1 else ''
            
            # Create scores dictionary - matches Score table field names
            scores_dict = {
                'game1_scratch': score_record.game1_scratch if score_record else None,
                'game1_total': score_record.game1_total if score_record else None,
                'game2_scratch': score_record.game2_scratch if score_record else None,
                'game2_total': score_record.game2_total if score_record else None,
                'game3_scratch': score_record.game3_scratch if score_record else None,
                'game3_total': score_record.game3_total if score_record else None,
            } if score_record else {}
            
            logger.debug(f"  Scores dictionary: {scores_dict}")
            
            player_data = {
                'id': bowler.id,
                'firstName': first_name,
                'lastName': last_name,
                'average': bowler.average or 0,
                'handicap': bowler.handicap_entries or 0,
                'scratch': bowler.scratch_entries or 0,
                'division': bowler.division or 'Open',
                'bracket_entries': bowler.bracket_entries or {},
                'scores': scores_dict
            }
            players_data.append(player_data)
        
        # Generate brackets with validation
        brackets_result = generate_tournament_brackets(
            players=players_data,
            bracket_size=bracket_settings.bracket_size,
            db=db,
            tournament_id=tournament_id,
            bracket_programs=bracket_settings.bracket_programs,
            use_history=True,  # Enable advanced algorithm with history
            seed=seed,
            use_experimental_optimizer=experimental_enabled,
            experimental_attempts=selected_attempts,
        )

        # Persist a deterministic signature of per-player bracket entry counts
        # so we can detect true entry changes later (not just player count changes).
        brackets_result["entries_signature"] = _build_entries_signature(bowlers)

        bye_config_errors = detect_bye_misconfiguration_errors(
            brackets_result,
            bracket_settings.bracket_size,
        )
        if bye_config_errors:
            raise HTTPException(
                status_code=400,
                detail="; ".join(bye_config_errors),
            )
        
        # Validate bracket structure before saving
        validation_result = validate_all_brackets(brackets_result)
        
        # Log validation warnings if any
        if validation_result['warnings']:
            for warning in validation_result['warnings']:
                logger.warning(f"Bracket validation warning: {warning}")
        
        # If validation errors exist, raise an exception
        if not validation_result['is_valid']:
            error_message = "Bracket validation failed: " + "; ".join(validation_result['errors'])
            logger.error(error_message)
            raise HTTPException(status_code=500, detail=error_message)
        
        # Save the generated brackets to database
        try:
            save_brackets_simple(db, tournament_id, squad_id, brackets_result, player_count=len(bowlers))
            logger.info(f"Successfully saved brackets for tournament {tournament_id}, squad {squad_id}")
        except Exception as save_error:
            # Log the save error but don't fail the generation
            logger.error(f"Failed to save brackets to database: {save_error}")
            raise HTTPException(status_code=500, detail=f"Failed to save brackets: {str(save_error)}")
        
        # Prepare result with validation info
        result = {
            "tournament_id": tournament_id,
            "tournament_name": tournament.name,
            "bracket_size": bracket_settings.bracket_size,
            "squad_id": squad_id,
            "generated_new": True,
            "experimental_enabled": experimental_enabled,
            "experimental_attempts": selected_attempts,
            "seed": seed,
            **brackets_result,
            "validation_result": validation_result  # Include validation info in response
        }

        if idempotency_record:
            complete_request(db, idempotency_record, status_code=200, response_body=result)
            db.commit()
        
        return result
        
    except HTTPException:
        if 'idempotency_record' in locals() and idempotency_record is not None:
            fail_request(db, idempotency_record)
            db.commit()
        raise
    except Exception as e:
        if 'idempotency_record' in locals() and idempotency_record is not None:
            fail_request(db, idempotency_record)
            db.commit()
        raise HTTPException(status_code=500, detail=f"Error generating brackets: {str(e)}")


@router.post("/generate-multiple-async")
def generate_tournament_brackets_async(
    background_tasks: BackgroundTasks,
    tournament_id: int,
    squad_id: Optional[int] = None,
    force_regenerate: bool = Query(False),
    use_experimental: Optional[bool] = Query(None),
    experimental_attempts: Optional[int] = Query(None, ge=1, le=500),
    seed: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Queue bracket generation and return a job handle for polling."""
    _verify_tournament_access(db, tournament_id, current_user)
    job = job_store.create("brackets.generate")
    actor_user_id = current_user.id

    def _run_job() -> dict:
        db = SessionLocal()
        try:
            actor_user = db.query(models.User).filter(models.User.id == actor_user_id).first()
            if not actor_user:
                raise HTTPException(status_code=401, detail="User no longer exists")
            return generate_tournament_brackets_endpoint(
                tournament_id=tournament_id,
                squad_id=squad_id,
                force_regenerate=force_regenerate,
                use_experimental=use_experimental,
                experimental_attempts=experimental_attempts,
                seed=seed,
                idempotency_key=None,
                db=db,
                current_user=actor_user,
            )
        finally:
            db.close()

    background_tasks.add_task(job_store.run, job.job_id, _run_job)
    return {"job_id": job.job_id, "status": job.status}


@router.get("/jobs/{job_id}")
def get_bracket_job_status(job_id: str):
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return to_dict(job)

@router.get("/load/{tournament_id}")
def load_tournament_brackets(
    tournament_id: int,
    squad_id: Optional[int] = None,
    refresh_scores: bool = Query(True, description="Refresh scores from database"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Load existing brackets for a tournament/squad from database with fresh scores"""
    try:
        tournament = _verify_tournament_access(db, tournament_id, current_user)
        
        # Load brackets with score refresh enabled by default
        brackets_data = load_brackets_simple(db, tournament_id, squad_id, refresh_scores=refresh_scores)
        if not brackets_data:
            raise HTTPException(status_code=404, detail="No brackets found for this tournament/squad")

        # Detect entry mismatch since last generation.
        # Prefer the entries_signature (captures entry-count edits), with a
        # fallback to legacy player-count comparison for older snapshots.
        player_count_at_generation = brackets_data.get('player_count_at_generation')
        entries_signature_at_generation = brackets_data.get('entries_signature')
        current_entries_signature = _current_entries_signature(db, tournament_id, squad_id)

        # Backfill legacy snapshots once so future entry edits are detectable.
        if not entries_signature_at_generation:
            entries_signature_at_generation = current_entries_signature
            brackets_data['entries_signature'] = entries_signature_at_generation
            snapshot = db.query(models.SimpleBracket).filter(
                models.SimpleBracket.tournament_id == tournament_id,
                models.SimpleBracket.squad_id == squad_id if squad_id else models.SimpleBracket.squad_id.is_(None),
                models.SimpleBracket.is_active == True,
            ).first()
            if snapshot and isinstance(snapshot.bracket_data, dict):
                payload = dict(snapshot.bracket_data)
                payload['entries_signature'] = entries_signature_at_generation
                snapshot.bracket_data = payload
                db.commit()

        current_count_q = db.query(func.count(models.TournamentPlayer.id)).filter(
            models.TournamentPlayer.tournament_id == tournament_id
        )
        if squad_id:
            current_count_q = current_count_q.filter(models.TournamentPlayer.squad_id == squad_id)
        current_player_count = current_count_q.scalar() or 0

        if entries_signature_at_generation:
            entries_mismatch = current_entries_signature != entries_signature_at_generation
        else:
            entries_mismatch = (
                player_count_at_generation is not None
                and current_player_count != player_count_at_generation
            )

        logger.info(f"Loaded brackets for tournament {tournament_id} with refresh_scores={refresh_scores}")
        
        return {
            "tournament_id": tournament_id,
            "tournament_name": tournament.name,
            "squad_id": squad_id,
            "bracket_size": brackets_data.get('bracket_size', 8),
            "entries_mismatch": entries_mismatch,
            "player_count_at_generation": player_count_at_generation,
            "current_player_count": current_player_count,
            "entries_signature_at_generation": entries_signature_at_generation,
            **brackets_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading brackets: {str(e)}")

@router.delete("/delete/{tournament_id}")
def delete_tournament_brackets(
    tournament_id: int,
    squad_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Delete existing brackets for a tournament/squad"""
    try:
        _verify_tournament_access(db, tournament_id, current_user)
        
        deleted = delete_brackets_simple(db, tournament_id, squad_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="No brackets found to delete")
        
        return {"message": "Brackets deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting brackets: {str(e)}")

@router.get("/exists/{tournament_id}")
def check_brackets_exist(
    tournament_id: int,
    squad_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Check if brackets exist for a tournament/squad"""
    try:
        _verify_tournament_access(db, tournament_id, current_user)
        exists = brackets_exist_simple(db, tournament_id, squad_id)
        return {"exists": exists}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking brackets: {str(e)}")


@router.get("/status/{tournament_id}")
def bracket_status(
    tournament_id: int,
    squad_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Lightweight bracket status check: existence and entry mismatch."""
    try:
        _verify_tournament_access(db, tournament_id, current_user)
        snapshot = db.query(models.SimpleBracket).filter(
            models.SimpleBracket.tournament_id == tournament_id,
            models.SimpleBracket.squad_id == squad_id if squad_id else models.SimpleBracket.squad_id.is_(None),
            models.SimpleBracket.is_active == True,
        ).first()

        if not snapshot:
            return {
                "has_brackets": False,
                "entries_mismatch": False,
                "current_player_count": 0,
                "player_count_at_generation": None,
            }

        count_q = db.query(func.count(models.TournamentPlayer.id)).filter(
            models.TournamentPlayer.tournament_id == tournament_id
        )
        if squad_id:
            count_q = count_q.filter(models.TournamentPlayer.squad_id == squad_id)
        current_player_count = count_q.scalar() or 0

        stored_entries_signature = None
        if isinstance(snapshot.bracket_data, dict):
            stored_entries_signature = snapshot.bracket_data.get("entries_signature")
        current_entries_signature = _current_entries_signature(db, tournament_id, squad_id)

        # Backfill missing signature for legacy snapshots.
        if not stored_entries_signature:
            stored_entries_signature = current_entries_signature
            if isinstance(snapshot.bracket_data, dict):
                payload = dict(snapshot.bracket_data)
                payload['entries_signature'] = stored_entries_signature
                snapshot.bracket_data = payload
                db.commit()

        if stored_entries_signature:
            entries_mismatch = current_entries_signature != stored_entries_signature
        else:
            entries_mismatch = (
                snapshot.player_count is not None
                and current_player_count != snapshot.player_count
            )

        return {
            "has_brackets": True,
            "entries_mismatch": entries_mismatch,
            "current_player_count": current_player_count,
            "player_count_at_generation": snapshot.player_count,
            "entries_signature_at_generation": stored_entries_signature,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking bracket status: {str(e)}")
