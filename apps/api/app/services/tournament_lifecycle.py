from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core import models


def advance_status(db: Session, tournament_id: int, status: str) -> None:
    tournament = db.get(models.Tournament, tournament_id)
    if not tournament or tournament.archived_at or tournament.lifecycle_status == "finalized":
        return
    order = {"setup": 0, "ready": 1, "in_progress": 2, "scores_complete": 3, "payout_review": 4}
    if order.get(status, -1) > order.get(tournament.lifecycle_status, -1):
        tournament.lifecycle_status = status


def refresh_score_completion(db: Session, tournament_id: int, squad_id: int | None) -> None:
    players = db.query(func.count(models.TournamentPlayer.id)).filter(models.TournamentPlayer.tournament_id == tournament_id)
    scores = db.query(func.count(models.PlayerScore.id)).filter(
        models.PlayerScore.tournament_id == tournament_id,
        models.PlayerScore.game1_scratch.isnot(None),
        models.PlayerScore.game2_scratch.isnot(None),
        models.PlayerScore.game3_scratch.isnot(None),
    )
    if squad_id is not None:
        players = players.filter(models.TournamentPlayer.squad_id == squad_id)
        scores = scores.filter(models.PlayerScore.squad_id == squad_id)
    player_count, complete_count = players.scalar() or 0, scores.scalar() or 0
    advance_status(db, tournament_id, "scores_complete" if player_count > 0 and complete_count >= player_count else "in_progress")
