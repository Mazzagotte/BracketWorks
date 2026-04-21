
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..deps import get_db
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("")
def read_health():
    return {"status": "ok"}

@router.get("/db")
def read_db_health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {"status": "error", "database": "disconnected", "detail": str(e)}
