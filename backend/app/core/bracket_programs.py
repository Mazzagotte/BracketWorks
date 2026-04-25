from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, Iterable, List, Mapping


DEFAULT_BRACKET_PROGRAMS: List[Dict[str, Any]] = [
    {
        "key": "handicap",
        "name": "Handicap",
        "division": "Any",
        "scoring_mode": "handicap",
        "entry_fee": None,
        "enabled": True,
        "display_order": 1,
    },
    {
        "key": "scratch",
        "name": "Scratch",
        "division": "Any",
        "scoring_mode": "scratch",
        "entry_fee": None,
        "enabled": True,
        "display_order": 2,
    },
    {
        "key": "reverse",
        "name": "Reverse",
        "division": "Any",
        "scoring_mode": "reverse",
        "entry_fee": None,
        "enabled": False,
        "display_order": 3,
    },
    {
        "key": "womens",
        "name": "Womens",
        "division": "Womens",
        "scoring_mode": "scratch",
        "entry_fee": None,
        "enabled": False,
        "display_order": 4,
    },
    {
        "key": "seniors",
        "name": "Seniors",
        "division": "Senior",
        "scoring_mode": "scratch",
        "entry_fee": None,
        "enabled": False,
        "display_order": 5,
    },
    {
        "key": "juniors",
        "name": "Juniors",
        "division": "Junior",
        "scoring_mode": "scratch",
        "entry_fee": None,
        "enabled": False,
        "display_order": 6,
    },
]

REQUIRED_BRACKET_PROGRAM_KEYS = {"handicap", "scratch"}


def normalize_bracket_programs(
    bracket_programs: Iterable[Mapping[str, Any]] | None,
    default_entry_fee: float | None = None,
) -> List[Dict[str, Any]]:
    programs = list(bracket_programs or [])
    configured_keys = {
        str(program.get("key") or "").strip().lower().replace(" ", "-")
        for program in programs
        if str(program.get("key") or "").strip()
    }

    for default_program in DEFAULT_BRACKET_PROGRAMS:
        if default_program["key"] not in configured_keys:
            programs.append(default_program)

    normalized: List[Dict[str, Any]] = []
    seen_keys: set[str] = set()

    for index, program in enumerate(programs):
        raw_key = str(program.get("key") or "").strip().lower().replace(" ", "-")
        if not raw_key or raw_key in seen_keys:
            continue

        seen_keys.add(raw_key)
        normalized.append(
            {
                "key": raw_key,
                "name": str(program.get("name") or raw_key.replace("-", " ").title()).strip(),
                "division": str(program.get("division") or "Any").strip() or "Any",
                "scoring_mode": str(program.get("scoring_mode") or raw_key).strip().lower() or raw_key,
                "entry_fee": _coerce_float(program.get("entry_fee"), default_entry_fee),
                "enabled": True if raw_key in REQUIRED_BRACKET_PROGRAM_KEYS else bool(program.get("enabled", False)),
                "display_order": int(program.get("display_order") or (index + 1)),
            }
        )

    normalized.sort(key=lambda item: (item["display_order"], item["name"].lower()))
    return normalized


def normalize_bowler_bracket_entries(
    bracket_entries: Mapping[str, Any] | None,
    handicap_entries: int | None = None,
    scratch_entries: int | None = None,
) -> Dict[str, int]:
    normalized: Dict[str, int] = {}

    for raw_key, raw_value in (bracket_entries or {}).items():
        key = str(raw_key).strip().lower().replace(" ", "-")
        if not key:
            continue
        normalized[key] = max(0, int(raw_value or 0))

    if "handicap" not in normalized and handicap_entries:
        normalized["handicap"] = max(0, int(handicap_entries or 0))
    if "scratch" not in normalized and scratch_entries:
        normalized["scratch"] = max(0, int(scratch_entries or 0))

    return normalized


def calculate_bowler_total_cost(
    bracket_entries: Mapping[str, Any] | None,
    bracket_programs: Iterable[Mapping[str, Any]] | None,
    default_entry_fee: float | None,
    handicap_entries: int | None = None,
    scratch_entries: int | None = None,
) -> float:
    normalized_entries = normalize_bowler_bracket_entries(
        bracket_entries,
        handicap_entries=handicap_entries,
        scratch_entries=scratch_entries,
    )
    normalized_programs = normalize_bracket_programs(
        bracket_programs,
        default_entry_fee=default_entry_fee,
    )
    program_map = {program["key"]: program for program in normalized_programs}

    total = Decimal("0")
    for key, count in normalized_entries.items():
        if count <= 0:
            continue
        entry_fee = _coerce_decimal(program_map.get(key, {}).get("entry_fee"), default_entry_fee)
        total += entry_fee * count

    return float(total)


def _coerce_float(value: Any, fallback: float | None) -> float | None:
    if value is None or value == "":
        return fallback
    return float(value)


def _coerce_decimal(value: Any, fallback: float | None) -> Decimal:
    if value is None or value == "":
        value = fallback or 0
    return Decimal(str(value))