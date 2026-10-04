from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..core.models import TournamentCentral

DUPLICATE_PUBLISHED_TOURNAMENT_NAME = "You already have a published tournament with this name. Choose a different name."
PUBLISHED_TOURNAMENT_NAME_INDEX = "uq_tc_tournaments_owner_published_name"


def has_duplicate_published_tournament_name(
    db: Session,
    *,
    user_id: int,
    name: str,
    exclude_tournament_id: int | None = None,
) -> bool:
    normalized_name = name.strip().lower()
    if not normalized_name:
        return False

    query = db.query(TournamentCentral.id).filter(
        TournamentCentral.user_id == user_id,
        or_(TournamentCentral.is_public.is_(True), TournamentCentral.is_published.is_(True)),
        func.lower(func.trim(TournamentCentral.name)) == normalized_name,
    )
    if exclude_tournament_id is not None:
        query = query.filter(TournamentCentral.id != exclude_tournament_id)

    return query.first() is not None


def is_published_tournament_name_unique_violation(error: Exception) -> bool:
    return PUBLISHED_TOURNAMENT_NAME_INDEX in str(getattr(error, "orig", error))