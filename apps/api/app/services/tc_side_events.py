"""Price the side events and fees a bowler picks at registration.

Fees come from the published setup (``payload["fees"]``, see ``FeeConfig`` and ``SideEventSettings`` in
``apps/tournament-central-web/components/organizer``). The client only says which fee, for which bowler,
and how many: every amount is taken from setup here, never from the request.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Optional, Sequence

SIDE_EVENT_KINDS = {
    "fee", "brackets", "high-game-pot", "high-series-pot", "optional-scratch", "strike-pot",
    "mystery-doubles", "donation",
}
# Upper limit when an organizer allows a quantity but sets no maximum.
DEFAULT_MAX_QUANTITY = 99


class SideEventError(ValueError):
    """A side-event pick that can't be accepted. The message is safe to show to the bowler."""


@dataclass(frozen=True)
class SideEventSettings:
    kind: str
    allow_quantity: bool
    max_quantity: Optional[int]
    per: str
    scoring: Optional[str]


@dataclass
class PricedSideEvent:
    fee_id: str
    name: str
    kind: str
    scoring: Optional[str]
    bowler_index: Optional[int]
    quantity: int
    unit_cents: int
    total_cents: int
    required: bool

    def as_response(self) -> dict:
        return {
            "fee_id": self.fee_id,
            "name": self.name,
            "kind": self.kind,
            "bowler_index": self.bowler_index,
            "quantity": self.quantity,
            "unit_cents": self.unit_cents,
            "total_cents": self.total_cents,
        }


def _as_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _int_or_none(value: Any) -> Optional[int]:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return None


def normalize_side_event(raw: Any) -> SideEventSettings:
    """Python mirror of ``normalizeSideEvent`` in formatTypes.ts."""
    data = _as_dict(raw)
    kind = data.get("kind") if data.get("kind") in SIDE_EVENT_KINDS else "fee"
    allow_quantity = data["allowQuantity"] if isinstance(data.get("allowQuantity"), bool) else kind == "brackets"
    per_raw = data.get("per")
    per = per_raw if per_raw in ("bowler", "registration") else ("registration" if kind == "fee" else "bowler")
    max_quantity = _int_or_none(data.get("maxQuantity"))
    scoring = None
    if kind == "brackets":
        scoring = "scratch" if _as_dict(data.get("brackets")).get("scoring") == "scratch" else "handicap"
    return SideEventSettings(
        kind=kind,
        allow_quantity=allow_quantity,
        max_quantity=max_quantity if max_quantity and max_quantity > 0 else None,
        per=per,
        scoring=scoring,
    )


def _ids(value: Any) -> list[str]:
    return [str(item) for item in value] if isinstance(value, list) else []


def fee_in_scope(fee: Mapping[str, Any], *, event_id: str, division_id: str, squad_id: str) -> bool:
    """Empty ``eventIds``/``divisionIds``/``squadIds`` mean every event, division, or squad."""
    for key, chosen in (("eventIds", event_id), ("divisionIds", division_id), ("squadIds", squad_id)):
        allowed = _ids(fee.get(key))
        if allowed and chosen not in allowed:
            return False
    return True


def enabled_fees(fees: Any) -> list[dict]:
    rows = [fee for fee in (fees or []) if isinstance(fee, dict) and fee.get("enabled", True) is not False]
    return [fee for fee in rows if str(fee.get("id") or "").strip()]


def _fee_name(fee: Mapping[str, Any]) -> str:
    return str(fee.get("name") or "").strip() or "Side event"


def _amount_cents(fee: Mapping[str, Any]) -> int:
    value = fee.get("amountCents")
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return 0
    return max(int(value), 0)


def price_side_events(
    fees: Any,
    selections: Iterable[Mapping[str, Any]],
    *,
    event_id: str,
    division_id: str,
    squad_id: str,
    bowler_count: int,
) -> list[PricedSideEvent]:
    """Validate picks against setup, add required fees that are missing, and price every line.

    Each selection is ``{"fee_id", "bowler_index", "quantity"}``. Raises ``SideEventError``.
    """
    fees_by_id = {str(fee["id"]): fee for fee in enabled_fees(fees)}
    priced: list[PricedSideEvent] = []
    seen: set[tuple[str, Optional[int]]] = set()

    for selection in selections:
        fee_id = str(selection.get("fee_id") or "").strip()
        fee = fees_by_id.get(fee_id)
        if fee is None:
            raise SideEventError("A side event you picked is no longer offered. Refresh the form and try again.")
        name = _fee_name(fee)
        if not fee_in_scope(fee, event_id=event_id, division_id=division_id, squad_id=squad_id):
            raise SideEventError(f"{name} isn't offered for the event, division, or squad you picked.")
        settings = normalize_side_event(fee.get("sideEvent"))

        quantity = _int_or_none(selection.get("quantity"))
        if quantity is None:
            raise SideEventError(f"Enter how many {name} you want.")
        if settings.allow_quantity:
            limit = settings.max_quantity or DEFAULT_MAX_QUANTITY
            if quantity < 1 or quantity > limit:
                raise SideEventError(f"{name}: choose between 1 and {limit}.")
        elif quantity != 1:
            raise SideEventError(f"{name} can only be bought once.")

        if settings.per == "bowler":
            bowler_index = _int_or_none(selection.get("bowler_index"))
            if bowler_index is None or bowler_index < 0 or bowler_index >= bowler_count:
                raise SideEventError(f"{name}: choose which bowler it's for.")
        else:
            bowler_index = None

        key = (fee_id, bowler_index)
        if key in seen:
            raise SideEventError(f"{name} was picked twice for the same bowler.")
        seen.add(key)

        unit = _amount_cents(fee)
        priced.append(PricedSideEvent(
            fee_id=fee_id, name=name, kind=settings.kind, scoring=settings.scoring,
            bowler_index=bowler_index, quantity=quantity, unit_cents=unit, total_cents=unit * quantity,
            required=bool(fee.get("required")),
        ))

    # Required fees are always charged, once per bowler or once per registration.
    for fee_id, fee in fees_by_id.items():
        if not fee.get("required") or not fee_in_scope(fee, event_id=event_id, division_id=division_id, squad_id=squad_id):
            continue
        settings = normalize_side_event(fee.get("sideEvent"))
        indexes: Sequence[Optional[int]] = range(bowler_count) if settings.per == "bowler" else [None]
        unit = _amount_cents(fee)
        for bowler_index in indexes:
            if (fee_id, bowler_index) in seen:
                continue
            seen.add((fee_id, bowler_index))
            priced.append(PricedSideEvent(
                fee_id=fee_id, name=_fee_name(fee), kind=settings.kind, scoring=settings.scoring,
                bowler_index=bowler_index, quantity=1, unit_cents=unit, total_cents=unit, required=True,
            ))

    fee_order = {fee_id: position for position, fee_id in enumerate(fees_by_id)}
    priced.sort(key=lambda line: (
        fee_order.get(line.fee_id, 0),
        -1 if line.bowler_index is None else line.bowler_index,
    ))
    return priced


def bracket_counts(rows: Iterable[Any]) -> dict[str, int]:
    """BracketWorks program entry counts from stored side-event rows: {"handicap": n, "scratch": m}."""
    counts = {"handicap": 0, "scratch": 0}
    for row in rows:
        if getattr(row, "kind", None) != "brackets":
            continue
        program = "scratch" if getattr(row, "scoring", None) == "scratch" else "handicap"
        counts[program] += max(int(getattr(row, "quantity", 0) or 0), 0)
    return counts


def side_event_label(name: str, quantity: int) -> str:
    """"Brackets x5" or "High game" for a single pick."""
    return f"{name} x{quantity}" if quantity > 1 else name
