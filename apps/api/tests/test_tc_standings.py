"""Pure tests for the TC standings engine (no database)."""

from __future__ import annotations

from app.services import tc_standings as engine
from app.services.tc_standings import BowlerIn, EntryIn, FinalsGameIn, FinalsIn, StandingsInput, TournamentIn


def _event(event_id="ev1", *, scoring="handicap", max_players=1, **rules):
    return {"id": event_id, "name": event_id.upper(), "scoring": scoring, "maxPlayers": max_players, "rules": rules or None}


def _input(events, entries, bowlers, scores=None, *, divisions=None, finals=None, details=None, fees=None, side_events=None):
    return StandingsInput(
        tournament=TournamentIn(id=1, name="Test Open", date_text="Nov 15, 2026", location_text="Lanes"),
        setup={
            "events": events,
            "divisions": divisions or [],
            "details": details or {},
            "fees": fees or [],
        },
        bowlers={bowler.id: bowler for bowler in bowlers},
        entries=entries,
        scores=scores or {},
        finals=finals or [],
        side_events=side_events or [],
    )


def _bowlers(*specs):
    """specs: (id, "First Last", average)."""
    result = []
    for bowler_id, name, average in specs:
        first, last = name.split(" ", 1)
        result.append(BowlerIn(id=bowler_id, first_name=first, last_name=last, average=average, registration_id=bowler_id))
    return result


def _scores(entry_id, bowler_id, *games):
    return {(entry_id, bowler_id): {index + 1: value for index, value in enumerate(games)}}


def _division(payload, event_index=0, division_index=0):
    return payload["events"][event_index]["divisions"][division_index]


# ---------------------------------------------------------------------------
# Handicap


def test_handicap_pins_floor_and_cap():
    rule = {"percent": 90, "basis": 220, "maxPins": None, "perPair": False}
    assert engine.handicap_pins(rule, 183) == 33  # 37 * .9 = 33.3
    assert engine.handicap_pins(rule, 230) == 0
    assert engine.handicap_pins({**rule, "maxPins": 20}, 150) == 20
    assert engine.handicap_pins({"percent": 80, "basis": 210, "maxPins": None}, 160) == 40


def test_no_tap_and_scratch_never_get_handicap():
    bowlers = _bowlers((1, "Ann Lee", 150))
    for scoring in ("no-tap", "scratch"):
        data = _input(
            [_event(scoring=scoring, games=3, handicap={"percent": 100, "basis": 230})],
            [EntryIn(id=1, event_id="ev1", bowler_ids=(1,))],
            bowlers,
            _scores(1, 1, 200, 210, 220),
        )
        row = _division(engine.compute_standings(data))["rows"][0]
        assert row["handicapTotal"] == 0
        assert row["bowlers"][0]["handicapPerGame"] == 0
        assert row["total"] == 630
    labels = [
        engine.scoring_label("no-tap", engine.normalize_event_rules({}, scoring="no-tap", max_players=1)),
        engine.scoring_label("scratch", engine.normalize_event_rules({}, scoring="scratch", max_players=1)),
    ]
    assert labels == ["9-pin no-tap, scratch", "Scratch"]


def test_handicap_totals_use_games_bowled_and_assigned_average():
    bowlers = [*_bowlers((1, "Ann Lee", 180)), BowlerIn(id=2, first_name="Bob", last_name="Ray", average=None)]
    data = _input(
        [_event(games=3, handicap={"percent": 90, "basis": 220, "maxPins": None},
                average={"noAverage": "assigned-average", "assignedAverage": 200})],
        [EntryIn(id=1, event_id="ev1", bowler_ids=(1,)), EntryIn(id=2, event_id="ev1", bowler_ids=(2,))],
        bowlers,
        {**_scores(1, 1, 200, 190), **_scores(2, 2, 210)},
    )
    payload = engine.compute_standings(data)
    assert payload["events"][0]["scoringLabel"] == "Handicap 90% of 220"
    rows = {row["name"]: row for row in _division(payload)["rows"]}
    assert rows["Ann Lee"]["handicapTotal"] == 36 * 2
    assert rows["Ann Lee"]["total"] == 390 + 72
    assert rows["Ann Lee"]["games"] == [200, 190, None]
    assert rows["Bob Ray"]["bowlers"][0]["handicapPerGame"] == 18
    assert rows["Bob Ray"]["handicapTotal"] == 18


def test_missing_average_without_assigned_average_gets_zero():
    bowlers = [BowlerIn(id=1, first_name="No", last_name="Avg", average=None)]
    data = _input([_event(games=1)], [EntryIn(id=1, event_id="ev1", bowler_ids=(1,))], bowlers, _scores(1, 1, 180))
    assert _division(engine.compute_standings(data))["rows"][0]["handicapTotal"] == 0


def test_scotch_doubles_handicap_per_pair_and_shared_score():
    bowlers = _bowlers((1, "Ann Lee", 180), (2, "Bob Ray", 170))
    event = _event(scoring="handicap", max_players=2, format="scotch-doubles", games=2,
                   handicap={"percent": 80, "basis": 440, "maxPins": None, "perPair": True})
    data = _input([event], [EntryIn(id=1, event_id="ev1", bowler_ids=(1, 2))], bowlers, _scores(1, 1, 190, 200))
    row = _division(engine.compute_standings(data))["rows"][0]
    # (440 - 350) * .8 = 72 per game for the pair, split 36/36.
    assert [bowler["handicapPerGame"] for bowler in row["bowlers"]] == [36, 36]
    assert row["handicapTotal"] == 144
    assert row["total"] == 390 + 144
    assert row["name"] == "Ann Lee & Bob Ray"


def test_doubles_and_team_sum_bowler_scores():
    bowlers = _bowlers((1, "Ann Lee", None), (2, "Bob Ray", None), (3, "Cy Do", None), (4, "Di Fo", None))
    events = [_event("dbl", scoring="scratch", max_players=2, games=2), _event("team", scoring="scratch", max_players=4, games=1)]
    entries = [EntryIn(id=1, event_id="dbl", bowler_ids=(1, 2)), EntryIn(id=2, event_id="team", bowler_ids=(1, 2, 3, 4))]
    scores = {**_scores(1, 1, 200, 210), **_scores(1, 2, 150, 160)}
    for bowler_id, value in ((1, 190), (2, 180), (3, 170), (4, 160)):
        scores.update(_scores(2, bowler_id, value))
    payload = engine.compute_standings(_input(events, entries, bowlers, scores))
    assert _division(payload, 0)["rows"][0]["games"] == [350, 370]
    team_row = _division(payload, 1)["rows"][0]
    assert team_row["games"] == [700]
    assert team_row["name"] == "Lee, Ray, Do & Fo"


# ---------------------------------------------------------------------------
# Ranking, re-entries, lines


def test_ties_share_rank_and_unbowled_rows_sort_last():
    bowlers = _bowlers((1, "Ann Lee", None), (2, "Bob Ray", None), (3, "Cy Do", None), (4, "Di Fo", None))
    entries = [EntryIn(id=i, event_id="ev1", bowler_ids=(i,)) for i in (1, 2, 3, 4)]
    scores = {**_scores(1, 1, 200), **_scores(2, 2, 220), **_scores(3, 3, 200)}
    rows = _division(engine.compute_standings(_input([_event(scoring="scratch", games=1)], entries, bowlers, scores)))["rows"]
    assert [(row["name"], row["rank"], row["tied"]) for row in rows] == [
        ("Bob Ray", 1, False), ("Ann Lee", 2, True), ("Cy Do", 2, True), ("Di Fo", None, False),
    ]


def test_all_count_labels_reentries_and_best_counts_keeps_best_set():
    bowlers = [
        BowlerIn(id=1, first_name="Ann", last_name="Lee", usbc_number="123-456"),
        BowlerIn(id=2, first_name="Ann", last_name="Lee", usbc_number="123456"),
        BowlerIn(id=3, first_name="Bob", last_name="Ray"),
    ]
    entries = [
        EntryIn(id=1, event_id="ev1", bowler_ids=(1,)),
        EntryIn(id=2, event_id="ev1", bowler_ids=(2,)),
        EntryIn(id=3, event_id="ev1", bowler_ids=(3,)),
    ]
    scores = {**_scores(1, 1, 180, 190), **_scores(2, 2, 230, 220), **_scores(3, 3, 200, 200)}
    all_count = engine.compute_standings(_input([_event(scoring="scratch", games=2)], entries, bowlers, scores))
    names = [row["name"] for row in _division(all_count)["rows"]]
    assert names == ["Ann Lee (re-entry 1)", "Bob Ray", "Ann Lee"]

    best = engine.compute_standings(
        _input([_event(scoring="scratch", games=2, reentryScoring="best-counts")], entries, bowlers, scores)
    )
    division = _division(best)
    assert division["entryCount"] == 3
    assert [(row["key"], row["name"], row["total"]) for row in division["rows"]] == [
        ("bowler:1", "Ann Lee", 450), ("bowler:3", "Bob Ray", 400),
    ]


def test_cut_and_cash_lines():
    bowlers = _bowlers(*[(i, f"B{i} X{i}", None) for i in range(1, 11)])
    entries = [EntryIn(id=i, event_id="ev1", bowler_ids=(i,)) for i in range(1, 11)]
    scores = {}
    for i in range(1, 11):
        scores.update(_scores(i, i, 300 - i * 10))
    event = _event(scoring="scratch", games=1, finals={"type": "cut", "cut": {"by": "count", "value": 2}}, payoutRatio=4)
    division = _division(engine.compute_standings(_input([event], entries, bowlers, scores)))
    assert division["advancingCount"] == 2
    assert division["cashingCount"] == 3
    assert [row["status"] for row in division["rows"][:4]] == ["advancing", "advancing", "cashing", None]

    percent = _event(scoring="scratch", games=1, finals={"type": "cut", "cut": {"by": "percent", "value": 25}})
    assert _division(engine.compute_standings(_input([percent], entries, bowlers, scores)))["advancingCount"] == 3


def test_finals_default_field_sizes_capped_at_entries():
    bowlers = _bowlers(*[(i, f"B{i} X{i}", None) for i in range(1, 4)])
    entries = [EntryIn(id=i, event_id="ev1", bowler_ids=(i,)) for i in range(1, 4)]
    for finals_type, expected in (("stepladder", 3), ("match-play-single", 3), ("none", None)):
        event = _event(scoring="scratch", games=1, finals={"type": finals_type})
        assert _division(engine.compute_standings(_input([event], entries, bowlers)))["advancingCount"] == expected
    rules = engine.normalize_event_rules({"finals": {"type": "round-robin"}}, scoring="scratch", max_players=1)
    assert engine.finals_field_size(rules, 20, 20) == 6
    rules = engine.normalize_event_rules({"finals": {"type": "survivor"}}, scoring="scratch", max_players=1)
    assert engine.finals_field_size(rules, 20, 20) == 8


def test_divisions_split_rows_and_events_without_divisions_get_one_null_division():
    bowlers = _bowlers((1, "Ann Lee", None), (2, "Bob Ray", None))
    divisions = [
        {"id": "d1", "name": "Men", "eventIds": ["ev1"]},
        {"id": "d2", "name": "Women", "eventIds": ["ev1"]},
    ]
    entries = [
        EntryIn(id=1, event_id="ev1", bowler_ids=(1,), division_id="d2"),
        EntryIn(id=2, event_id="ev2", bowler_ids=(2,)),
    ]
    payload = engine.compute_standings(
        _input([_event("ev1", scoring="scratch"), _event("ev2", scoring="scratch")], entries, bowlers, divisions=divisions)
    )
    assert [(d["id"], d["entryCount"]) for d in payload["events"][0]["divisions"]] == [("d1", 0), ("d2", 1)]
    assert [(d["id"], d["name"]) for d in payload["events"][1]["divisions"]] == [(None, None)]


# ---------------------------------------------------------------------------
# All Events


def test_all_events_for_association_counts_bowlers_in_every_event():
    bowlers = _bowlers((1, "Ann Lee", 180), (2, "Bob Ray", 200), (3, "Cy Do", 190))
    events = [
        _event("singles", games=1, handicap={"percent": 100, "basis": 200}, payoutRatio=2),
        _event("doubles", max_players=2, games=1, handicap={"percent": 100, "basis": 200}),
    ]
    entries = [
        EntryIn(id=1, event_id="singles", bowler_ids=(1,)),
        EntryIn(id=2, event_id="singles", bowler_ids=(2,)),
        EntryIn(id=3, event_id="doubles", bowler_ids=(1, 2)),
        EntryIn(id=4, event_id="singles", bowler_ids=(3,)),
    ]
    scores = {**_scores(1, 1, 200), **_scores(2, 2, 210), **_scores(3, 1, 190), **_scores(3, 2, 230), **_scores(4, 3, 250)}
    payload = engine.compute_standings(_input(events, entries, bowlers, scores, details={"formatTemplateId": "association"}))
    all_events = payload["allEvents"]
    assert [event["id"] for event in all_events["events"]] == ["singles", "doubles"]
    rows = {row["name"]: row for row in all_events["rows"]}
    assert set(rows) == {"Ann Lee", "Bob Ray"}  # Cy Do skipped doubles
    assert rows["Ann Lee"]["eventTotals"] == [220, 210]  # own share: score + own 20 handicap
    assert rows["Bob Ray"]["eventTotals"] == [210, 230]
    assert rows["Bob Ray"]["rank"] == 1
    assert all_events["cashingCount"] == 1
    assert rows["Bob Ray"]["status"] == "cashing"
    assert rows["Ann Lee"]["status"] is None


def test_all_events_fee_limits_rows_to_buyers():
    bowlers = _bowlers((1, "Ann Lee", None), (2, "Bob Ray", None))
    events = [_event("singles", scoring="scratch", games=1), _event("second", scoring="scratch", games=1)]
    entries = [
        EntryIn(id=1, event_id="singles", bowler_ids=(1,)), EntryIn(id=2, event_id="singles", bowler_ids=(2,)),
        EntryIn(id=3, event_id="second", bowler_ids=(1,)), EntryIn(id=4, event_id="second", bowler_ids=(2,)),
    ]
    fees = [{"id": "fee-ae", "name": "All Events", "sideEvent": {"kind": "fee"}}]
    scores = {**_scores(1, 1, 200), **_scores(2, 2, 210), **_scores(3, 1, 190), **_scores(4, 2, 180)}
    payload = engine.compute_standings(_input(events, entries, bowlers, scores, fees=fees, side_events=[("fee-ae", 2, 2)]))
    assert [row["name"] for row in payload["allEvents"]["rows"]] == ["Bob Ray"]
    assert engine.compute_standings(_input(events, entries, bowlers))["allEvents"] is None


def test_all_events_needs_at_least_two_events():
    bowlers = _bowlers((1, "Ann Lee", None))
    events = [_event("singles", scoring="scratch", games=1)]
    entries = [EntryIn(id=1, event_id="singles", bowler_ids=(1,))]
    payload = engine.compute_standings(
        _input(events, entries, bowlers, _scores(1, 1, 200), details={"formatTemplateId": "association"})
    )
    assert payload["allEvents"] is None


# ---------------------------------------------------------------------------
# Finals


def _seeds(count, handicap=0):
    return [{"seed": i, "key": str(i), "name": f"Seed {i}", "entryIds": [i], "bowlerIds": [i], "handicapPerGame": handicap}
            for i in range(1, count + 1)]


def _finals(finals_type, seeds, games, rules=None, handicap=False):
    rules = engine.normalize_event_rules({"finals": {"type": finals_type, **(rules or {})}}, scoring="handicap" if handicap else "scratch", max_players=1)
    stored = FinalsIn(event_id="ev1", division_id=None, type=finals_type, seeds=seeds,
                      games=[FinalsGameIn(round=r, match=m, seed=s, score=v) for r, m, s, v in games])
    return engine.compute_finals(finals_type, rules, stored, handicap=handicap, field_size=len(seeds))


def test_stepladder_climbs_to_title_match_with_handicap():
    games = [(1, 1, 4, 200), (1, 1, 3, 190), (2, 1, 4, 210), (2, 1, 2, 180), (3, 1, 4, 170), (3, 1, 1, 220)]
    finals = _finals("stepladder", _seeds(4, handicap=10), games, handicap=True)
    assert finals["label"] == "Stepladder, top 4"
    assert [m["label"] for m in finals["matches"]] == ["Match 1", "Match 2", "Title match"]
    first = finals["matches"][0]
    assert (first["a"]["seed"], first["b"]["seed"], first["a"]["score"], first["a"]["winner"]) == (4, 3, 210, True)
    assert finals["matches"][2]["a"]["seed"] == 4
    assert finals["status"] == "complete"
    assert finals["champion"] == {"name": "Seed 1", "detail": "Won the title match 230 to 180"}


def test_stepladder_tie_leaves_match_open_and_future_matches_unknown():
    finals = _finals("stepladder", _seeds(3), [(1, 1, 3, 200), (1, 1, 2, 200)])
    assert finals["status"] == "in-progress"
    assert finals["matches"][0]["a"]["winner"] is False and finals["matches"][0]["b"]["winner"] is False
    assert finals["matches"][1]["a"] is None  # waiting on Match 1
    assert finals["matches"][1]["b"]["seed"] == 1 and finals["matches"][1]["b"]["score"] is None
    assert "roll-off" in finals["notes"]


def test_match_play_seeding_with_byes():
    assert engine.seeding_order(8) == [1, 8, 4, 5, 2, 7, 3, 6]
    games = [(1, 2, 4, 200), (1, 2, 5, 190), (1, 4, 3, 180), (1, 4, 6, 210)]
    finals = _finals("match-play-single", _seeds(6), games)
    first_round = [m for m in finals["matches"] if m["round"] == 1]
    assert [m["label"] for m in first_round] == ["Quarterfinal 1", "Quarterfinal 2", "Quarterfinal 3", "Quarterfinal 4"]
    assert first_round[0]["b"] is None and first_round[0]["a"]["winner"] is True  # 1 has a bye
    semis = [m for m in finals["matches"] if m["round"] == 2]
    assert (semis[0]["a"]["seed"], semis[0]["b"]["seed"]) == (1, 4)
    assert (semis[1]["a"]["seed"], semis[1]["b"]["seed"]) == (2, 6)
    final = finals["matches"][-1]
    assert final["label"] == "Final" and final["a"] is None and final["b"] is None
    assert finals["status"] == "in-progress"

    semis_done = _finals("match-play-single", _seeds(6), games + [(2, 1, 1, 220), (2, 1, 4, 200)])
    final = semis_done["matches"][-1]
    assert final["a"] is None and final["b"]["seed"] == 1  # one finalist known, the other still to be decided


def test_match_play_two_seeds_final_crowns_champion():
    finals = _finals("match-play-single", _seeds(2), [(1, 1, 1, 190), (1, 1, 2, 214)])
    assert finals["champion"] == {"name": "Seed 2", "detail": "Won the final 214 to 190"}
    assert finals["status"] == "complete"


def test_round_robin_petersen_points():
    seeds = _seeds(3)
    schedule = engine.round_robin_schedule([1, 2, 3])
    assert sorted(pair for round_ in schedule for pair in round_) == [(1, 2), (1, 3), (2, 3)]
    scores = {1: 210, 2: 190, 3: 200}
    games = []
    for round_index, pairs in enumerate(schedule, start=1):
        for match_index, (a, b) in enumerate(pairs, start=1):
            games += [(round_index, match_index, a, scores[a]), (round_index, match_index, b, scores[b])]
    finals = _finals("round-robin", seeds, games, rules={"roundRobinScoring": "petersen"})
    table = {row["seed"]: row for row in finals["table"]}
    # Seed 1: 2 wins + floor(210/50)=4 per game twice = 10.
    assert table[1]["points"] == 10 and table[1]["wins"] == 2 and table[1]["rank"] == 1
    assert table[1]["key"] == "1"
    assert table[3]["points"] == 1 + 8
    assert table[2]["points"] == 0 + 6
    assert finals["champion"]["name"] == "Seed 1"
    assert finals["label"] == "Round robin, Petersen points"


def test_round_robin_bonus_pins_and_ties_split():
    seeds = _seeds(2)
    finals = _finals("round-robin", seeds, [(1, 1, 1, 200), (1, 1, 2, 200)], rules={"roundRobinScoring": "bonus-pins", "winBonusPins": 30})
    assert [row["points"] for row in finals["table"]] == [215, 215]
    assert [row["ties"] for row in finals["table"]] == [1, 1]
    assert finals["label"] == "Round robin, 30 bonus pins per win"


def test_survivor_eliminates_lowest_half_each_round():
    games = [
        (1, 1, 1, 200), (1, 1, 2, 150), (1, 1, 3, 190), (1, 1, 4, 160), (1, 1, 5, 210),
        (2, 1, 1, 180), (2, 1, 3, 230), (2, 1, 5, 200),
        (3, 1, 3, 240), (3, 1, 5, 220),
    ]
    finals = _finals("survivor", _seeds(5), games)
    round_one = {row["seed"]: row["eliminated"] for row in finals["rounds"][0]["rows"]}
    assert round_one == {1: False, 2: True, 3: False, 4: True, 5: False}
    assert [row["key"] for row in finals["rounds"][0]["rows"]] == ["1", "2", "3", "4", "5"]
    assert [row["seed"] for row in finals["rounds"][1]["rows"]] == [1, 3, 5]
    assert {row["seed"] for row in finals["rounds"][1]["rows"] if row["eliminated"]} == {1}
    assert finals["champion"]["name"] == "Seed 3"
    assert finals["status"] == "complete"


def test_survivor_tie_at_cut_waits_for_roll_off():
    finals = _finals("survivor", _seeds(3), [(1, 1, 1, 200), (1, 1, 2, 180), (1, 1, 3, 180)])
    assert len(finals["rounds"]) == 1
    assert not any(row["eliminated"] for row in finals["rounds"][0]["rows"])
    assert finals["status"] == "in-progress"


def test_double_elimination_is_not_started_yet():
    rules = engine.normalize_event_rules({"finals": {"type": "match-play-double"}}, scoring="scratch", max_players=1)
    finals = engine.compute_finals("match-play-double", rules, None, handicap=False, field_size=8)
    assert finals["status"] == "not-started"
    assert finals["notes"] == "Double elimination finals are coming soon."


# ---------------------------------------------------------------------------
# Tournament status and fingerprint


def test_status_and_fingerprint():
    bowlers = _bowlers((1, "Ann Lee", None), (2, "Bob Ray", None))
    entries = [EntryIn(id=1, event_id="ev1", bowler_ids=(1,)), EntryIn(id=2, event_id="ev1", bowler_ids=(2,))]
    event = _event(scoring="scratch", games=2)
    upcoming = engine.compute_standings(_input([event], entries, bowlers))
    assert upcoming["tournament"]["status"] == "upcoming"
    partial = engine.compute_standings(_input([event], entries, bowlers, {**_scores(1, 1, 200, 210), **_scores(2, 2, 190)}))
    assert partial["tournament"]["status"] == "in-progress"
    done = engine.compute_standings(_input([event], entries, bowlers, {**_scores(1, 1, 200, 210), **_scores(2, 2, 190, 180)}))
    assert done["tournament"]["status"] == "final"
    assert len({upcoming["fingerprint"], partial["fingerprint"], done["fingerprint"]}) == 3
    again = engine.compute_standings(_input([event], entries, bowlers, {**_scores(1, 1, 200, 210), **_scores(2, 2, 190, 180)}))
    assert again["fingerprint"] == done["fingerprint"]

    with_finals = _event(scoring="scratch", games=2, finals={"type": "stepladder"})
    seeds = _seeds(2)
    stored = FinalsIn(event_id="ev1", division_id=None, type="stepladder", seeds=seeds,
                      games=[FinalsGameIn(1, 1, 1, 200), FinalsGameIn(1, 1, 2, 190)])
    scores = {**_scores(1, 1, 200, 210), **_scores(2, 2, 190, 180)}
    assert engine.compute_standings(_input([with_finals], entries, bowlers, scores))["tournament"]["status"] == "in-progress"
    assert engine.compute_standings(_input([with_finals], entries, bowlers, scores, finals=[stored]))["tournament"]["status"] == "final"


def test_display_text_helpers():
    assert engine.date_text("2026-11-15", "2026-11-15") == "Nov 15, 2026"
    assert engine.date_text("2027-02-27", "2027-02-28") == "Feb 27 - Feb 28, 2027"
    assert engine.squad_label("Morning", "2026-11-14", "14:00") == "Sat 2:00 PM"
    assert engine.squad_label("Morning", None, None) == "Morning"
    assert engine.location_text({"bowlingCenter": "Meridian Lanes", "city": "Meridian", "state": "ID"}, None) == "Meridian Lanes, Meridian, ID"
