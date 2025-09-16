
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..deps import get_db
from ...core import models, schemas
from ...services.brackets import generate_bracket_preview

router = APIRouter()

@router.get("")
def list_brackets(db: Session = Depends(get_db)):
    return db.query(models.Bracket).order_by(models.Bracket.id.desc()).all()

@router.post("")
def create_bracket(bracket: schemas.BracketCreate, db: Session = Depends(get_db)):
    obj = models.Bracket(name=bracket.name, squad=bracket.squad, game_count=bracket.game_count)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

@router.get("/preview")
def preview(bracket_size: int = 8):
    return generate_bracket_preview(bracket_size)
