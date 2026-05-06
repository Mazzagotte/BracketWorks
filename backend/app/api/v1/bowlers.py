
from datetime import datetime
from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, update as sa_update
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db
from ...core import models, schemas
from ...core.bracket_programs import normalize_bowler_bracket_entries, normalize_bracket_programs, normalize_division

router = APIRouter()


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
        query = query.filter(models.Bowler.tournament_id == tournament_id)

    # Filter by squad if provided
    if squad_id:
        query = query.filter(models.Bowler.squad_id == squad_id)

    # Filter by current user (users can only see their own players)
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
    if tournament_id:
        settings = db.query(models.BracketSettings).filter(models.BracketSettings.tournament_id == tournament_id).first()
        if settings and settings.cost_per_bracket:
            default_entry_fee = settings.cost_per_bracket
        if settings:
            bracket_programs = settings.bracket_programs

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
        player_dict = {
            "id": player.id,
            "tournament_id": player.tournament_id,
            "squad_id": player.squad_id,
            "user_id": player.user_id,
            "bowler_profile_id": player.bowler_profile_id,
            "full_name": player.full_name,
            "average": player.average,
            "handicap_pins": player.handicap_pins,
            "handicap_entry_count": player.handicap_entry_count,
            "scratch_entry_count": player.scratch_entry_count,
            "program_entry_counts": normalized_entries,
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
    profile.archived_at = datetime.utcnow()
    profile.updated_at = datetime.utcnow()
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
    profile.updated_at = datetime.utcnow()
    db.commit()
    return {"id": profile.id, "is_active": profile.is_active}

@router.post("")
def create_bowler(player: schemas.PlayerCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    profile = _resolve_or_create_bowler_profile(
        db=db,
        user_id=current_user.id,
        full_name=player.full_name,
        usbc_number=player.usbc_number,
    )
    first_name, last_name = _split_full_name(player.full_name)
    canonical_name = f"{(profile.first_name if profile else first_name).strip()} {(profile.last_name if profile else last_name).strip()}".strip() or player.full_name.strip()

    obj = models.TournamentPlayer(
        tournament_id=player.tournament_id,
        squad_id=player.squad_id,
        user_id=current_user.id,
        bowler_profile_id=profile.id if profile else None,
        full_name=canonical_name,
        average=player.average,
        handicap_entry_count=player.handicap_entry_count,
        scratch_entry_count=player.scratch_entry_count,
        program_entry_counts=normalize_bowler_bracket_entries(
            player.program_entry_counts,
            handicap_entries=player.handicap_entry_count,
            scratch_entries=player.scratch_entry_count,
        ),
        lane=player.lane,
        division=normalize_division(player.division),
        usbc_number=profile.usbc_number if profile else _normalize_usbc(player.usbc_number),
        amount_paid=player.amount_paid or 0.0
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


class BulkBowlerUpdate(BaseModel):
    id: int
    full_name: str | None = None
    average: int | None = None
    handicap_entry_count: int | None = None
    scratch_entry_count: int | None = None
    program_entry_counts: dict[str, int] | None = None
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
    for item in updates:
        data = {k: v for k, v in item.model_dump(exclude_unset=True).items() if k != "id" and v is not None}
        if "division" in data:
            data["division"] = normalize_division(data["division"])
        if not data:
            continue

        bowler = db.query(models.Bowler).filter(
            models.Bowler.id == item.id,
            models.Bowler.user_id == current_user.id,
        ).first()
        if not bowler:
            continue

        identity_changed = ("full_name" in data) or ("usbc_number" in data)
        profile_to_sync: models.BowlerProfileModel | None = None
        if identity_changed:
            desired_full_name = data.get("full_name", bowler.full_name)
            desired_usbc = _normalize_usbc(data.get("usbc_number", bowler.usbc_number))

            if desired_usbc:
                profile = _resolve_or_create_bowler_profile(
                    db=db,
                    user_id=current_user.id,
                    full_name=desired_full_name,
                    usbc_number=desired_usbc,
                )
                if profile:
                    first_name, last_name = _split_full_name(desired_full_name)
                    profile.first_name = first_name.strip() or profile.first_name or "Unknown"
                    profile.last_name = last_name.strip() or profile.last_name or "Bowler"
                    profile.usbc_number = desired_usbc
                    profile.updated_at = datetime.utcnow()
                    data.pop("full_name", None)
                    data["usbc_number"] = profile.usbc_number
                    data["bowler_profile_id"] = profile.id
                    profile_to_sync = profile
            else:
                # Entries without USBC stay outside global profile records.
                data["usbc_number"] = None
                data["bowler_profile_id"] = None

        if data:
            db.execute(
                sa_update(models.Bowler)
                .where(models.Bowler.id == item.id, models.Bowler.user_id == current_user.id)
                .values(**data)
                .execution_options(synchronize_session=False)
            )

        if profile_to_sync:
            _sync_player_identity_from_profile(db, bowler, profile_to_sync)

        count += 1

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

    bowler = db.query(models.Bowler).filter(
        models.Bowler.id == bowler_id,
        models.Bowler.user_id == current_user.id,
    ).first()
    if not bowler:
        raise HTTPException(status_code=404, detail="Bowler not found or access denied")

    if "full_name" in update_data or "usbc_number" in update_data:
        desired_full_name = update_data.get("full_name", bowler.full_name)
        desired_usbc = _normalize_usbc(update_data.get("usbc_number", bowler.usbc_number))

        if desired_usbc:
            profile = _resolve_or_create_bowler_profile(
                db=db,
                user_id=current_user.id,
                full_name=desired_full_name,
                usbc_number=desired_usbc,
            )
            if profile:
                first_name, last_name = _split_full_name(desired_full_name)
                profile.first_name = first_name.strip() or profile.first_name or "Unknown"
                profile.last_name = last_name.strip() or profile.last_name or "Bowler"
                profile.usbc_number = desired_usbc
                profile.updated_at = datetime.utcnow()
                update_data["bowler_profile_id"] = profile.id
                update_data["usbc_number"] = profile.usbc_number
                update_data.pop("full_name", None)
                _sync_player_identity_from_profile(db, bowler, profile)
        else:
            update_data["usbc_number"] = None
            update_data["bowler_profile_id"] = None

    result = db.execute(
        sa_update(models.Bowler)
        .where(models.Bowler.id == bowler_id, models.Bowler.user_id == current_user.id)
        .values(**update_data)
    )
    db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Bowler not found or access denied")

    return {"id": bowler_id}

@router.delete("/{bowler_id}")
def delete_bowler(bowler_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    bowler = db.query(models.Bowler).filter(
        models.Bowler.id == bowler_id,
        models.Bowler.user_id == current_user.id
    ).first()
    if not bowler:
        raise HTTPException(status_code=404, detail="Bowler not found or access denied")

    bowler_id = bowler.id
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
            models.Bowler.user_id == current_user.id,
            models.Bowler.bowler_profile_id == profile_id,
        ).first()
        if not remaining:
            profile = db.query(models.BowlerProfileModel).filter(
                models.BowlerProfileModel.id == profile_id,
                models.BowlerProfileModel.user_id == current_user.id,
            ).first()
            if profile:
                profile.is_active = False
                profile.archived_at = datetime.utcnow()
                profile.updated_at = datetime.utcnow()

    db.commit()
    return {"message": "Bowler deleted successfully"}
