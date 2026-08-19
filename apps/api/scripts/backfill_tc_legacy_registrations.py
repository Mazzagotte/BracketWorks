from __future__ import annotations

from datetime import datetime, timezone

from app.api.deps import SessionLocal
from app.core import models


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _safe_parse_iso(value: object) -> datetime:
    raw = str(value or "").strip()
    if not raw:
        return _utcnow()
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return _utcnow()
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _text(value: object) -> str:
    return str(value or "").strip()


def run_backfill() -> None:
    db = SessionLocal()
    try:
        states = db.query(models.TournamentCentralSetupState).all()
        converted = 0

        for state in states:
            payload = state.payload if isinstance(state.payload, dict) else {}
            legacy_rows = payload.get("public_registration_submissions")
            if not isinstance(legacy_rows, list) or not legacy_rows:
                continue

            for row in legacy_rows:
                if not isinstance(row, dict):
                    continue

                legacy_id = _text(row.get("id"))
                confirmation_code = legacy_id or f"legacy-{state.tournament_id}-{abs(hash(str(row))) % 10_000_000}"

                exists = db.query(models.TcRegistration.id).filter(
                    models.TcRegistration.confirmation_code == confirmation_code
                ).first()
                if exists:
                    continue

                form = row.get("form") if isinstance(row.get("form"), dict) else {}
                first_name = _text(form.get("first_name"))
                last_name = _text(form.get("last_name"))
                email = _text(form.get("email")).lower()

                submitted_at = _safe_parse_iso(row.get("submitted_at") or row.get("client_submitted_at"))

                registration = models.TcRegistration(
                    confirmation_code=confirmation_code,
                    tournament_id=state.tournament_id,
                    account_user_id=None,
                    contact_first_name=first_name,
                    contact_last_name=last_name,
                    contact_email=email,
                    contact_phone=_text(form.get("phone")) or None,
                    status="pending",
                    payment_status="unpaid",
                    subtotal_cents=0,
                    fees_cents=0,
                    total_cents=0,
                    currency="USD",
                    notes=_text(form.get("notes")) or None,
                    terms_accepted_at=submitted_at,
                    submitted_at=submitted_at,
                    created_at=submitted_at,
                    updated_at=submitted_at,
                    source="legacy_payload",
                )
                db.add(registration)
                db.flush()

                bowlers = form.get("bowlers") if isinstance(form.get("bowlers"), list) else []
                if not bowlers:
                    bowlers = [{
                        "first_name": first_name,
                        "last_name": last_name,
                        "email": email,
                        "phone": _text(form.get("phone")),
                        "usbc_number": _text(form.get("usbc_number")),
                    }]

                bowler_rows: list[models.TcRegistrationBowler] = []
                for bowler in bowlers:
                    if not isinstance(bowler, dict):
                        continue
                    bowler_row = models.TcRegistrationBowler(
                        registration_id=registration.id,
                        tournament_id=state.tournament_id,
                        user_id=None,
                        first_name=_text(bowler.get("first_name")),
                        last_name=_text(bowler.get("last_name")),
                        email=_text(bowler.get("email")).lower() or None,
                        phone=_text(bowler.get("phone")) or None,
                        usbc_number=_text(bowler.get("usbc_number")) or None,
                        average=int(_text(bowler.get("average"))) if _text(bowler.get("average")).isdigit() else None,
                        date_of_birth=_text(bowler.get("date_of_birth")) or None,
                        address=_text(bowler.get("address")) or None,
                        city=_text(bowler.get("city")) or None,
                        state=_text(bowler.get("state")) or None,
                        zip_code=_text(bowler.get("zip") or bowler.get("zip_code")) or None,
                    )
                    db.add(bowler_row)
                    bowler_rows.append(bowler_row)

                db.flush()

                entry = models.TcEntry(
                    registration_id=registration.id,
                    tournament_id=state.tournament_id,
                    event_config_id=_text(form.get("event_id")) or "legacy-event",
                    event_name_snapshot=_text(form.get("event_id")) or "Legacy Event",
                    division_config_id=_text(form.get("division_id")) or None,
                    division_name_snapshot=None,
                    squad_config_id=_text(form.get("squad_id")) or None,
                    squad_name_snapshot=None,
                    squad_date_snapshot=None,
                    squad_time_snapshot=None,
                    entry_number=None,
                    reentry_number=0,
                    status="pending",
                    entry_fee_cents=0,
                )
                db.add(entry)
                db.flush()

                for index, bowler_row in enumerate(bowler_rows):
                    db.add(
                        models.TcEntryBowler(
                            entry_id=entry.id,
                            bowler_id=bowler_row.id,
                            position=index + 1,
                            role=None,
                        )
                    )

                converted += 1

        db.commit()
        print(f"Backfill complete. Converted {converted} legacy submission(s).")
    finally:
        db.close()


if __name__ == "__main__":
    run_backfill()
