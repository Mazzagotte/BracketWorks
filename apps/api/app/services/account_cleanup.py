from datetime import datetime, timedelta, timezone
import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core import models
from ..core.config import settings

logger = logging.getLogger(__name__)


def deactivate_stale_unverified_accounts(db: Session) -> int:
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=settings.UNVERIFIED_ACCOUNT_RETENTION_DAYS)
    candidates = db.scalars(
        select(models.User).where(
            models.User.is_active.is_(True),
            models.User.email_verified_at.is_(None),
            models.User.created_at < cutoff,
            ~select(models.AuthSession.id).where(models.AuthSession.user_id == models.User.id).exists(),
        )
    ).all()
    if not candidates:
        return 0

    user_ids = [user.id for user in candidates]
    db.execute(
        models.AuthSession.__table__.update()
        .where(models.AuthSession.user_id.in_(user_ids), models.AuthSession.is_revoked.is_(False))
        .values(is_revoked=True)
    )
    for user in candidates:
        user.is_active = False
    db.commit()
    logger.info("Deactivated %s stale unverified accounts", len(candidates))
    return len(candidates)