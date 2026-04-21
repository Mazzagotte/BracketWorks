

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import update as sa_update, text
from typing import List
from collections import defaultdict
from pydantic import BaseModel
from ..deps import get_db, get_current_user
from ...core import models, schemas

router = APIRouter()


# Returns bowlers with total_cost field, calculated using cost_per_bracket from BracketSettings
@router.get("")
def list_bowlers(
    db: Session = Depends(get_db),
    tournament_id: int = Query(None, description="Tournament ID to filter bowlers and get cost_per_bracket"),
    squad_id: int = Query(None, description="Squad ID to filter bowlers by squad"),
    limit: int = Query(200, ge=1, le=500, description="Maximum number of bowlers to return"),
    offset: int = Query(0, ge=0, description="Number of bowlers to skip"),
    current_user: models.User = Depends(get_current_user)
):
    # Start with base query
    query = db.query(models.Bowler)

    # Filter by tournament if provided
    if tournament_id:
        query = query.filter(models.Bowler.tournament_id == tournament_id)

    # Filter by squad if provided
    if squad_id:
        query = query.filter(models.Bowler.squad_id == squad_id)

    # Filter by current user (users can only see their own bowlers)
    query = query.filter(models.Bowler.user_id == current_user.id)

    bowlers = query.order_by(models.Bowler.id.desc()).limit(limit).offset(offset).all()
    cost_per_bracket = 0
    if tournament_id:
        settings = db.query(models.BracketSettings).filter(models.BracketSettings.tournament_id == tournament_id).first()
        if settings and settings.cost_per_bracket:
            cost_per_bracket = settings.cost_per_bracket
    result = []
    for b in bowlers:
        total_cost = ((b.handicap_entries or 0) + (b.scratch_entries or 0)) * cost_per_bracket
        b_dict = {
            "id": b.id,
            "tournament_id": b.tournament_id,
            "squad_id": b.squad_id,
            "user_id": b.user_id,
            "name": b.name,
            "average": b.average,
            "handicap_entries": b.handicap_entries,
            "scratch_entries": b.scratch_entries,
            "lane": b.lane,
            "division": b.division,
            "usbc": b.usbc,
            "amount_paid": b.amount_paid,
            "total_cost": total_cost
        }
        result.append(b_dict)
    return result

@router.post("")
def create_bowler(bowler: schemas.BowlerCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    obj = models.Bowler(
        tournament_id=bowler.tournament_id,
        squad_id=bowler.squad_id,
        user_id=bowler.user_id,
        name=bowler.name, 
        average=bowler.average,
        handicap_entries=bowler.handicap,
        scratch_entries=bowler.scratch,
        lane=bowler.lane,
        division=bowler.division or 'Open',
        usbc=bowler.usbc,
        amount_paid=bowler.amount_paid or 0.0
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


class BulkBowlerUpdate(BaseModel):
    id: int
    name: str | None = None
    average: int | None = None
    handicap_entries: int | None = None
    scratch_entries: int | None = None
    lane: str | None = None
    division: str | None = None
    usbc: str | None = None
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

    # Group rows by which fields are being set — one UPDATE...FROM VALUES per group
    groups: dict = defaultdict(list)
    for item in updates:
        data = {k: v for k, v in item.model_dump(exclude_unset=True).items() if k != "id" and v is not None}
        if data:
            groups[frozenset(data.keys())].append({"id": item.id, **data})

    if not groups:
        return {"updated": 0}

    total = 0
    for field_set, rows in groups.items():
        fields = sorted(field_set)
        params: dict = {"user_id": current_user.id}
        value_tuples = []
        for i, row in enumerate(rows):
            parts = [f":id_{i}"]
            params[f"id_{i}"] = row["id"]
            for f in fields:
                params[f"{f}_{i}"] = row[f]
                parts.append(f":{f}_{i}")
            value_tuples.append(f"({', '.join(parts)})")

        set_clause = ", ".join(f"{f} = v.{f}" for f in fields)
        col_names = ", ".join(["id"] + fields)
        sql = text(f"""
            UPDATE bowlers
            SET {set_clause}
            FROM (VALUES {', '.join(value_tuples)}) AS v({col_names})
            WHERE bowlers.id = v.id::int AND bowlers.user_id = :user_id
        """)
        result = db.execute(sql, params)
        total += result.rowcount

    db.commit()
    return {"updated": total}


# PATCH endpoint to update bowler fields — single UPDATE statement, no extra SELECT
@router.patch("/{bowler_id}")
def update_bowler(
    bowler_id: int,
    bowler: schemas.BowlerUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    update_data = {k: v for k, v in bowler.model_dump(exclude_unset=True).items() if v is not None}
    if not update_data:
        return {"id": bowler_id}

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
    
    db.delete(bowler)
    db.commit()
    return {"message": "Bowler deleted successfully"}
