from decimal import Decimal, ROUND_HALF_UP
from typing import Any

CENT = Decimal("0.01")


def money_decimal(value: Any) -> Decimal:
    return Decimal(str(value or 0)).quantize(CENT, rounding=ROUND_HALF_UP)


def money_float(value: Any) -> float:
    return float(money_decimal(value))
