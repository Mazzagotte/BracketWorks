from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert
from typing import List, Optional
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator
import logging

from app.api.deps import get_current_user, get_db
from app.core.models import PlayerScore, TournamentBracketSettings, TournamentPlayer
from app.core.config import settings
from app.core import models
from app.core.validators import BracketValidation
from app.core.idempotency import IdempotencyReplay, begin_request, complete_request, fail_request
from app.services.payouts import reset_payouts_if_needed
from app.services.tournament_access import verify_owned_tournament_access
from app.services.tournament_audit import record_tournament_event
from app.services.tournament_lifecycle import refresh_score_completion
from app.services.tournament_snapshots import create_restore_point

router = APIRouter()
logger = logging.getLogger(__name__)


def calculate_handicap(average: int, handicap_base: float, handicap_percentage: float) -> int:
    """
    Calculate handicap for a bowler.
    Formula: (handicap_base - average) * (handicap_percentage / 100)
    """
    if average is None:
        return 0
    handicap = (handicap_base - average) * (handicap_percentage / 100)
    return int(round(handicap))


def get_handicap_for_bowler(
    player: TournamentPlayer,
    tournament_id: int,
    db: Session,
    settings: Optional[TournamentBracketSettings] = None,
) -> int:
    """Get calculated handicap for a player based on tournament settings.

    Pass ``settings`` to avoid an extra DB round-trip when the caller has
    already fetched tournament settings (e.g. in a batch loop).
    """
    if settings is None:
        settings = db.query(TournamentBracketSettings).filter(
            TournamentBracketSettings.tournament_id == tournament_id
        ).first()

    handicap_base = settings.handicap_base if settings else 200.0
    handicap_percentage = settings.handicap_percentage if settings else 80.0

    return calculate_handicap(player.average, handicap_base, handicap_percentage)


def calculate_game_totals(score_data, handicap: int) -> dict:
    """Calculate game totals by adding handicap to scratch scores"""
    totals = {}

    provided_fields = getattr(score_data, 'model_fields_set', set())

    for game_number in (1, 2, 3):
        scratch_field = f'game{game_number}_scratch'
        total_field = f'game{game_number}_with_handicap'

        # Only touch totals for fields explicitly provided in the payload.
        # This preserves partial updates and ensures explicit null clears totals.
        if scratch_field not in provided_fields:
            continue

        scratch_value = getattr(score_data, scratch_field, None)
        totals[total_field] = (
            (scratch_value + handicap) if scratch_value is not None else None
        )
    
    return totals

class ScoreCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    player_id: int = Field(validation_alias=AliasChoices("player_id", "bowler_id"))
    tournament_id: int
    squad_id: int
    game1_scratch: Optional[int] = None
    game2_scratch: Optional[int] = None
    game3_scratch: Optional[int] = None
    correction_reason: Optional[str] = Field(default=None, max_length=1000)
    # Note: game totals are calculated automatically by backend (scratch + handicap)

    @field_validator("game1_scratch", "game2_scratch", "game3_scratch")
    @classmethod
    def validate_scores(cls, value: Optional[int]) -> Optional[int]:
        return BracketValidation.validate_score(value)

class ScoreUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    game1_scratch: Optional[int] = None
    game2_scratch: Optional[int] = None
    game3_scratch: Optional[int] = None
    correction_reason: Optional[str] = Field(default=None, max_length=1000)
    # Note: game totals are calculated automatically by backend (scratch + handicap)

    @field_validator("game1_scratch", "game2_scratch", "game3_scratch")
    @classmethod
    def validate_scores(cls, value: Optional[int]) -> Optional[int]:
        return BracketValidation.validate_score(value)

class ScoreResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    player_id: int
    tournament_id: int
    squad_id: int
    game1_scratch: Optional[int] = None
    game1_with_handicap: Optional[int] = Field(default=None, validation_alias=AliasChoices("game1_with_handicap", "game1_total"))
    game2_scratch: Optional[int] = None
    game2_with_handicap: Optional[int] = Field(default=None, validation_alias=AliasChoices("game2_with_handicap", "game2_total"))
    game3_scratch: Optional[int] = None
    game3_with_handicap: Optional[int] = Field(default=None, validation_alias=AliasChoices("game3_with_handicap", "game3_total"))


class ScoreLockRequest(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=1000)


def _scratch_changes(previous_score: PlayerScore | None, score_data: ScoreCreate | ScoreUpdate) -> list[tuple[str, int | None, int | None]]:
    if previous_score is None:
        return []
    changes = []
    for field in ("game1_scratch", "game2_scratch", "game3_scratch"):
        if field not in score_data.model_fields_set:
            continue
        old_value = getattr(previous_score, field)
        new_value = getattr(score_data, field)
        if old_value is not None and old_value != new_value:
            changes.append((field, old_value, new_value))
    return changes


def _require_correction_reason(changes: list[tuple[str, int | None, int | None]], reason: str | None) -> str | None:
    cleaned = (reason or "").strip() or None
    if changes and not cleaned:
        raise HTTPException(status_code=422, detail="A correction reason is required when changing a saved score")
    return cleaned


def _record_corrections(db: Session, *, changes, score: PlayerScore, reason: str | None, user) -> None:
    for field, old_value, new_value in changes:
        db.add(models.ScoreCorrection(
            tournament_id=score.tournament_id, score_id=score.id, player_id=score.player_id,
            field_name=field, old_value=old_value, new_value=new_value,
            reason=reason or "Score correction", changed_by_user_id=user.id,
        ))


def _require_scores_open(db: Session, tournament_id: int) -> models.Tournament:
    tournament = db.get(models.Tournament, tournament_id)
    if tournament and tournament.scores_locked:
        raise HTTPException(status_code=423, detail="Scores are locked. Unlock scores with a reason before editing.")
    return tournament


@router.get("/{tournament_id}/corrections")
def get_score_corrections(tournament_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    verify_owned_tournament_access(db, tournament_id, current_user, permission="view")
    rows = db.query(models.ScoreCorrection, models.User, models.TournamentPlayer).join(
        models.User, models.User.id == models.ScoreCorrection.changed_by_user_id
    ).join(models.TournamentPlayer, models.TournamentPlayer.id == models.ScoreCorrection.player_id).filter(
        models.ScoreCorrection.tournament_id == tournament_id
    ).order_by(models.ScoreCorrection.created_at.desc()).all()
    return [{
        "id": correction.id, "score_id": correction.score_id, "player_id": correction.player_id,
        "player_name": player.full_name, "field_name": correction.field_name,
        "old_value": correction.old_value, "new_value": correction.new_value,
        "reason": correction.reason,
        "changed_by": f"{user.first_name} {user.last_name}".strip() or user.username,
        "changed_by_user_id": correction.changed_by_user_id, "created_at": correction.created_at,
    } for correction, user, player in rows]


@router.post("/{tournament_id}/lock")
def lock_scores(tournament_id: int, payload: ScoreLockRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    tournament = verify_owned_tournament_access(db, tournament_id, current_user, permission="manage_scores")
    if tournament.scores_locked:
        return {"tournament_id": tournament_id, "scores_locked": True}
    tournament.scores_locked = True
    record_tournament_event(db, tournament_id=tournament_id, event_type="scores.locked", user=current_user,
                            summary="Locked tournament scores", reason=(payload.reason or "").strip() or None,
                            after_values={"scores_locked": True}, entity_type="tournament", entity_id=tournament_id)
    db.commit()
    return {"tournament_id": tournament_id, "scores_locked": True}


@router.post("/{tournament_id}/unlock")
def unlock_scores(tournament_id: int, payload: ScoreLockRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    tournament = verify_owned_tournament_access(db, tournament_id, current_user, permission="manage_scores", allow_read_only_mutation=True)
    reason = (payload.reason or "").strip()
    if not reason:
        raise HTTPException(status_code=422, detail="A reason is required to unlock scores")
    if tournament.lifecycle_status == "finalized":
        raise HTTPException(status_code=409, detail="Finalized tournament scores cannot be unlocked")
    if not tournament.scores_locked:
        return {"tournament_id": tournament_id, "scores_locked": False}
    create_restore_point(db, tournament_id=tournament_id, user=current_user, trigger="scores.unlock", summary="Before scores were unlocked")
    tournament.scores_locked = False
    payout_squad_ids = [row[0] for row in db.query(models.TournamentPayoutSummary.squad_id).filter(
        models.TournamentPayoutSummary.tournament_id == tournament_id
    ).distinct().all()]
    for squad_id in payout_squad_ids:
        reset_payouts_if_needed(db, tournament_id, squad_id)
    record_tournament_event(db, tournament_id=tournament_id, event_type="scores.unlocked", user=current_user,
                            summary="Unlocked tournament scores", reason=reason,
                            before_values={"scores_locked": True}, after_values={"scores_locked": False},
                            entity_type="tournament", entity_id=tournament_id)
    db.commit()
    return {"tournament_id": tournament_id, "scores_locked": False}

@router.get("/", response_model=List[ScoreResponse])
def get_scores(
    tournament_id: Optional[int] = None,
    squad_id: Optional[int] = None,
    player_id: Optional[int] = Query(None),
    bowler_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get scores with optional filtering"""
    query = db.query(PlayerScore)

    if tournament_id:
        verify_owned_tournament_access(db, tournament_id, current_user, permission="view")
    elif not getattr(current_user, "is_admin", False):
        query = query.join(models.Tournament, models.Tournament.id == PlayerScore.tournament_id).filter(
            models.Tournament.user_id == current_user.id
        )
    
    if tournament_id:
        query = query.filter(PlayerScore.tournament_id == tournament_id)
    if squad_id:
        query = query.filter(PlayerScore.squad_id == squad_id)
    target_player_id = player_id or bowler_id
    if target_player_id:
        query = query.filter(PlayerScore.player_id == target_player_id)
    
    scores = query.all()
    return scores

@router.post("/", response_model=ScoreResponse)
def create_or_update_score(
    score_data: ScoreCreate,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create or update a score for a player."""
    
    idempotency_record = None
    try:
        verify_owned_tournament_access(db, score_data.tournament_id, current_user, permission="manage_scores")
        _require_scores_open(db, score_data.tournament_id)

        if idempotency_key:
            replay_or_record = begin_request(
                db,
                endpoint_scope="scores:create-or-update",
                idempotency_key=idempotency_key,
                request_payload=score_data.model_dump(exclude_unset=False),
                user_id=getattr(current_user, "id", None),
            )
            if isinstance(replay_or_record, IdempotencyReplay):
                return JSONResponse(status_code=replay_or_record.status_code, content=replay_or_record.response_body)
            idempotency_record = replay_or_record

        # Get player information
        player = db.query(TournamentPlayer).filter(TournamentPlayer.id == score_data.player_id).first()
        if not player:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Player not found"
            )

        if player.tournament_id != score_data.tournament_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Player does not belong to the provided tournament"
            )

        # Calculate handicap and game totals
        handicap = get_handicap_for_bowler(player, score_data.tournament_id, db)
        logger.info(f"Calculating handicap for player {player.full_name} (avg={player.average}): {handicap}")

        # Build score dictionary with calculated totals
        score_dict = score_data.model_dump(exclude_unset=True, exclude={"correction_reason"})
        score_dict.update(calculate_game_totals(score_data, handicap))

        previous_score = (
            db.query(PlayerScore)
            .filter(
                PlayerScore.player_id == score_data.player_id,
                PlayerScore.tournament_id == score_data.tournament_id,
                PlayerScore.squad_id == score_data.squad_id,
            )
            .first()
        )
        corrections = _scratch_changes(previous_score, score_data)
        correction_reason = _require_correction_reason(corrections, score_data.correction_reason)
        before_values = None if previous_score is None else {
            field: getattr(previous_score, field) for field in score_dict if hasattr(previous_score, field)
        }

        # Single-statement upsert — no separate SELECT needed.
        # The unique constraint on (player_id, tournament_id, squad_id) makes this safe.
        update_cols = {k: v for k, v in score_dict.items()
                       if k not in ("player_id", "tournament_id", "squad_id")}
        bind = db.get_bind()
        dialect_name = bind.dialect.name if bind is not None else ""
        if dialect_name == "sqlite":
            score = (
                db.query(PlayerScore)
                .filter(
                    PlayerScore.player_id == score_data.player_id,
                    PlayerScore.tournament_id == score_data.tournament_id,
                    PlayerScore.squad_id == score_data.squad_id,
                )
                .first()
            )
            if score is None:
                score = PlayerScore(**score_dict)
                db.add(score)
            else:
                for field, value in update_cols.items():
                    setattr(score, field, value)
            db.flush()
            db.refresh(score)
        else:
            stmt = (
                pg_insert(PlayerScore)
                .values(**score_dict)
                .on_conflict_do_update(
                    constraint="uq_player_scores_player_tournament_squad",
                    set_=update_cols,
                )
                .returning(PlayerScore)
            )
            result = db.execute(stmt)
            score = result.scalars().one()
        logger.info(f"Upserted score for player {player.full_name}: G1={score.game1_total}, G2={score.game2_total}, G3={score.game3_total}")

        _record_corrections(db, changes=corrections, score=score, reason=correction_reason, user=current_user)
        reset_payouts_if_needed(db, score.tournament_id, score.squad_id)
        record_tournament_event(
            db,
            tournament_id=score.tournament_id,
            event_type="score.entered" if before_values is None else "score.changed",
            user=current_user,
            summary=f"{'Entered' if before_values is None else 'Changed'} scores for {player.full_name}",
            before_values=before_values,
            after_values={field: getattr(score, field) for field in score_dict if hasattr(score, field)},
            reason=correction_reason,
            entity_type="score",
            entity_id=score.id,
        )
        refresh_score_completion(db, score.tournament_id, score.squad_id)
        db.commit()

        if idempotency_record:
            response_body = {
                "id": score.id,
                "player_id": score.player_id,
                "tournament_id": score.tournament_id,
                "squad_id": score.squad_id,
                "game1_scratch": score.game1_scratch,
                "game1_with_handicap": score.game1_total,
                "game2_scratch": score.game2_scratch,
                "game2_with_handicap": score.game2_total,
                "game3_scratch": score.game3_scratch,
                "game3_with_handicap": score.game3_total,
            }
            complete_request(db, idempotency_record, status_code=200, response_body=response_body)
            db.commit()

        return score
    except HTTPException:
        if idempotency_record:
            fail_request(db, idempotency_record)
            db.commit()
        raise
    except Exception:
        if idempotency_record:
            fail_request(db, idempotency_record)
            db.commit()
        raise

@router.put("/{score_id}", response_model=ScoreResponse)
def update_score(
    score_id: int,
    score_data: ScoreUpdate,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update specific score by ID"""
    idempotency_record = None
    try:
        if idempotency_key:
            replay_or_record = begin_request(
                db,
                endpoint_scope="scores:update",
                idempotency_key=idempotency_key,
                request_payload={"score_id": score_id, **score_data.model_dump(exclude_unset=False)},
                user_id=getattr(current_user, "id", None),
            )
            if isinstance(replay_or_record, IdempotencyReplay):
                return JSONResponse(status_code=replay_or_record.status_code, content=replay_or_record.response_body)
            idempotency_record = replay_or_record

        score = db.query(PlayerScore).filter(PlayerScore.id == score_id).first()
        if not score:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Score not found"
            )

        verify_owned_tournament_access(
            db, score.tournament_id, current_user, permission="manage_scores"
        )
        _require_scores_open(db, score.tournament_id)

        # Get player information
        player = db.query(TournamentPlayer).filter(TournamentPlayer.id == score.player_id).first()
        if not player:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Player not found"
            )
        
        # Calculate handicap and game totals
        handicap = get_handicap_for_bowler(player, score.tournament_id, db)
        logger.info(f"Calculating handicap for player {player.full_name} (avg={player.average}): {handicap}")
        
        # Build score dictionary with calculated totals
        corrections = _scratch_changes(score, score_data)
        correction_reason = _require_correction_reason(corrections, score_data.correction_reason)
        score_dict = score_data.model_dump(exclude_unset=True, exclude={"correction_reason"})
        score_dict.update(calculate_game_totals(score_data, handicap))
        before_values = {field: getattr(score, field) for field in score_dict}
        
        # Update fields
        for field, value in score_dict.items():
            setattr(score, field, value)

        _record_corrections(db, changes=corrections, score=score, reason=correction_reason, user=current_user)
        
        record_tournament_event(
            db,
            tournament_id=score.tournament_id,
            event_type="score.changed",
            user=current_user,
            summary=f"Changed scores for {player.full_name}",
            before_values=before_values,
            after_values={field: getattr(score, field) for field in score_dict},
            reason=correction_reason,
            entity_type="score",
            entity_id=score.id,
        )
        refresh_score_completion(db, score.tournament_id, score.squad_id)
        db.commit()
        db.refresh(score)
        logger.info(f"Updated score for player {player.full_name}: G1={score.game1_total}, G2={score.game2_total}, G3={score.game3_total}")

        if idempotency_record:
            response_body = {
                "id": score.id,
                "player_id": score.player_id,
                "tournament_id": score.tournament_id,
                "squad_id": score.squad_id,
                "game1_scratch": score.game1_scratch,
                "game1_with_handicap": score.game1_total,
                "game2_scratch": score.game2_scratch,
                "game2_with_handicap": score.game2_total,
                "game3_scratch": score.game3_scratch,
                "game3_with_handicap": score.game3_total,
            }
            complete_request(db, idempotency_record, status_code=200, response_body=response_body)
            db.commit()

        return score
    except HTTPException:
        if idempotency_record:
            fail_request(db, idempotency_record)
            db.commit()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating score {score_id}: {e}")
        if idempotency_record:
            fail_request(db, idempotency_record)
            db.commit()
        raise HTTPException(status_code=500, detail="Failed to update score")

@router.delete("/{score_id}")
def delete_score(
    score_id: int,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete a score"""
    idempotency_record = None
    try:
        if idempotency_key:
            replay_or_record = begin_request(
                db,
                endpoint_scope="scores:delete",
                idempotency_key=idempotency_key,
                request_payload={"score_id": score_id},
                user_id=getattr(current_user, "id", None),
            )
            if isinstance(replay_or_record, IdempotencyReplay):
                return JSONResponse(status_code=replay_or_record.status_code, content=replay_or_record.response_body)
            idempotency_record = replay_or_record

        score = db.query(PlayerScore).filter(PlayerScore.id == score_id).first()
        if not score:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Score not found"
            )

        verify_owned_tournament_access(
            db, score.tournament_id, current_user, permission="manage_scores"
        )
        _require_scores_open(db, score.tournament_id)
        deleted_values = {
            "game1_scratch": score.game1_scratch,
            "game2_scratch": score.game2_scratch,
            "game3_scratch": score.game3_scratch,
        }
        tournament_id = score.tournament_id
        db.delete(score)
        record_tournament_event(
            db,
            tournament_id=tournament_id,
            event_type="score.deleted",
            user=current_user,
            summary="Deleted a player score record",
            before_values=deleted_values,
            entity_type="score",
            entity_id=score_id,
        )
        db.commit()
        response_body = {"message": "Score deleted successfully"}
        if idempotency_record:
            complete_request(db, idempotency_record, status_code=200, response_body=response_body)
            db.commit()
        return response_body
    except HTTPException:
        if idempotency_record:
            fail_request(db, idempotency_record)
            db.commit()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting score {score_id}: {e}")
        if idempotency_record:
            fail_request(db, idempotency_record)
            db.commit()
        raise HTTPException(status_code=500, detail="Failed to delete score")


@router.delete("/dev/clear-game/{game_number}")
def dev_clear_game_scores(
    game_number: int,
    tournament_id: int = Query(...),
    squad_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """
    DEV ONLY — Null out all scores for a specific game number (2 or 3)
    across all players in the given tournament/squad.
    """
    if not settings.is_development:
        raise HTTPException(status_code=404, detail="Not found")

    if game_number not in (2, 3):
        raise HTTPException(status_code=400, detail="Only game 2 or game 3 can be cleared with this endpoint")

    verify_owned_tournament_access(
        db, tournament_id, current_user, permission="manage_scores"
    )

    query = db.query(PlayerScore).filter(PlayerScore.tournament_id == tournament_id)
    if squad_id is not None:
        query = query.filter(PlayerScore.squad_id == squad_id)

    scores = query.all()
    scratch_field = f"game{game_number}_scratch"
    total_field = f"game{game_number}_total"

    for score in scores:
        setattr(score, scratch_field, None)
        setattr(score, total_field, None)

    db.commit()
    logger.info(f"[DEV] Cleared game {game_number} scores for tournament {tournament_id}, squad {squad_id} ({len(scores)} records)")
    return {"message": f"Cleared game {game_number} scores for {len(scores)} player(s)"}
