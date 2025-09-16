
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..deps import get_db
from ...core import models, schemas

router = APIRouter()

@router.get("")
def list_bowlers(db: Session = Depends(get_db)):
    return db.query(models.Bowler).order_by(models.Bowler.id.desc()).all()

@router.post("")
def create_bowler(bowler: schemas.BowlerCreate, db: Session = Depends(get_db)):
    obj = models.Bowler(name=bowler.name, average=bowler.average)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj
