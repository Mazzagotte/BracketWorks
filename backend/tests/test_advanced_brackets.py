"""
Test suite for advanced bracket generation with constraint-based pairing.

Tests various scenarios:
1. No history (simple case)
2. Small history (few constraints)
3. Heavy constraints (many forbidden pairings)
4. Impossible constraints (no valid pairing exists)
5. Swap rescue (failing bracket gets fixed via swaps)
"""
import sys
sys.path.append('..')

from backend.app.services.brackets_advanced import (
    generate_brackets_with_constraints,
    normalize_pair,
    is_forbidden,
    fisher_yates_shuffle,
    dedupe_by_id,
    is_power_of_two
)
import random


def create_test_entries(num_players: int, name_prefix: str = "Player") -> list:
    """Create test player entries"""
    entries = []
    for i in range(num_players):
        entries.append({
            'player_id': i + 1,
            'name': f"{name_prefix} {i + 1}",
            'average': 180 + (i * 5),
            'entry_number': 1
        })
    return entries


def print_bracket_summary(result: dict):
    """Print summary of bracket generation result"""
    print(f"\n{'='*60}")
    print(f"Brackets Created: {len(result['brackets'])}")
    print(f"Players Refunded: {len(result['refunded'])}")
    
    for i, bracket in enumerate(result['brackets'], 1):
        print(f"\nBracket {i}:")
        print(f"  Entrants: {len(bracket['entrants'])}")
        print(f"  First Round Matches: {len(bracket['pairings'])}")
        for j, pairing in enumerate(bracket['pairings'], 1):
            home = pairing['home']
            away = pairing['away']
            print(f"    Match {j}: {home['name']} (ID {home['player_id']}) vs {away['name']} (ID {away['player_id']})")
    
    if result['refunded']:
        print(f"\nRefunded Players:")
        for entry in result['refunded']:
            print(f"  - {entry['name']} (ID {entry['player_id']})")
    print(f"{'='*60}\n")


def test_no_history():
    """Test 1: No history - should work like simple random"""
    print("\n" + "="*60)
    print("TEST 1: No History (Simple Random)")
    print("="*60)
    
    entries = create_test_entries(16)
    history_set = set()  # Empty history
    
    result = generate_brackets_with_constraints(
        entries=entries,
        bracket_size=8,
        history_set=history_set,
        seed=42  # Deterministic
    )
    
    print_bracket_summary(result)
    
    # Assertions
    assert len(result['brackets']) == 2, "Should create 2 brackets from 16 players"
    assert len(result['refunded']) == 0, "No refunds expected"
    print("TEST 1 PASSED")


def test_small_history():
    """Test 2: Small history - few forbidden pairings"""
    print("\n" + "="*60)
    print("TEST 2: Small History (Few Constraints)")
    print("="*60)
    
    entries = create_test_entries(8)
    
    # Forbid a few matchups
    history_set = {
        normalize_pair(1, 2),  # Player 1 vs 2
        normalize_pair(3, 4),  # Player 3 vs 4
    }
    
    print(f"Forbidden pairings: {history_set}")
    
    result = generate_brackets_with_constraints(
        entries=entries,
        bracket_size=8,
        history_set=history_set,
        seed=42
    )
    
    print_bracket_summary(result)
    
    # Verify constraints are respected
    for bracket in result['brackets']:
        for pairing in bracket['pairings']:
            pair = normalize_pair(pairing['home']['player_id'], pairing['away']['player_id'])
            assert pair not in history_set, f"Forbidden pairing found: {pair}"
    
    assert len(result['brackets']) == 1, "Should create 1 bracket"
    print("TEST 2 PASSED - No forbidden pairings in results")


def test_heavy_constraints():
    """Test 3: Heavy constraints - many forbidden pairings"""
    print("\n" + "="*60)
    print("TEST 3: Heavy Constraints (Many Forbidden Pairings)")
    print("="*60)
    
    entries = create_test_entries(8)
    
    # Create many forbidden pairings (but still solvable)
    history_set = {
        normalize_pair(1, 2),
        normalize_pair(1, 3),
        normalize_pair(2, 4),
        normalize_pair(3, 5),
        normalize_pair(4, 6),
        normalize_pair(5, 7),
        normalize_pair(6, 8),
    }
    
    print(f"Forbidden pairings: {len(history_set)} pairs")
    print(f"Pairs: {history_set}")
    
    result = generate_brackets_with_constraints(
        entries=entries,
        bracket_size=8,
        history_set=history_set,
        seed=42,
        max_attempts_per_bracket=2000  # Increase attempts for complex constraints
    )
    
    print_bracket_summary(result)
    
    # Verify constraints
    for bracket in result['brackets']:
        for pairing in bracket['pairings']:
            pair = normalize_pair(pairing['home']['player_id'], pairing['away']['player_id'])
            assert pair not in history_set, f"Forbidden pairing found: {pair}"
    
    print("TEST 3 PASSED - Heavy constraints respected")


def test_impossible_constraints():
    """Test 4: Impossible constraints - no valid pairing exists"""
    print("\n" + "="*60)
    print("TEST 4: Impossible Constraints (Should Refund)")
    print("="*60)
    
    entries = create_test_entries(4)
    
    # Create impossible constraint: player 1 can't play anyone
    history_set = {
        normalize_pair(1, 2),
        normalize_pair(1, 3),
        normalize_pair(1, 4),
    }
    
    print(f"Forbidden pairings (Player 1 can't play anyone): {history_set}")
    
    result = generate_brackets_with_constraints(
        entries=entries,
        bracket_size=4,
        history_set=history_set,
        seed=42,
        max_attempts_per_bracket=500,
        swap_rescue_tries=50
    )
    
    print_bracket_summary(result)
    
    # Should refund all players since no valid bracket possible
    assert len(result['brackets']) == 0, "No brackets should be created"
    assert len(result['refunded']) == 4, "All players should be refunded"
    print("TEST 4 PASSED - Correctly refunded impossible case")


def test_multiple_brackets_with_history():
    """Test 5: Multiple brackets with history constraints"""
    print("\n" + "="*60)
    print("TEST 5: Multiple Brackets with History")
    print("="*60)
    
    entries = create_test_entries(24)
    
    # Some forbidden pairings across potential brackets
    history_set = {
        normalize_pair(1, 5),
        normalize_pair(2, 6),
        normalize_pair(9, 13),
        normalize_pair(10, 14),
        normalize_pair(17, 21),
    }
    
    print(f"Total entries: {len(entries)}")
    print(f"Forbidden pairings: {len(history_set)}")
    
    result = generate_brackets_with_constraints(
        entries=entries,
        bracket_size=8,
        history_set=history_set,
        seed=42
    )
    
    print_bracket_summary(result)
    
    # Verify constraints
    for bracket in result['brackets']:
        for pairing in bracket['pairings']:
            pair = normalize_pair(pairing['home']['player_id'], pairing['away']['player_id'])
            assert pair not in history_set, f"Forbidden pairing found: {pair}"
    
    assert len(result['brackets']) == 3, "Should create 3 brackets from 24 players"
    assert len(result['refunded']) == 0, "No refunds expected"
    print("TEST 5 PASSED")


def test_deterministic_seeding():
    """Test 6: Deterministic RNG - same seed produces same results"""
    print("\n" + "="*60)
    print("TEST 6: Deterministic Seeding")
    print("="*60)
    
    entries = create_test_entries(8)
    history_set = set()
    
    # Generate twice with same seed
    result1 = generate_brackets_with_constraints(
        entries=entries,
        bracket_size=8,
        history_set=history_set,
        seed=12345
    )
    
    result2 = generate_brackets_with_constraints(
        entries=entries,
        bracket_size=8,
        history_set=history_set,
        seed=12345
    )
    
    # Extract player IDs from pairings
    def get_pairing_ids(result):
        return [
            (p['home']['player_id'], p['away']['player_id'])
            for bracket in result['brackets']
            for p in bracket['pairings']
        ]
    
    pairings1 = get_pairing_ids(result1)
    pairings2 = get_pairing_ids(result2)
    
    print(f"Run 1 pairings: {pairings1}")
    print(f"Run 2 pairings: {pairings2}")
    
    assert pairings1 == pairings2, "Same seed should produce identical results"
    print("TEST 6 PASSED - Deterministic seeding works")


def test_duplicate_prevention():
    """Test 7: Same player can't appear twice in one bracket"""
    print("\n" + "="*60)
    print("TEST 7: Duplicate Prevention")
    print("="*60)
    
    # Create entries with duplicates
    entries = [
        {'player_id': 1, 'name': 'Player 1', 'average': 180, 'entry_number': 1},
        {'player_id': 2, 'name': 'Player 2', 'average': 180, 'entry_number': 1},
        {'player_id': 1, 'name': 'Player 1', 'average': 180, 'entry_number': 2},  # Duplicate!
        {'player_id': 3, 'name': 'Player 3', 'average': 180, 'entry_number': 1},
        {'player_id': 4, 'name': 'Player 4', 'average': 180, 'entry_number': 1},
        {'player_id': 5, 'name': 'Player 5', 'average': 180, 'entry_number': 1},
        {'player_id': 6, 'name': 'Player 6', 'average': 180, 'entry_number': 1},
        {'player_id': 7, 'name': 'Player 7', 'average': 180, 'entry_number': 1},
    ]
    
    print(f"Entries with duplicate player_id=1: {len(entries)}")
    
    result = generate_brackets_with_constraints(
        entries=entries,
        bracket_size=8,
        history_set=set(),
        seed=42
    )
    
    print_bracket_summary(result)
    
    # Check no player appears twice in same bracket
    for bracket in result['brackets']:
        player_ids = [p['player_id'] for p in bracket['entrants']]
        assert len(player_ids) == len(set(player_ids)), "Duplicate player in bracket!"
    
    print("TEST 7 PASSED - No duplicates in same bracket")


def run_all_tests():
    """Run all test scenarios"""
    print("\n" + "="*80)
    print(" ADVANCED BRACKET GENERATION - COMPREHENSIVE TEST SUITE")
    print("="*80)
    
    try:
        test_no_history()
        test_small_history()
        test_heavy_constraints()
        test_impossible_constraints()
        test_multiple_brackets_with_history()
        test_deterministic_seeding()
        test_duplicate_prevention()
        
        print("\n" + "="*80)
        print("ALL TESTS PASSED!")
        print("="*80 + "\n")
        
    except AssertionError as e:
        print(f"\nTEST FAILED: {e}\n")
        raise
    except Exception as e:
        print(f"\nERROR: {e}\n")
        raise


if __name__ == "__main__":
    run_all_tests()
