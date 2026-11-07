"""Who may enter an event and division, checked when a bowler registers.

This mirrors ``apps/tournament-central-web/components/public/registrationEligibility.ts`` so the form
shows the same messages before submit that the server enforces. Only rules the organizer actually set
are checked: a missing or empty rule means no check.

Rules come from the published setup:
- Division: ``minAverage``/``maxAverage``, ``minAge``/``maxAge`` (age on the tournament's first day), and
  ``rules.gender`` ("men" or "women"; "any" means no check).
- Event ``rules``: ``usbcRequired``, ``team.combinedAverageMax``, ``team.mixedRequired``, and
  ``average.noAverage`` ("not-eligible" requires an average; "assigned-average" with ``assignedAverage``
  uses that average for bowlers who leave it blank).
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any, Mapping, Optional, Sequence

_USBC_PATTERN = re.compile(r"^\d+(?:-\d+)?$")
_GENDER_ALIASES = {
    "m": "M", "male": "M", "man": "M", "men": "M",
    "f": "F", "female": "F", "woman": "F", "women": "F",
}


def _as_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _number(value: Any) -> Optional[float]:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _format_number(value: float) -> str:
    return str(int(value)) if float(value).is_integer() else f"{value:g}"


def normalize_gender(value: Any) -> Optional[str]:
    """"M", "F", or None. Accepts M/F, male/female, man/woman, and men/women in any case."""
    return _GENDER_ALIASES.get(str(value or "").strip().lower())


def is_valid_usbc_number(value: Any) -> bool:
    """USBC IDs look like 1234-56789. Accepts digits with one optional dash, 6 to 14 digits in all."""
    text = re.sub(r"\s+", "", str(value or ""))
    if not _USBC_PATTERN.match(text):
        return False
    digits = len(text.replace("-", ""))
    return 6 <= digits <= 14


def parse_birth_date(value: Any) -> Optional[date]:
    text = str(value or "").strip()
    if not text:
        return None
    for pattern in ("%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y"):
        try:
            return datetime.strptime(text[:10], pattern).date()
        except ValueError:
            continue
    return None


def age_on(birth_date: date, on_date: date) -> int:
    years = on_date.year - birth_date.year
    if (on_date.month, on_date.day) < (birth_date.month, birth_date.day):
        years -= 1
    return years


def parse_reference_date(value: Any) -> Optional[date]:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def _bowler_label(index: int, bowler: Mapping[str, Any], total: int) -> str:
    name = " ".join(f"{bowler.get('first_name') or ''} {bowler.get('last_name') or ''}".split())
    if total <= 1:
        return name or "Bowler"
    return f"Bowler {index + 1} ({name})" if name else f"Bowler {index + 1}"


def effective_average(bowler: Mapping[str, Any], event_rules: Mapping[str, Any]) -> Optional[float]:
    """The bowler's average, or the event's assigned average when they left it blank."""
    average = _number(bowler.get("average"))
    if average is not None:
        return average
    rule = _as_dict(event_rules.get("average"))
    if rule.get("noAverage") != "not-eligible":
        return _number(rule.get("assignedAverage"))
    return None


def required_bowler_fields(event: Mapping[str, Any] | None, division: Mapping[str, Any] | None) -> set[str]:
    """Bowler field keys the configured rules need, so the form can ask for them."""
    rules = _as_dict(_as_dict(event).get("rules"))
    division_row = _as_dict(division)
    division_rules = _as_dict(division_row.get("rules"))
    keys: set[str] = set()
    if rules.get("usbcRequired") is True:
        keys.add("usbc_number")
    average_rule = _as_dict(rules.get("average"))
    if average_rule.get("noAverage") == "not-eligible":
        keys.add("average")
    team = _as_dict(rules.get("team"))
    if _number(team.get("combinedAverageMax")) is not None:
        keys.add("average")
    if team.get("mixedRequired") is True:
        keys.add("gender")
    if _number(division_row.get("minAverage")) is not None or _number(division_row.get("maxAverage")) is not None:
        keys.add("average")
    if _number(division_row.get("minAge")) is not None or _number(division_row.get("maxAge")) is not None:
        keys.add("date_of_birth")
    if division_rules.get("gender") in ("men", "women"):
        keys.add("gender")
    return keys


def check_registration_eligibility(
    *,
    event: Mapping[str, Any] | None,
    division: Mapping[str, Any] | None,
    bowlers: Sequence[Mapping[str, Any]],
    reference_date: Optional[date],
) -> list[str]:
    """Plain-language problems that keep these bowlers out of this event and division. Empty when eligible.

    Each bowler is a mapping of registration field keys (``first_name``, ``average``, ``date_of_birth``,
    ``gender``, ``usbc_number``) to submitted values.
    """
    rules = _as_dict(_as_dict(event).get("rules"))
    division_row = _as_dict(division)
    division_name = str(division_row.get("name") or "this division").strip() or "this division"
    division_rules = _as_dict(division_row.get("rules"))
    team = _as_dict(rules.get("team"))
    average_rule = _as_dict(rules.get("average"))

    min_average = _number(division_row.get("minAverage"))
    max_average = _number(division_row.get("maxAverage"))
    min_age = _number(division_row.get("minAge"))
    max_age = _number(division_row.get("maxAge"))
    division_gender = division_rules.get("gender") if division_rules.get("gender") in ("men", "women") else None
    combined_max = _number(team.get("combinedAverageMax"))
    average_required = average_rule.get("noAverage") == "not-eligible"
    usbc_required = rules.get("usbcRequired") is True
    mixed_required = team.get("mixedRequired") is True

    problems: list[str] = []
    total = len(bowlers)
    genders: list[Optional[str]] = []
    combined = 0.0
    combined_known = True

    for index, bowler in enumerate(bowlers):
        label = _bowler_label(index, bowler, total)
        average = effective_average(bowler, rules)
        gender = normalize_gender(bowler.get("gender"))
        genders.append(gender)

        if usbc_required:
            usbc = str(bowler.get("usbc_number") or "").strip()
            if not usbc:
                problems.append(f"{label}: a USBC number is required for this event.")
            elif not is_valid_usbc_number(usbc):
                problems.append(f"{label}: enter the USBC number like 1234-56789.")

        if average is None and average_required:
            problems.append(f"{label}: an average is required for this event.")
        elif average is None and (min_average is not None or max_average is not None):
            problems.append(f"{label}: an average is required for {division_name}.")
        if average is not None:
            if min_average is not None and average < min_average:
                problems.append(
                    f"{label}: average {_format_number(average)} is below the {division_name} minimum of "
                    f"{_format_number(min_average)}."
                )
            if max_average is not None and average > max_average:
                problems.append(
                    f"{label}: average {_format_number(average)} is above the {division_name} maximum of "
                    f"{_format_number(max_average)}."
                )
            combined += average
        else:
            combined_known = False

        if min_age is not None or max_age is not None:
            birth_date = parse_birth_date(bowler.get("date_of_birth"))
            if birth_date is None:
                problems.append(f"{label}: a date of birth is required for {division_name}.")
            elif reference_date is not None:
                age = age_on(birth_date, reference_date)
                if min_age is not None and age < min_age:
                    problems.append(
                        f"{label}: must be at least {_format_number(min_age)} on the first day of the "
                        f"tournament for {division_name}."
                    )
                if max_age is not None and age > max_age:
                    problems.append(
                        f"{label}: must be {_format_number(max_age)} or younger on the first day of the "
                        f"tournament for {division_name}."
                    )

        if division_gender:
            wanted = "M" if division_gender == "men" else "F"
            if gender is None:
                problems.append(f"{label}: gender is required for {division_name}.")
            elif gender != wanted:
                problems.append(f"{label}: {division_name} is for {division_gender} only.")
        elif mixed_required and gender is None:
            problems.append(f"{label}: gender is required for this mixed event.")

    if combined_max is not None and combined_known and total > 0 and combined > combined_max:
        problems.append(
            f"Combined average {_format_number(combined)} is above this event's limit of "
            f"{_format_number(combined_max)}."
        )

    if mixed_required and total > 1 and all(genders) and not ("M" in genders and "F" in genders):
        problems.append("This event is mixed: include at least one man and one woman.")

    return problems
