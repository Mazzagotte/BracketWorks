from app.services import brackets_simple
from app.services import brackets_experimental


def test_experimental_optimizer_failure_falls_back_to_standard(monkeypatch):
    def fail_optimizer(**_kwargs):
        raise RuntimeError("optimizer failed")

    monkeypatch.setattr(
        brackets_simple,
        "generate_brackets_experimental",
        fail_optimizer,
    )

    players = [
        {
            "id": player_id,
            "firstName": f"Player{player_id}",
            "lastName": "Test",
            "average": 180,
            "division": "Open",
            "scratch": 1,
            "handicap": 0,
            "bracket_entries": {"scratch": 1},
            "scores": {},
        }
        for player_id in range(1, 9)
    ]

    result = brackets_simple.generate_tournament_brackets(
        players=players,
        bracket_size=8,
        use_history=False,
        seed=1234,
        use_experimental_optimizer=True,
        experimental_attempts=2,
    )

    scratch_group = next(
        group for group in result["bracket_groups"] if group["key"] == "scratch"
    )
    assert scratch_group["brackets"]
    assert scratch_group["generation_debug"]["mode"] == "standard_fallback"
    assert scratch_group["generation_debug"]["fallback_reason"] == "optimizer failed"


def test_experimental_optimizer_stops_after_optimal_candidate(monkeypatch):
    calls = 0

    def build_optimal_candidate(**_kwargs):
        nonlocal calls
        calls += 1
        matches = [
            {
                "playerA_id": left,
                "playerB_id": right,
            }
            for left, right in ((1, 2), (3, 4), (5, 6), (7, 8))
        ]
        return ([{"rounds": [{"matches": matches}]}], [])

    monkeypatch.setattr(
        brackets_experimental,
        "create_brackets_with_history",
        build_optimal_candidate,
    )

    entries = [
        {"player_id": player_id, "entry_number": 1}
        for player_id in range(1, 9)
    ]
    result = brackets_experimental.generate_brackets_experimental(
        entries=entries,
        bracket_size=8,
        bracket_type="Scratch",
        seed=1234,
        config=brackets_experimental.ExperimentalConfig(attempts=64),
    )

    assert calls == 1
    assert result.attempts_evaluated == 1
    assert result.selected.placed_entries == 8
    assert result.selected.unique_pairs == 4
