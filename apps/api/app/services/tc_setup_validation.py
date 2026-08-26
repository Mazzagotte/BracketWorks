from __future__ import annotations

from typing import Any


PUBLISHED_SNAPSHOT_KEY = "_publishedSnapshot"


def clean_setup_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in payload.items() if key != PUBLISHED_SNAPSHOT_KEY}


def validate_publishable_setup(payload: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    details = payload.get("details") if isinstance(payload.get("details"), dict) else {}
    email = str(details.get("supportEmail") or "").strip()
    if not str(details.get("name") or "").strip():
        errors.append("Tournament name is required.")
    if not str(details.get("organizer") or "").strip():
        errors.append("Host organization is required.")
    if not str(details.get("contactName") or "").strip():
        errors.append("Participant contact name is required.")
    if details.get("preferredContactMethod") == "phone" and not str(details.get("supportPhone") or "").strip():
        errors.append("Contact phone is required when Phone is the preferred contact method.")
    if not str(details.get("bowlingCenter") or "").strip():
        errors.append("Bowling center is required.")
    if not str(details.get("state") or "").strip():
        errors.append("Tournament state is required.")
    if not str(details.get("city") or "").strip():
        errors.append("Tournament city is required.")
    if not str(details.get("timezone") or "").strip():
        errors.append("Tournament timezone is required.")
    if not str(details.get("tournamentType") or "").strip():
        errors.append("Tournament type is required.")
    start_date = str(details.get("startDateIso") or "")
    end_date = str(details.get("endDateIso") or "")
    if not start_date or not end_date:
        errors.append("Tournament start and end dates are required.")
    elif start_date > end_date:
        errors.append("Tournament end date must be on or after the start date.")
    if not email or "@" not in email or "." not in email.rsplit("@", 1)[-1]:
        errors.append("Enter a valid support email.")
    if not details.get("registrationOpenIso") or not details.get("registrationCloseIso"):
        errors.append("Registration open and close dates are required.")
    elif f"{details.get('registrationOpenIso')}T{details.get('registrationOpenTime') or '00:00'}" > f"{details.get('registrationCloseIso')}T{details.get('registrationCloseTime') or '23:59'}":
        errors.append("Registration close must be after registration opens.")
    events = [row for row in payload.get("events", []) if isinstance(row, dict) and row.get("enabled", True)]
    divisions = [row for row in payload.get("divisions", []) if isinstance(row, dict) and row.get("enabled", True)]
    squads = [row for row in payload.get("squads", []) if isinstance(row, dict)]
    division_ids = {str(row.get("id")) for row in divisions if row.get("id")}
    squad_ids = {str(row.get("id")) for row in squads if row.get("id")}

    if not events:
        errors.append("Enable at least one event before publishing.")
        return errors
    if not divisions and not squads:
        errors.append("Add at least one division or squad before publishing.")

    for squad in squads:
        squad_date = str(squad.get("dateIso") or "")
        if start_date and squad_date and squad_date < start_date:
            errors.append(f"{squad.get('name') or 'A squad'} is scheduled before the tournament starts.")
        if end_date and squad_date and squad_date > end_date:
            errors.append(f"{squad.get('name') or 'A squad'} is scheduled after the tournament ends.")
        deadline = str(squad.get("registrationDeadlineIso") or "")
        if deadline and squad_date and deadline > squad_date:
            errors.append(f"{squad.get('name') or 'A squad'} has a registration deadline after its scheduled date.")

    for event in events:
        name = str(event.get("name") or "An enabled event").strip()
        connected_divisions = {str(value) for value in event.get("connectedDivisionIds", [])}
        connected_squads = {str(value) for value in event.get("connectedSquadIds", [])}
        if event.get("requireDivision") and not connected_divisions:
            errors.append(f"{name} requires a division. Connect at least one division before publishing.")
        if event.get("requireSquad") and not connected_squads:
            errors.append(f"{name} requires a squad. Connect at least one squad before publishing.")
        if connected_divisions - division_ids:
            errors.append(f"{name} references an invalid division.")
        if connected_squads - squad_ids:
            errors.append(f"{name} references an invalid squad.")

    return errors
