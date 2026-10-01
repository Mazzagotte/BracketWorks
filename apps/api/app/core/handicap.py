def calculate_handicap_pins(
    average: int | None,
    handicap_base: float,
    handicap_percentage: float,
) -> int:
    if average is None:
        return 0
    handicap = (handicap_base - average) * (handicap_percentage / 100)
    return max(0, int(round(handicap)))