from __future__ import annotations

from app.api.deps import SessionLocal
from app.core import models

TEST_USERNAME = "tc_map_test_owner"
TEST_PREFIX = "TC Map Test "


def delete_map_test_tournaments() -> int:
    with SessionLocal() as db:
        owner = db.query(models.User).filter(models.User.username == TEST_USERNAME).one_or_none()
        if owner is None:
            return 0

        tournaments = (
            db.query(models.TournamentCentral)
            .filter(
                models.TournamentCentral.user_id == owner.id,
                models.TournamentCentral.name.like(f"{TEST_PREFIX}%"),
            )
            .all()
        )

        tournament_ids = [tournament.id for tournament in tournaments]
        if not tournament_ids:
            return 0

        registration_ids = [
            row.id
            for row in db.query(models.TcRegistration.id)
            .filter(models.TcRegistration.tournament_id.in_(tournament_ids))
            .all()
        ]

        if registration_ids:
            db.query(models.TcEntry).filter(models.TcEntry.registration_id.in_(registration_ids)).delete(
                synchronize_session=False
            )
            db.query(models.TcRegistrationBowler).filter(
                models.TcRegistrationBowler.registration_id.in_(registration_ids)
            ).delete(synchronize_session=False)
            db.query(models.TcRegistration).filter(models.TcRegistration.id.in_(registration_ids)).delete(
                synchronize_session=False
            )

        db.query(models.TournamentCentralSetupState).filter(
            models.TournamentCentralSetupState.tournament_id.in_(tournament_ids)
        ).delete(synchronize_session=False)

        db.query(models.TournamentCentral).filter(models.TournamentCentral.id.in_(tournament_ids)).delete(
            synchronize_session=False
        )

        db.commit()

    return len(tournament_ids)


def main() -> None:
    deleted = delete_map_test_tournaments()
    print(f"Deleted {deleted} TC map test tournaments.")


if __name__ == "__main__":
    main()
