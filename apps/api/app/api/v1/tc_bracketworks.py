"""Send Tournament Central bowlers to a linked BracketWorks tournament.

The first send creates a private BracketWorks tournament owned by the TC owner and links the
two. Later sends add new bowlers and update name, USBC number, and average on bowlers that came
from TC. Bowlers added by hand in BracketWorks are never changed, and bowlers removed from TC are
reported but never deleted.

When the TC setup sells brackets as a side event, each bowler's bracket purchases become their
BracketWorks program entry counts ("handicap" and "scratch"). Counts are set on create and updated
only when they change, and a squad whose counts changed is reported as needing new brackets.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ...api import deps
from ...core import models, schemas
from ...core.bracket_programs import normalize_bowler_bracket_entries, normalize_division
from ...core.handicap import calculate_handicap_pins
from ...services.payouts import reset_payouts_if_needed
from ...services.tc_side_events import bracket_counts, enabled_fees, normalize_side_event
from ...services.tournament_access import (
    require_tc_tournament_permission,
    require_tournament_permission,
)
from ...services.tournament_audit import record_tournament_event
from ...services.tournament_snapshots import create_restore_point
from .bowlers import _stage_bowler

router = APIRouter()

SOURCE_TC = "tc"
# Division names that clearly map to a BracketWorks division. Anything else keeps the BW default.
_CLEAR_DIVISIONS = {
    "men", "mens", "men's", "women", "womens", "women's",
    "senior", "seniors", "senior's", "junior", "juniors", "junior's",
}


class SyncRequest(BaseModel):
    dry_run: bool = True
    include_pending: bool = False


@dataclass
class _DesiredPlayer:
    ref: str
    squad_key: tuple[str, str]
    squad_label: str
    full_name: str
    usbc_number: str | None
    average: int | None
    division: str | None
    # {"handicap": n, "scratch": m} when TC sells brackets, else None (BracketWorks counts are left alone).
    bracket_entries: dict[str, int] | None = None


def _normalize_name(value: str | None) -> str:
    return " ".join((value or "").lower().split())


def _clean(value: str | None) -> str | None:
    text = (value or "").strip()
    return text or None


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def _source_ref(tc_tournament_id: int, squad_config_id: str | None, usbc: str | None, full_name: str) -> str:
    person = usbc.lower() if usbc else f"name:{_normalize_name(full_name)}"
    return f"tc:{tc_tournament_id}:{squad_config_id or '-'}:{person}"[:160]


def _clear_division(name: str | None) -> str | None:
    value = (name or "").strip().lower()
    return normalize_division(value) if value in _CLEAR_DIVISIONS else None


def _get_link(db: Session, tc_tournament_id: int) -> models.TcBracketWorksLink | None:
    return db.query(models.TcBracketWorksLink).filter(
        models.TcBracketWorksLink.tc_tournament_id == tc_tournament_id
    ).first()


def _require_bw_access(db: Session, bw_tournament_id: int, user: models.User) -> models.Tournament:
    try:
        return require_tournament_permission(db, bw_tournament_id, user, "manage_entries")
    except HTTPException as error:
        if error.status_code == status.HTTP_404_NOT_FOUND:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The linked BracketWorks tournament no longer exists.",
            ) from error
        if error.status_code == status.HTTP_403_FORBIDDEN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You need entries access to the linked BracketWorks tournament to send bowlers.",
            ) from error
        if error.status_code == status.HTTP_409_CONFLICT:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "The linked BracketWorks tournament is finalized or archived, so bowlers cannot be "
                    "sent to it. Reopen it in BracketWorks first."
                ),
            ) from error
        raise


def _sells_brackets(db: Session, tc_tournament_id: int) -> bool:
    """True when the TC setup has a brackets side event, or any registration bought brackets."""
    state = db.query(models.TournamentCentralSetupState).filter(
        models.TournamentCentralSetupState.tournament_id == tc_tournament_id
    ).first()
    payload = state.payload if state is not None and isinstance(state.payload, dict) else {}
    snapshot = payload.get("_publishedSnapshot")
    source = snapshot if isinstance(snapshot, dict) else payload
    if any(normalize_side_event(fee.get("sideEvent")).kind == "brackets" for fee in enabled_fees(source.get("fees"))):
        return True
    return db.query(models.TcRegistrationSideEvent.id).filter(
        models.TcRegistrationSideEvent.tournament_id == tc_tournament_id,
        models.TcRegistrationSideEvent.kind == "brackets",
    ).first() is not None


def _bracket_entries_differ(player: models.TournamentPlayer, desired: dict[str, int]) -> bool:
    current = normalize_bowler_bracket_entries(
        player.program_entry_counts, player.handicap_entry_count, player.scratch_entry_count
    )
    return any(current.get(key, 0) != value for key, value in desired.items())


def _collect_desired_players(
    db: Session, tc: models.TournamentCentral, include_pending: bool
) -> tuple[dict[str, _DesiredPlayer], list[dict]]:
    statuses = ["confirmed", "pending"] if include_pending else ["confirmed"]
    entries = (
        db.query(models.TcEntry)
        .join(models.TcRegistration, models.TcEntry.registration_id == models.TcRegistration.id)
        .filter(
            models.TcEntry.tournament_id == tc.id,
            models.TcEntry.status.in_(statuses),
            models.TcRegistration.status.in_(statuses),
        )
        .order_by(models.TcEntry.id.asc())
        .all()
    )
    entry_ids = [entry.id for entry in entries]
    bowlers_by_entry: dict[int, list[models.TcRegistrationBowler]] = {}
    if entry_ids:
        rows = (
            db.query(models.TcEntryBowler, models.TcRegistrationBowler)
            .join(models.TcRegistrationBowler, models.TcEntryBowler.bowler_id == models.TcRegistrationBowler.id)
            .filter(models.TcEntryBowler.entry_id.in_(entry_ids))
            .order_by(models.TcEntryBowler.entry_id.asc(), models.TcEntryBowler.position.asc())
            .all()
        )
        for link, bowler in rows:
            bowlers_by_entry.setdefault(link.entry_id, []).append(bowler)

    sells_brackets = _sells_brackets(db, tc.id)
    bracket_rows_by_bowler: dict[int, list[models.TcRegistrationSideEvent]] = {}
    if sells_brackets:
        bowler_ids = [bowler.id for bowlers in bowlers_by_entry.values() for bowler in bowlers]
        if bowler_ids:
            for row in db.query(models.TcRegistrationSideEvent).filter(
                models.TcRegistrationSideEvent.bowler_id.in_(bowler_ids),
                models.TcRegistrationSideEvent.kind == "brackets",
            ).all():
                bracket_rows_by_bowler.setdefault(row.bowler_id, []).append(row)
    counted_bowlers: dict[str, set[int]] = {}

    def add_brackets(item: _DesiredPlayer, bowler: models.TcRegistrationBowler) -> None:
        if not sells_brackets:
            return
        seen = counted_bowlers.setdefault(item.ref, set())
        if bowler.id in seen:
            return
        seen.add(bowler.id)
        counts = bracket_counts(bracket_rows_by_bowler.get(bowler.id, []))
        totals = item.bracket_entries or {"handicap": 0, "scratch": 0}
        item.bracket_entries = {key: totals.get(key, 0) + counts.get(key, 0) for key in ("handicap", "scratch")}

    desired: dict[str, _DesiredPlayer] = {}
    skipped: list[dict] = []
    skipped_seen: set[tuple[str, str]] = set()

    def skip(name: str, reason: str) -> None:
        key = (_normalize_name(name), reason)
        if key not in skipped_seen:
            skipped_seen.add(key)
            skipped.append({"name": name, "reason": reason})

    for entry in entries:
        bowlers = bowlers_by_entry.get(entry.id, [])
        if not bowlers:
            skip(entry.event_name_snapshot or f"Entry {entry.id}", "No bowler on this entry")
            continue
        squad_date = _clean(entry.squad_date_snapshot)
        squad_time = _clean(entry.squad_time_snapshot)
        for bowler in bowlers:
            full_name = " ".join(f"{bowler.first_name or ''} {bowler.last_name or ''}".split())
            if not full_name:
                skip(f"Bowler {bowler.id}", "Missing name")
                continue
            if not squad_date or not squad_time:
                skip(full_name, "No squad date and time on this entry")
                continue
            usbc = _clean(bowler.usbc_number)
            ref = _source_ref(tc.id, _clean(entry.squad_config_id), usbc, full_name)
            existing = desired.get(ref)
            if existing:
                if existing.average is None and bowler.average is not None:
                    existing.average = bowler.average
                if existing.division is None:
                    existing.division = _clear_division(entry.division_name_snapshot)
                add_brackets(existing, bowler)
                continue
            desired[ref] = _DesiredPlayer(
                ref=ref,
                squad_key=(squad_date, squad_time),
                squad_label=_clean(entry.squad_name_snapshot) or f"{squad_date} at {squad_time}",
                full_name=full_name,
                usbc_number=usbc,
                average=bowler.average,
                division=_clear_division(entry.division_name_snapshot),
            )
            add_brackets(desired[ref], bowler)
    return desired, skipped


def _handicap_for(db: Session, tournament_id: int, average: int | None) -> int | None:
    if average is None:
        return None
    settings = db.query(models.BracketSettings).filter(
        models.BracketSettings.tournament_id == tournament_id
    ).first()
    if settings and settings.handicap_percentage is not None and settings.handicap_base is not None:
        return calculate_handicap_pins(average, settings.handicap_base, settings.handicap_percentage)
    return None


def _merge_squad_times(tournament: models.Tournament, squad_keys: set[tuple[str, str]]) -> None:
    try:
        squad_times = json.loads(tournament.squad_times) if tournament.squad_times else {}
    except json.JSONDecodeError:
        squad_times = {}
    if not isinstance(squad_times, dict):
        squad_times = {}
    for date_value, time_value in sorted(squad_keys):
        times = squad_times.get(date_value)
        if not isinstance(times, list):
            times = []
        if time_value not in times:
            times.append(time_value)
        squad_times[date_value] = times
    tournament.squad_times = json.dumps(squad_times)


@router.get("/{tournament_id}/bracketworks")
def get_bracketworks_link(
    tournament_id: int,
    db: Session = Depends(deps.get_db),
    user: models.User = Depends(deps.get_current_user),
):
    require_tc_tournament_permission(db, tournament_id, user, "view")
    link = _get_link(db, tournament_id)
    bw = db.get(models.Tournament, link.bw_tournament_id) if link else None
    return {
        "linked": link is not None,
        "bw_tournament_id": link.bw_tournament_id if link else None,
        "bw_tournament_name": bw.name if bw else None,
        "last_synced_at": _iso(link.last_synced_at) if link else None,
        "last_sync_summary": link.last_sync_summary if link else None,
    }


@router.post("/{tournament_id}/bracketworks/sync")
def sync_to_bracketworks(
    tournament_id: int,
    body: SyncRequest,
    db: Session = Depends(deps.get_db),
    user: models.User = Depends(deps.get_current_user),
):
    tc = require_tc_tournament_permission(db, tournament_id, user, "manage_entries")
    link = _get_link(db, tc.id)
    bw: models.Tournament | None = None
    if link:
        bw = _require_bw_access(db, link.bw_tournament_id, user)
    elif tc.user_id != user.id and not getattr(user, "is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the tournament owner can create its BracketWorks tournament.",
        )

    desired, skipped = _collect_desired_players(db, tc, body.include_pending)

    squads_by_key: dict[tuple[str, str], models.TournamentSquad] = {}
    players: list[models.TournamentPlayer] = []
    if bw:
        for squad in db.query(models.TournamentSquad).filter(models.TournamentSquad.tournament_id == bw.id).all():
            squads_by_key.setdefault((str(squad.date), str(squad.time)), squad)
        players = db.query(models.TournamentPlayer).filter(models.TournamentPlayer.tournament_id == bw.id).all()

    tc_players = {p.source_ref: p for p in players if p.source == SOURCE_TC and p.source_ref}
    manual_players = [p for p in players if p.source != SOURCE_TC]
    squad_by_id = {squad.id: squad for squad in squads_by_key.values()}

    to_create: list[_DesiredPlayer] = []
    to_update: list[tuple[models.TournamentPlayer, _DesiredPlayer, dict]] = []
    possible_duplicates: list[dict] = []
    unchanged = 0
    new_squad_keys: set[tuple[str, str]] = set()

    for item in desired.values():
        squad = squads_by_key.get(item.squad_key)
        player = tc_players.get(item.ref)
        if player is not None:
            changes: dict = {}
            if _normalize_name(player.full_name) != _normalize_name(item.full_name):
                changes["full_name"] = item.full_name
            if (_clean(player.usbc_number) or None) != item.usbc_number:
                changes["usbc_number"] = item.usbc_number
            if item.average is not None and player.average != item.average:
                changes["average"] = item.average
            if item.bracket_entries is not None and _bracket_entries_differ(player, item.bracket_entries):
                changes["bracket_entries"] = item.bracket_entries
            if changes:
                to_update.append((player, item, changes))
            else:
                unchanged += 1
            continue

        if squad is not None:
            usbc_key = item.usbc_number.lower() if item.usbc_number else None
            name_key = _normalize_name(item.full_name)
            match = next(
                (
                    p for p in manual_players
                    if p.squad_id == squad.id and (
                        (usbc_key and (p.usbc_number or "").strip().lower() == usbc_key)
                        or _normalize_name(p.full_name) == name_key
                    )
                ),
                None,
            )
            if match is not None:
                possible_duplicates.append({
                    "name": item.full_name,
                    "bw_player_id": match.id,
                    "bw_name": match.full_name,
                    "squad": item.squad_label,
                })
                continue
        else:
            new_squad_keys.add(item.squad_key)
        to_create.append(item)

    not_in_tc = [
        {"bw_player_id": p.id, "name": p.full_name}
        for ref, p in sorted(tc_players.items(), key=lambda pair: pair[1].id)
        if ref not in desired
    ]

    labels_by_key = {item.squad_key: item.squad_label for item in desired.values()}
    changed_squad_ids = {
        squads_by_key[item.squad_key].id for item in to_create if item.squad_key in squads_by_key
    }
    # New bracket counts change who is in the brackets, so those squads need new brackets too.
    changed_squad_ids |= {
        player.squad_id for player, _item, changes in to_update
        if "bracket_entries" in changes and player.squad_id in squad_by_id
    }
    squads_needing_regeneration: list[dict] = []
    if bw and changed_squad_ids:
        with_brackets = {
            row[0]
            for row in db.query(models.BracketSnapshot.squad_id).filter(
                models.BracketSnapshot.tournament_id == bw.id,
                models.BracketSnapshot.squad_id.in_(changed_squad_ids),
                models.BracketSnapshot.is_current.is_(True),
            ).all()
        }
        for squad_id in sorted(with_brackets):
            squad = squad_by_id[squad_id]
            key = (str(squad.date), str(squad.time))
            squads_needing_regeneration.append({
                "squad_id": squad_id,
                "label": labels_by_key.get(key) or f"{squad.date} at {squad.time}",
            })

    summary = {
        "dry_run": body.dry_run,
        "include_pending": body.include_pending,
        "bw_tournament_id": bw.id if bw else None,
        "bw_tournament_name": bw.name if bw else tc.name,
        "created_tournament": bw is None,
        "squads_created": len(new_squad_keys),
        "players_created": len(to_create),
        "players_updated": len(to_update),
        "bracket_entries_updated": sum(1 for _player, _item, changes in to_update if "bracket_entries" in changes),
        "unchanged": unchanged,
        "skipped": skipped,
        "possible_duplicates": possible_duplicates,
        "not_in_tc": not_in_tc,
        "squads_needing_regeneration": squads_needing_regeneration,
    }

    if body.dry_run:
        db.rollback()
        return summary

    try:
        if bw is None:
            bw = models.Tournament(
                name=tc.name,
                location=tc.location,
                start_date=tc.start_date,
                end_date=tc.end_date,
                squad_times="{}",
                is_public=False,
                user_id=tc.user_id,
            )
            db.add(bw)
            db.flush()
            record_tournament_event(
                db, tournament_id=bw.id, event_type="tournament.created", user=user,
                summary=f"Created tournament {bw.name} from Tournament Central",
                after_values={"name": bw.name, "tc_tournament_id": tc.id},
                entity_type="tournament", entity_id=bw.id,
            )
            link = models.TcBracketWorksLink(
                tc_tournament_id=tc.id, bw_tournament_id=bw.id, created_by_user_id=user.id,
            )
            db.add(link)
        else:
            create_restore_point(
                db, tournament_id=bw.id, user=user, trigger="tc.sync",
                summary="Before sending bowlers from Tournament Central",
            )

        for key in sorted(new_squad_keys):
            squad = models.TournamentSquad(tournament_id=bw.id, date=key[0], time=key[1])
            db.add(squad)
            squads_by_key[key] = squad
        if new_squad_keys:
            db.flush()
            _merge_squad_times(bw, new_squad_keys)

        affected_squad_ids: set[int] = set()
        for item in to_create:
            squad = squads_by_key[item.squad_key]
            player = _stage_bowler(
                db,
                schemas.PlayerCreate(
                    tournament_id=bw.id,
                    squad_id=squad.id,
                    full_name=item.full_name,
                    average=item.average,
                    usbc_number=item.usbc_number,
                    division=item.division,
                    program_entry_counts=item.bracket_entries,
                    handicap_entry_count=item.bracket_entries.get("handicap") if item.bracket_entries else None,
                    scratch_entry_count=item.bracket_entries.get("scratch") if item.bracket_entries else None,
                ),
                bw.user_id,
            )
            player.source = SOURCE_TC
            player.source_ref = item.ref
            affected_squad_ids.add(squad.id)

        for player, _item, changes in to_update:
            if "full_name" in changes:
                player.full_name = changes["full_name"]
            if "usbc_number" in changes:
                player.usbc_number = changes["usbc_number"]
            if "average" in changes:
                player.average = changes["average"]
                player.handicap_pins = _handicap_for(db, bw.id, player.average)
            if "bracket_entries" in changes:
                merged = normalize_bowler_bracket_entries(
                    player.program_entry_counts, player.handicap_entry_count, player.scratch_entry_count
                )
                merged.update(changes["bracket_entries"])
                player.program_entry_counts = merged
                player.handicap_entry_count = merged.get("handicap", 0)
                player.scratch_entry_count = merged.get("scratch", 0)
            if player.squad_id is not None:
                affected_squad_ids.add(player.squad_id)

        db.flush()
        for squad_id in sorted(affected_squad_ids):
            reset_payouts_if_needed(db, bw.id, squad_id)

        summary["bw_tournament_id"] = bw.id
        summary["bw_tournament_name"] = bw.name
        record_tournament_event(
            db, tournament_id=bw.id, event_type="entries.synced_from_tc", user=user,
            summary=(
                f"Sent bowlers from Tournament Central: {len(to_create)} added, "
                f"{len(to_update)} updated"
            ),
            after_values={
                "tc_tournament_id": tc.id,
                "players_created": len(to_create),
                "players_updated": len(to_update),
                "squads_created": len(new_squad_keys),
                "not_in_tc": len(not_in_tc),
            },
            entity_type="player",
        )
        link.last_synced_at = datetime.now(timezone.utc)
        link.last_sync_summary = summary
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Another send to BracketWorks happened at the same time. Try again.",
        ) from error
    except Exception:
        db.rollback()
        raise

    return summary
