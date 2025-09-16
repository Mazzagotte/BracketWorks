
def generate_bracket_preview(size: int = 8):
    # Very simple single-elim preview bracket seeding (stub).
    seeds = list(range(1, size + 1))
    pairs = list(zip(seeds[: size//2], reversed(seeds[: size//2])))
    return {
        "size": size,
        "rounds": [
            {"name": "Round 1", "matches": [{"seedA": a, "seedB": b} for a, b in pairs]}
        ]
    }
