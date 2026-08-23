
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Literal, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, update as sa_update
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db
from ...core import models, schemas
from ...core.bracket_programs import normalize_bowler_bracket_entries, normalize_bracket_programs, normalize_division
from ...services.payouts import reset_payouts_if_needed
from ...services.tournament_audit import record_tournament_event
from ...services.tournament_access import require_tournament_permission
from ...services.tournament_snapshots import create_restore_point

router = APIRouter()


def _user_can_manage_all(user: models.User) -> bool:
    return bool(getattr(user, "is_admin", False))


def _resolve_bowler_owner_id_for_tournament(
    db: Session,
    tournament_id: int,
    current_user: models.User,
) -> int:
    tournament = require_tournament_permission(db, tournament_id, current_user, "manage_entries")
    return tournament.user_id


def _get_accessible_bowler(
    db: Session,
    bowler_id: int,
    current_user: models.User,
) -> models.Bowler | None:
    bowler = db.query(models.Bowler).filter(models.Bowler.id == bowler_id).first()
    if bowler:
        require_tournament_permission(db, bowler.tournament_id, current_user, "manage_entries")
    return bowler


def _normalize_usbc(value: str | None) -> str | None:
    normalized = (value or "").strip()
    return normalized or None


def _split_full_name(full_name: str) -> tuple[str, str]:
    value = (full_name or "").strip()
    if not value:
        return "", ""

    if "," in value:
        parts = [segment.strip() for segment in value.split(",") if segment.strip()]
        if len(parts) >= 2:
            return parts[1], parts[0]

    tokens = [token for token in value.split() if token]
    if len(tokens) <= 1:
        return value, ""
    return tokens[0], " ".join(tokens[1:])


def _resolve_or_create_bowler_profile(
    db: Session,
    user_id: int,
    full_name: str,
    usbc_number: str | None,
) -> models.BowlerProfileModel | None:
    normalized_usbc = _normalize_usbc(usbc_number)
    if not normalized_usbc:
        return None

    first_name, last_name = _split_full_name(full_name)
    first_name = first_name.strip() or "Unknown"
    last_name = last_name.strip() or "Bowler"

    profile_query = db.query(models.BowlerProfileModel).filter(models.BowlerProfileModel.user_id == user_id)
    profile = profile_query.filter(models.BowlerProfileModel.usbc_number == normalized_usbc).first()

    if profile:
        if not profile.is_active:
            profile.is_active = True
            profile.archived_at = None
        if normalized_usbc and not profile.usbc_number:
            profile.usbc_number = normalized_usbc
        return profile

    profile = models.BowlerProfileModel(
        user_id=user_id,
        first_name=first_name,
        last_name=last_name,
        usbc_number=normalized_usbc,
        is_active=True,
        archived_at=None,
    )
    db.add(profile)
    db.flush()
    return profile


def _sync_player_identity_from_profile(db: Session, player: models.Bowler, profile: models.BowlerProfileModel) -> None:
    canonical_name = f"{profile.first_name} {profile.last_name}".strip()
    db.execute(
        sa_update(models.Bowler)
        .where(
            models.Bowler.user_id == player.user_id,
            models.Bowler.bowler_profile_id == profile.id,
        )
        .values(
            full_name=canonical_name,
            usbc_number=profile.usbc_number,
        )
        .execution_options(synchronize_session=False)
    )


# Returns players with total_cost field, calculated using default_entry_fee from TournamentBracketSettings
@router.get("")
def list_bowlers(
    db: Session = Depends(get_db),
    tournament_id: int = Query(None, description="Tournament ID to filter players and get default_entry_fee"),
    squad_id: int = Query(None, description="Squad ID to filter players by squad"),
    usbc_number: str | None = Query(None, description="Exact USBC number filter"),
    first_name: str | None = Query(None, description="Case-insensitive first-name contains filter"),
    last_name: str | None = Query(None, description="Case-insensitive last-name contains filter"),
    limit: int = Query(200, ge=1, le=500, description="Maximum number of players to return"),
    offset: int = Query(0, ge=0, description="Number of players to skip"),
    current_user: models.User = Depends(get_current_user)
):
    # Start with base query
    query = (
        db.query(models.Bowler)
        .outerjoin(
            models.BowlerProfileModel,
            models.BowlerProfileModel.id == models.Bowler.bowler_profile_id,
        )
    )

    # Filter by tournament if provided
    if tournament_id:
        require_tournament_permission(db, tournament_id, current_user, "view")
        query = query.filter(models.Bowler.tournament_id == tournament_id)

    # Filter by squad if provided
    if squad_id:
        query = query.filter(models.Bowler.squad_id == squad_id)

    # Non-admin users can only see their own players; admins can see all.
    if not tournament_id and not _user_can_manage_all(current_user):
        query = query.filter(models.Bowler.user_id == current_user.id)

    # Hide archived profiles by default, but keep legacy rows that have no profile yet.
    query = query.filter(
        (models.Bowler.bowler_profile_id.is_(None)) |
        (models.BowlerProfileModel.is_active.is_(True))
    )

    normalized_usbc = _normalize_usbc(usbc_number)
    if normalized_usbc:
        query = query.filter(models.BowlerProfileModel.usbc_number == normalized_usbc)
    if first_name:
        query = query.filter(func.lower(models.BowlerProfileModel.first_name).contains(first_name.strip().lower()))
    if last_name:
        query = query.filter(func.lower(models.BowlerProfileModel.last_name).contains(last_name.strip().lower()))

    players = query.order_by(models.Bowler.id.desc()).limit(limit).offset(offset).all()
    default_entry_fee = 0
    bracket_programs = None
    handicap_percentage = None
    handicap_base = None
    if tournament_id:
        settings = db.query(models.BracketSettings).filter(models.BracketSettings.tournament_id == tournament_id).first()
        if settings and settings.cost_per_bracket:
            default_entry_fee = settings.cost_per_bracket
        if settings:
            bracket_programs = settings.bracket_programs
            handicap_percentage = settings.handicap_percentage
            handicap_base = settings.handicap_base

    # Pre-compute normalized programs once — avoids O(N) normalize_bracket_programs calls
    normalized_programs = normalize_bracket_programs(bracket_programs, default_entry_fee)
    program_map = {p["key"]: p for p in normalized_programs}

    result = []
    for player in players:
        # Normalize entries once per player and reuse for both program_entry_counts and total_cost
        normalized_entries = normalize_bowler_bracket_entries(
            player.program_entry_counts,
            handicap_entries=player.handicap_entry_count,
            scratch_entries=player.scratch_entry_count,
        )
        total_cost = float(sum(
            Decimal(str(program_map.get(key, {}).get("entry_fee") or default_entry_fee or 0)) * count
            for key, count in normalized_entries.items()
            if count > 0
        ))
        # Compute per-game handicap from current tournament settings (avoids stale stored values)
        if player.average is not None and handicap_percentage is not None and handicap_base is not None:
            computed_handicap = max(0, int((handicap_base - player.average) * (handicap_percentage / 100)))
        else:
            computed_handicap = player.handicap_pins
        player_dict = {
            "id": player.id,
            "tournament_id": player.tournament_id,
            "squad_id": player.squad_id,
            "user_id": player.user_id,
            "bowler_profile_id": player.bowler_profile_id,
            "full_name": player.full_name,
            "average": player.average,
            "handicap_pins": computed_handicap,
            "handicap_entry_count": player.handicap_entry_count,
            "scratch_entry_count": player.scratch_entry_count,
            "program_entry_counts": normalized_entries,
            "side_pot_entries": player.side_pot_entries or {},
            "lane": player.lane,
            "division": normalize_division(player.division),
            "usbc_number": player.usbc_number,
            "amount_paid": player.amount_paid,
            "total_cost": total_cost
        }
        result.append(player_dict)
    return result


@router.get("/profiles", response_model=List[schemas.BowlerProfile])
def list_bowler_profiles(
    db: Session = Depends(get_db),
    usbc_number: str | None = Query(None, description="Exact USBC number filter"),
    first_name: str | None = Query(None, description="Case-insensitive first-name contains filter"),
    last_name: str | None = Query(None, description="Case-insensitive last-name contains filter"),
    include_inactive: bool = Query(False, description="Include archived profiles"),
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.BowlerProfileModel).filter(
        models.BowlerProfileModel.user_id == current_user.id,
        models.BowlerProfileModel.usbc_number.isnot(None),
        models.BowlerProfileModel.usbc_number != "",
    )

    if not include_inactive:
        query = query.filter(models.BowlerProfileModel.is_active.is_(True))

    normalized_usbc = _normalize_usbc(usbc_number)
    if normalized_usbc:
        query = query.filter(models.BowlerProfileModel.usbc_number == normalized_usbc)
    if first_name:
        query = query.filter(func.lower(models.BowlerProfileModel.first_name).contains(first_name.strip().lower()))
    if last_name:
        query = query.filter(func.lower(models.BowlerProfileModel.last_name).contains(last_name.strip().lower()))

    return query.order_by(models.BowlerProfileModel.last_name.asc(), models.BowlerProfileModel.first_name.asc(), models.BowlerProfileModel.id.asc()).limit(limit).offset(offset).all()


@router.post("/profiles/{profile_id}/archive")
def archive_bowler_profile(
    profile_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    profile = db.query(models.BowlerProfileModel).filter(
        models.BowlerProfileModel.id == profile_id,
        models.BowlerProfileModel.user_id == current_user.id,
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Bowler profile not found")

    profile.is_active = False
    profile.archived_at = datetime.now(timezone.utc)
    profile.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"id": profile.id, "is_active": profile.is_active}


@router.post("/profiles/{profile_id}/reactivate")
def reactivate_bowler_profile(
    profile_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    profile = db.query(models.BowlerProfileModel).filter(
        models.BowlerProfileModel.id == profile_id,
        models.BowlerProfileModel.user_id == current_user.id,
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Bowler profile not found")

    profile.is_active = True
    profile.archived_at = None
    profile.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"id": profile.id, "is_active": profile.is_active}

def _stage_bowler(db: Session, player: schemas.PlayerCreate, owner_user_id: int) -> models.TournamentPlayer:
    profile = _resolve_or_create_bowler_profile(
        db=db,
        user_id=owner_user_id,
        full_name=player.full_name,
        usbc_number=player.usbc_number,
    )
    first_name, last_name = _split_full_name(player.full_name)
    canonical_name = f"{(profile.first_name if profile else first_name).strip()} {(profile.last_name if profile else last_name).strip()}".strip() or player.full_name.strip()

    # Compute per-game handicap from current tournament settings
    handicap_pins = None
    if player.average is not None:
        t_settings = db.query(models.BracketSettings).filter(models.BracketSettings.tournament_id == player.tournament_id).first()
        if t_settings and t_settings.handicap_percentage is not None and t_settings.handicap_base is not None:
            handicap_pins = max(0, int((t_settings.handicap_base - player.average) * (t_settings.handicap_percentage / 100)))

    obj = models.TournamentPlayer(
        tournament_id=player.tournament_id,
        squad_id=player.squad_id,
        user_id=owner_user_id,
        bowler_profile_id=profile.id if profile else None,
        full_name=canonical_name,
        average=player.average,
        handicap_pins=handicap_pins,
        handicap_entry_count=player.handicap_entry_count,
        scratch_entry_count=player.scratch_entry_count,
        program_entry_counts=normalize_bowler_bracket_entries(
            player.program_entry_counts,
            handicap_entries=player.handicap_entry_count,
            scratch_entries=player.scratch_entry_count,
        ),
        side_pot_entries=player.side_pot_entries,
        lane=player.lane,
        division=normalize_division(player.division),
        usbc_number=profile.usbc_number if profile else _normalize_usbc(player.usbc_number),
        amount_paid=player.amount_paid or 0.0
    )
    db.add(obj)
    db.flush()
    return obj


@router.post("", response_model=schemas.Player)
def create_bowler(player: schemas.PlayerCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    owner_user_id = _resolve_bowler_owner_id_for_tournament(db, player.tournament_id, current_user)
    obj = _stage_bowler(db, player, owner_user_id)
    record_tournament_event(
        db,
        tournament_id=obj.tournament_id,
        event_type="player.added",
        user=current_user,
        summary=f"Added player {obj.full_name}",
        after_values={"full_name": obj.full_name, "average": obj.average, "squad_id": obj.squad_id},
        entity_type="player",
        entity_id=obj.id,
    )
    db.commit()
    db.refresh(obj)
    reset_payouts_if_needed(db, obj.tournament_id, obj.squad_id)
    db.commit()
    return obj


class ImportCommitRow(schemas.PlayerCreate):
    allow_duplicate: bool = False


class ImportCommitRequest(BaseModel):
    tournament_id: int
    squad_id: int | None = None
    file_name: str | None = Field(default=None, max_length=255)
    rows: List[ImportCommitRow] = Field(min_length=1, max_length=1000)


@router.post("/import-commit")
def commit_bowler_import(payload: ImportCommitRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    tournament = require_tournament_permission(db, payload.tournament_id, current_user, "manage_entries")
    owner_user_id = tournament.user_id
    normalized_seen: set[str] = set()
    existing = db.query(models.TournamentPlayer).filter(models.TournamentPlayer.tournament_id == payload.tournament_id).all()
    existing_keys = {
        f"usbc:{str(row.usbc_number).strip().lower()}" if row.usbc_number
        else f"name:{' '.join(row.full_name.lower().split())}"
        for row in existing
    }
    for index, row in enumerate(payload.rows, start=1):
        if row.tournament_id != payload.tournament_id or row.squad_id != payload.squad_id:
            raise HTTPException(status_code=422, detail=f"Import row {index} has mismatched tournament or squad")
        key = f"usbc:{str(row.usbc_number).strip().lower()}" if row.usbc_number else f"name:{' '.join(row.full_name.lower().split())}"
        if not row.allow_duplicate and (key in existing_keys or key in normalized_seen):
            raise HTTPException(status_code=409, detail=f"Import row {index} duplicates an existing or selected player")
        normalized_seen.add(key)

    create_restore_point(
        db, tournament_id=payload.tournament_id, user=current_user, trigger="entries.import",
        summary=f"Before importing {len(payload.rows)} entries",
    )
    created = [_stage_bowler(db, row, owner_user_id) for row in payload.rows]
    reset_payouts_if_needed(db, payload.tournament_id, payload.squad_id)
    record_tournament_event(
        db, tournament_id=payload.tournament_id, event_type="entries.imported", user=current_user,
        summary=f"Imported {len(created)} tournament entries",
        after_values={"created_count": len(created), "squad_id": payload.squad_id, "file_name": payload.file_name},
        entity_type="player",
    )
    db.commit()
    return {"created": len(created), "player_ids": [row.id for row in created]}


class DuplicateResolutionRequest(BaseModel):
    left_player_id: int
    right_player_id: int
    resolution: Literal["keep_both", "not_duplicate"]


class DuplicateMergeRequest(BaseModel):
    source_player_id: int
    target_player_id: int
    full_name: str | None = None
    usbc_number: str | None = None
    average: int | None = None
    reason: str = Field(min_length=1, max_length=1000)


def _pair(left_id: int, right_id: int) -> tuple[int, int]:
    return (left_id, right_id) if left_id < right_id else (right_id, left_id)


def _player_duplicate_payload(player: models.TournamentPlayer) -> dict:
    return {
        "id": player.id, "full_name": player.full_name, "usbc_number": player.usbc_number,
        "average": player.average, "squad_id": player.squad_id,
        "program_entry_counts": player.program_entry_counts or {}, "side_pot_entries": player.side_pot_entries or {},
        "amount_paid": float(player.amount_paid or 0), "lane": player.lane, "division": player.division,
    }


@router.get("/duplicates/{tournament_id}")
def list_duplicate_players(tournament_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_tournament_permission(db, tournament_id, current_user, "view")
    players = db.query(models.TournamentPlayer).filter_by(tournament_id=tournament_id).order_by(models.TournamentPlayer.id).all()
    resolved = {_pair(row.left_player_id, row.right_player_id) for row in db.query(models.DuplicatePlayerResolution).filter_by(tournament_id=tournament_id).all()}
    candidates = []
    for index, left in enumerate(players):
        for right in players[index + 1:]:
            pair = _pair(left.id, right.id)
            if pair in resolved:
                continue
            same_usbc = bool(left.usbc_number and right.usbc_number and left.usbc_number.strip().lower() == right.usbc_number.strip().lower())
            same_name = " ".join(left.full_name.lower().split()) == " ".join(right.full_name.lower().split())
            if not same_usbc and not same_name:
                continue
            candidates.append({
                "pair_key": f"{pair[0]}:{pair[1]}", "reason": "Matching USBC number" if same_usbc else "Matching player name",
                "can_merge": left.squad_id == right.squad_id, "left": _player_duplicate_payload(left), "right": _player_duplicate_payload(right),
            })
    return {"count": len(candidates), "candidates": candidates}


@router.post("/duplicates/{tournament_id}/resolve")
def resolve_duplicate_players(tournament_id: int, payload: DuplicateResolutionRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_tournament_permission(db, tournament_id, current_user, "manage_entries")
    left_id, right_id = _pair(payload.left_player_id, payload.right_player_id)
    players = db.query(models.TournamentPlayer).filter(models.TournamentPlayer.tournament_id == tournament_id, models.TournamentPlayer.id.in_([left_id, right_id])).all()
    if len(players) != 2:
        raise HTTPException(status_code=404, detail="Duplicate candidate players were not found")
    existing = db.query(models.DuplicatePlayerResolution).filter_by(
        tournament_id=tournament_id, left_player_id=left_id, right_player_id=right_id,
    ).first()
    if existing:
        existing.resolution = payload.resolution
        existing.resolved_by_user_id = current_user.id
        resolution = existing
    else:
        resolution = models.DuplicatePlayerResolution(
            tournament_id=tournament_id, left_player_id=left_id, right_player_id=right_id,
            resolution=payload.resolution, resolved_by_user_id=current_user.id,
        )
    db.add(resolution)
    record_tournament_event(
        db, tournament_id=tournament_id, event_type=f"players.duplicate_{payload.resolution}", user=current_user,
        summary="Kept both player records" if payload.resolution == "keep_both" else "Marked players as not duplicates",
        after_values={"left_player_id": left_id, "right_player_id": right_id, "resolution": payload.resolution}, entity_type="player",
    )
    db.commit()
    return {"status": payload.resolution}


def _replace_snapshot_player_ids(value: Any, source_id: int, target_id: int, key: str | None = None) -> Any:
    if isinstance(value, dict):
        return {item_key: _replace_snapshot_player_ids(item_value, source_id, target_id, item_key) for item_key, item_value in value.items()}
    if isinstance(value, list):
        return [_replace_snapshot_player_ids(item, source_id, target_id, key) for item in value]
    if key in {"player_id", "playerA_id", "playerB_id", "bowler_id"} and value == source_id:
        return target_id
    return value


@router.post("/duplicates/{tournament_id}/merge")
def merge_duplicate_players(tournament_id: int, payload: DuplicateMergeRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_tournament_permission(db, tournament_id, current_user, "manage_entries")
    if payload.source_player_id == payload.target_player_id:
        raise HTTPException(status_code=422, detail="Choose two different player records")
    source = db.query(models.TournamentPlayer).filter_by(id=payload.source_player_id, tournament_id=tournament_id).first()
    target = db.query(models.TournamentPlayer).filter_by(id=payload.target_player_id, tournament_id=tournament_id).first()
    if not source or not target:
        raise HTTPException(status_code=404, detail="Player record not found")
    if source.squad_id != target.squad_id:
        raise HTTPException(status_code=409, detail="Entries in different squads must be kept as separate records")

    source_score = db.query(models.PlayerScore).filter_by(player_id=source.id, tournament_id=tournament_id).first()
    target_score = db.query(models.PlayerScore).filter_by(player_id=target.id, tournament_id=tournament_id).first()
    if source_score and target_score:
        conflicts = [field for field in ("game1_scratch", "game2_scratch", "game3_scratch") if getattr(source_score, field) is not None and getattr(target_score, field) is not None and getattr(source_score, field) != getattr(target_score, field)]
        if conflicts:
            raise HTTPException(status_code=409, detail="Score conflicts must be resolved before merging: " + ", ".join(conflicts))

    create_restore_point(db, tournament_id=tournament_id, user=current_user, trigger="players.merge", summary=f"Before merging {source.full_name} into {target.full_name}")
    before_values = {"source": _player_duplicate_payload(source), "target": _player_duplicate_payload(target)}
    source_entries = normalize_bowler_bracket_entries(source.program_entry_counts, source.handicap_entry_count, source.scratch_entry_count)
    target_entries = normalize_bowler_bracket_entries(target.program_entry_counts, target.handicap_entry_count, target.scratch_entry_count)
    combined_entries = {key: source_entries.get(key, 0) + target_entries.get(key, 0) for key in set(source_entries) | set(target_entries)}
    target.program_entry_counts = combined_entries
    target.handicap_entry_count = combined_entries.get("handicap", 0)
    target.scratch_entry_count = combined_entries.get("scratch", 0)
    target.side_pot_entries = {key: bool((source.side_pot_entries or {}).get(key) or (target.side_pot_entries or {}).get(key)) for key in set(source.side_pot_entries or {}) | set(target.side_pot_entries or {})}
    target.amount_paid = round(float(source.amount_paid or 0) + float(target.amount_paid or 0), 2)
    target.full_name = (payload.full_name or target.full_name or source.full_name).strip()
    target.usbc_number = _normalize_usbc(payload.usbc_number if payload.usbc_number is not None else (target.usbc_number or source.usbc_number))
    target.average = payload.average if payload.average is not None else (target.average if target.average is not None else source.average)
    target.lane = target.lane or source.lane
    target.division = target.division or source.division
    target.bowler_profile_id = target.bowler_profile_id or source.bowler_profile_id

    if source_score:
        if target_score:
            for field in ("game1_scratch", "game1_with_handicap", "game2_scratch", "game2_with_handicap", "game3_scratch", "game3_with_handicap"):
                if getattr(target_score, field) is None:
                    setattr(target_score, field, getattr(source_score, field))
            db.query(models.ScoreCorrection).filter_by(score_id=source_score.id).update({"score_id": target_score.id, "player_id": target.id}, synchronize_session=False)
            db.delete(source_score)
        else:
            source_score.player_id = target.id
            db.query(models.ScoreCorrection).filter_by(score_id=source_score.id).update({"player_id": target.id}, synchronize_session=False)

    db.query(models.BracketWinner).filter_by(tournament_id=tournament_id, player_id=source.id).update({"player_id": target.id, "player_name": target.full_name}, synchronize_session=False)
    db.query(models.BracketPayout).filter_by(tournament_id=tournament_id, player_id=source.id).update({"player_id": target.id, "player_name": target.full_name}, synchronize_session=False)
    matchup_rows = db.query(models.FirstRoundMatchupHistory).filter(models.FirstRoundMatchupHistory.tournament_id == tournament_id).all()
    for row in matchup_rows:
        next_left = target.id if row.left_player_id == source.id else row.left_player_id
        next_right = target.id if row.right_player_id == source.id else row.right_player_id
        if next_left == next_right:
            db.delete(row)
        else:
            row.left_player_id, row.right_player_id = next_left, next_right
    for snapshot in db.query(models.BracketSnapshot).filter_by(tournament_id=tournament_id).all():
        snapshot.payload = _replace_snapshot_player_ids(snapshot.payload, source.id, target.id)
    db.query(models.DuplicatePlayerResolution).filter(
        models.DuplicatePlayerResolution.tournament_id == tournament_id,
        ((models.DuplicatePlayerResolution.left_player_id == source.id) | (models.DuplicatePlayerResolution.right_player_id == source.id)),
    ).delete(synchronize_session=False)
    db.delete(source)
    reset_payouts_if_needed(db, tournament_id, target.squad_id)
    record_tournament_event(
        db, tournament_id=tournament_id, event_type="players.merged", user=current_user,
        summary=f"Merged {source.full_name} into {target.full_name}", reason=payload.reason.strip(),
        before_values=before_values, after_values={"target": _player_duplicate_payload(target), "removed_player_id": source.id},
        entity_type="player", entity_id=target.id,
    )
    db.commit()
    return {"target": _player_duplicate_payload(target), "removed_player_id": payload.source_player_id}


class BulkBowlerUpdate(BaseModel):
    id: int
    full_name: str | None = None
    average: int | None = None
    handicap_entry_count: int | None = None
    scratch_entry_count: int | None = None
    program_entry_counts: dict[str, int] | None = None
    side_pot_entries: dict[str, bool] | None = None
    lane: str | None = None
    division: str | None = None
    usbc_number: str | None = None
    amount_paid: float | None = None


# Bulk PATCH must be registered before /{bowler_id} to avoid route shadowing
@router.patch("/bulk-update")
def bulk_update_bowlers(
    updates: List[BulkBowlerUpdate],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not updates:
        return {"updated": 0}

    count = 0
    changed_tournament_ids: set[int] = set()
    reset_tournament_id: int | None = None
    reset_squad_id: int | None = None
    for item in updates:
        data = {k: v for k, v in item.model_dump(exclude_unset=True).items() if k != "id" and v is not None}
        if "division" in data:
            data["division"] = normalize_division(data["division"])
        if not data:
            continue

        bowler = _get_accessible_bowler(db, item.id, current_user)
        if not bowler:
            continue

        if reset_tournament_id is None:
            reset_tournament_id = bowler.tournament_id
            reset_squad_id = bowler.squad_id
        changed_tournament_ids.add(bowler.tournament_id)

        identity_changed = ("full_name" in data) or ("usbc_number" in data)
        profile_to_sync: models.BowlerProfileModel | None = None
        if identity_changed:
            desired_full_name = data.get("full_name", bowler.full_name)
            desired_usbc = _normalize_usbc(data.get("usbc_number", bowler.usbc_number))

            if desired_usbc:
                profile = _resolve_or_create_bowler_profile(
                    db=db,
                    user_id=bowler.user_id,
                    full_name=desired_full_name,
                    usbc_number=desired_usbc,
                )
                if profile:
                    first_name, last_name = _split_full_name(desired_full_name)
                    profile.first_name = first_name.strip() or profile.first_name or "Unknown"
                    profile.last_name = last_name.strip() or profile.last_name or "Bowler"
                    profile.usbc_number = desired_usbc
                    profile.updated_at = datetime.now(timezone.utc)
                    data.pop("full_name", None)
                    data["usbc_number"] = profile.usbc_number
                    data["bowler_profile_id"] = profile.id
                    profile_to_sync = profile
            else:
                # Entries without USBC stay outside global profile records.
                data["usbc_number"] = None
                data["bowler_profile_id"] = None

        # Recompute handicap_pins when average is updated
        if "average" in data and data["average"] is not None:
            t_settings = db.query(models.BracketSettings).filter(models.BracketSettings.tournament_id == bowler.tournament_id).first()
            if t_settings and t_settings.handicap_percentage is not None and t_settings.handicap_base is not None:
                data["handicap_pins"] = max(0, int((t_settings.handicap_base - data["average"]) * (t_settings.handicap_percentage / 100)))

        if data:
            statement = sa_update(models.Bowler).where(models.Bowler.id == item.id)
            db.execute(
                statement
                .values(**data)
                .execution_options(synchronize_session=False)
            )

        if profile_to_sync:
            _sync_player_identity_from_profile(db, bowler, profile_to_sync)

        count += 1

    if count > 0 and reset_tournament_id is not None:
        reset_payouts_if_needed(db, reset_tournament_id, reset_squad_id)
        for tournament_id in changed_tournament_ids:
            record_tournament_event(
                db,
                tournament_id=tournament_id,
                event_type="players.bulk_updated",
                user=current_user,
                summary=f"Updated {count} player records",
                after_values={"updated_count": count},
                entity_type="player",
            )
    db.commit()
    return {"updated": count}


# PATCH endpoint to update bowler fields — single UPDATE statement, no extra SELECT
@router.patch("/{bowler_id}")
def update_bowler(
    bowler_id: int,
    player: schemas.PlayerUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    update_data = {k: v for k, v in player.model_dump(exclude_unset=True).items() if v is not None}
    if "division" in update_data:
        update_data["division"] = normalize_division(update_data["division"])
    if not update_data:
        return {"id": bowler_id}

    bowler = _get_accessible_bowler(db, bowler_id, current_user)
    if not bowler:
        raise HTTPException(status_code=404, detail="Bowler not found or access denied")
    before_values = {
        key: getattr(bowler, key, None)
        for key in update_data
        if key not in {"bowler_profile_id", "handicap_pins"}
    }

    if "full_name" in update_data or "usbc_number" in update_data:
        desired_full_name = update_data.get("full_name", bowler.full_name)
        desired_usbc = _normalize_usbc(update_data.get("usbc_number", bowler.usbc_number))

        if desired_usbc:
            profile = _resolve_or_create_bowler_profile(
                db=db,
                user_id=bowler.user_id,
                full_name=desired_full_name,
                usbc_number=desired_usbc,
            )
            if profile:
                first_name, last_name = _split_full_name(desired_full_name)
                profile.first_name = first_name.strip() or profile.first_name or "Unknown"
                profile.last_name = last_name.strip() or profile.last_name or "Bowler"
                profile.usbc_number = desired_usbc
                profile.updated_at = datetime.now(timezone.utc)
                update_data["bowler_profile_id"] = profile.id
                update_data["usbc_number"] = profile.usbc_number
                update_data.pop("full_name", None)
                _sync_player_identity_from_profile(db, bowler, profile)
        else:
            update_data["usbc_number"] = None
            update_data["bowler_profile_id"] = None

    # Recompute handicap_pins when average is updated
    if "average" in update_data and update_data["average"] is not None:
        t_settings = db.query(models.BracketSettings).filter(models.BracketSettings.tournament_id == bowler.tournament_id).first()
        if t_settings and t_settings.handicap_percentage is not None and t_settings.handicap_base is not None:
            update_data["handicap_pins"] = max(0, int((t_settings.handicap_base - update_data["average"]) * (t_settings.handicap_percentage / 100)))

    statement = sa_update(models.Bowler).where(models.Bowler.id == bowler_id)
    result = db.execute(statement.values(**update_data))
    changed_fields = set(update_data)
    if "amount_paid" in changed_fields:
        event_type = "player.payment_status_changed"
        summary = f"Updated payment for {bowler.full_name}"
    elif "side_pot_entries" in changed_fields:
        event_type = "player.side_pot_entry_changed"
        summary = f"Updated side-pot entries for {bowler.full_name}"
    else:
        event_type = "player.updated"
        summary = f"Updated player {bowler.full_name}"
    record_tournament_event(
        db,
        tournament_id=bowler.tournament_id,
        event_type=event_type,
        user=current_user,
        summary=summary,
        before_values=before_values,
        after_values={key: value for key, value in update_data.items() if key not in {"bowler_profile_id", "handicap_pins"}},
        entity_type="player",
        entity_id=bowler_id,
    )
    db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Bowler not found or access denied")

    reset_payouts_if_needed(db, bowler.tournament_id, bowler.squad_id)
    db.commit()
    return {"id": bowler_id}

@router.delete("/{bowler_id}")
def delete_bowler(bowler_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    bowler = _get_accessible_bowler(db, bowler_id, current_user)
    if not bowler:
        raise HTTPException(status_code=404, detail="Bowler not found or access denied")

    bowler_tournament_id = bowler.tournament_id
    bowler_squad_id = bowler.squad_id
    bowler_name = bowler.full_name
    reset_payouts_if_needed(db, bowler_tournament_id, bowler_squad_id)
    # Delete FK-dependent records first
    db.query(models.BracketPayout).filter(models.BracketPayout.player_id == bowler_id).delete()
    db.query(models.BracketWinner).filter(models.BracketWinner.player_id == bowler_id).delete()
    db.query(models.PlayerScore).filter(models.PlayerScore.player_id == bowler_id).delete()
    db.query(models.FirstRoundMatchupHistory).filter(
        (models.FirstRoundMatchupHistory.left_player_id == bowler_id) |
        (models.FirstRoundMatchupHistory.right_player_id == bowler_id)
    ).delete(synchronize_session=False)

    profile_id = bowler.bowler_profile_id
    db.delete(bowler)

    if profile_id is not None:
        remaining = db.query(models.Bowler.id).filter(
            models.Bowler.user_id == bowler.user_id,
            models.Bowler.bowler_profile_id == profile_id,
        ).first()
        if not remaining:
            profile = db.query(models.BowlerProfileModel).filter(
                models.BowlerProfileModel.id == profile_id,
                models.BowlerProfileModel.user_id == bowler.user_id,
            ).first()
            if profile:
                profile.is_active = False
                profile.archived_at = datetime.now(timezone.utc)
                profile.updated_at = datetime.now(timezone.utc)

    record_tournament_event(
        db,
        tournament_id=bowler_tournament_id,
        event_type="player.deleted",
        user=current_user,
        summary=f"Deleted player {bowler_name}",
        before_values={"full_name": bowler_name, "squad_id": bowler_squad_id},
        entity_type="player",
        entity_id=bowler_id,
    )

    db.commit()
    return {"message": "Bowler deleted successfully"}
