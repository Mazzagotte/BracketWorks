from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from ...core import models, schemas
from ...api import deps
import json

router = APIRouter()

@router.post("/", response_model=schemas.Tournament)
def create_tournament(tournament: schemas.TournamentCreate, db: Session = Depends(deps.get_db)):
    db_tournament = models.Tournament(
        name=tournament.name,
        location=tournament.location,
        start_date=tournament.start_date,
        end_date=tournament.end_date,
        squad_times=json.dumps(tournament.squad_times)
    )
    db.add(db_tournament)
    db.commit()
    db.refresh(db_tournament)
    # squad_times is already stored as JSON string in the DB; no need to assign the dict here
    # Parse squad_times before returning for API response
    result = db_tournament.__dict__.copy()
    result['squad_times'] = tournament.squad_times
    return result

@router.get("/", response_model=list[schemas.Tournament])
def list_tournaments(db: Session = Depends(deps.get_db)):
    tournaments = db.query(models.Tournament).all()
    # Build response with squad_times parsed as dict
    result = []
    for t in tournaments:
        t_dict = t.__dict__.copy()
        if t.squad_times:
            t_dict['squad_times'] = json.loads(t.squad_times)
        else:
            t_dict['squad_times'] = {}
        result.append(t_dict)
    return result

@router.get("/{tournament_id}", response_model=schemas.Tournament)
def get_tournament(tournament_id: int, db: Session = Depends(deps.get_db)):
    t = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    t_dict = t.__dict__.copy()
    if t.squad_times:
        t_dict['squad_times'] = json.loads(t.squad_times)
    else:
        t_dict['squad_times'] = {}
    return t_dict

@router.put("/{tournament_id}", response_model=schemas.Tournament)
def update_tournament(tournament_id: int, tournament: schemas.TournamentUpdate, db: Session = Depends(deps.get_db)):
    db_t = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
    if not db_t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    db_t.name = tournament.name
    if tournament.location is not None:
        db_t.location = tournament.location
    if tournament.start_date is not None:
        db_t.start_date = tournament.start_date
    if tournament.end_date is not None:
        db_t.end_date = tournament.end_date
    db_t.squad_times = json.dumps(tournament.squad_times)
    db.commit()
    db.refresh(db_t)
    # Parse squad_times before returning for API response
    result = db_t.__dict__.copy()
    result['squad_times'] = tournament.squad_times
    return result

@router.delete("/{tournament_id}")
def delete_tournament(tournament_id: int, db: Session = Depends(deps.get_db)):
    db_t = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()
    if not db_t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    db.delete(db_t)
    db.commit()
    return {"ok": True}
