# Bracket Generation Logic Guide

## Overview

BracketWorks uses an advanced constraint-based algorithm to generate tournament brackets that prevent players from facing the same opponents in first-round matches across multiple tournaments. This creates a better experience by ensuring variety in matchups.

## How It Works

### Basic Concept

When generating brackets for a tournament, the system:

1. **Checks History**: Looks up all previous first-round matchups for the tournament's players
2. **Builds Constraints**: Creates a list of "forbidden pairs" - players who shouldn't face each other again
3. **Smart Pairing**: Uses a backtracking algorithm to create pairings that respect these constraints
4. **Records Matches**: Saves the new first-round pairings to prevent future rematches

### The Algorithm

#### Step 1: Load Historical Matchups

```python
# The system queries the match_history table for all previous first-round matches
# involving any players in the current tournament
SELECT player_a_id, player_b_id 
FROM match_history 
WHERE tournament_id IN (previous_tournaments)
  AND (player_a_id IN current_players OR player_b_id IN current_players)
  AND round_number = 1
```

#### Step 2: Constraint-Based Pairing

The pairing algorithm uses **backtracking** - a technique that tries different combinations and backs up when it hits a dead end:

1. **Shuffle players** (deterministic with optional seed for reproducibility)
2. **Try to pair** the first unpaired player with a random available partner
3. **Check constraint**: Has this pair faced each other before?
   - If **NO**: Accept the pair, move to next player
   - If **YES**: Try a different partner
4. **Backtrack** if no valid partner exists - undo previous pair and try again
5. **Attempt up to 1,500 times** with different shuffles

#### Step 3: Swap Rescue (If Pairing Fails)

If a bracket can't be generated after 1,500 attempts, the system tries **cross-bracket swapping**:

1. Takes players who couldn't be paired in one bracket
2. Swaps them with players from another bracket
3. Tries up to 25 swap combinations
4. If successful, continues; if not, players get refunds

#### Step 4: Record New Pairings

After successful bracket generation, all first-round matches are saved to the `match_history` table:

```python
# For each first-round match, we save:
{
    tournament_id: 6,
    player_a_id: 12,  // Normalized: always min ID first
    player_b_id: 45,  // Normalized: always max ID second
    bracket_type: 'scratch' or 'handicap',
    bracket_number: 1,
    round_number: 1,
    created_at: timestamp
}
```

## Bracket Types

### Scratch Brackets
- Players compete at their actual skill level
- No handicap applied
- Tracked separately in match history

### Handicap Brackets
- Players receive pins based on average
- Levels the playing field
- Tracked separately in match history

Both bracket types maintain their own match history to prevent rematches within their respective categories.

## Technical Details

### Database Schema

**match_history table:**
```sql
CREATE TABLE match_history (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER REFERENCES tournament(id),
    player_a_id INTEGER REFERENCES bowler(id),
    player_b_id INTEGER REFERENCES bowler(id),
    bracket_type VARCHAR(20),  -- 'scratch' or 'handicap'
    bracket_number INTEGER,
    round_number INTEGER,
    created_at TIMESTAMP
);
```

**Indexes for performance:**
- `tournament_id` - Fast lookup by tournament
- `player_a_id`, `player_b_id` - Fast lookup by player
- `bracket_type` - Filter by scratch/handicap
- `(bracket_type, round_number)` - Composite index for common queries

### Key Functions

**`generate_brackets_with_constraints()`**
- Main entry point for advanced algorithm
- Parameters:
  - `players`: List of player objects
  - `bracket_size`: 8, 16, 32, etc.
  - `forbidden_pairs`: Set of (player_a, player_b) tuples
  - `seed`: Optional random seed for deterministic results

**`backtrack_make_pairs()`**
- Recursive pairing algorithm
- Tries different partner combinations
- Backs up when constraints violated

**`attempt_swap_rescue()`**
- Cross-bracket rescue mechanism
- Swaps players between brackets when pairing fails
- 25 attempts before giving up

**`fetch_match_history()`**
- Loads historical first-round matchups
- Normalizes player IDs for consistent lookups
- Returns Set of forbidden pairs

**`save_first_round_to_history()`**
- Extracts first-round matches from generated brackets
- Saves to match_history table
- Called automatically after bracket generation

## User Experience

### What Players See

1. **First Tournament**: Players are randomly paired (no history yet)
2. **Second Tournament**: System avoids repeating any first-round matchups from Tournament 1
3. **Third Tournament**: System avoids matchups from Tournaments 1 and 2
4. **And so on...**: Each tournament builds on the history

### Example Scenario

**Tournament 1** (No History):
- Player A vs Player B
- Player C vs Player D

**Tournament 2** (With History):
- Player A vs Player C ✓ (new matchup)
- Player B vs Player D ✓ (new matchup)
- System prevented: A vs B, C vs D (already played)

**Tournament 3** (More Constraints):
- Player A vs Player D ✓ (new matchup)
- Player B vs Player C ✓ (new matchup)
- System prevented: A vs B, A vs C, B vs D, C vs D (all previously played)

### Edge Cases

**Not Enough Players**
- If bracket size requires 8 players but only 6 exist, players get refunds

**Impossible Constraints**
- If everyone has played everyone, system can't generate valid bracket
- All players automatically get refunds
- Error message explains the situation

**Partial Success**
- Some brackets succeed, others fail
- Failed brackets: players get refunds
- Successful brackets: tournament continues normally

## Performance

### Speed
- **No history**: < 50ms per bracket (simple random)
- **Light constraints**: < 200ms per bracket (few backtracks)
- **Heavy constraints**: < 2 seconds per bracket (many backtracks)

### Scalability
- Handles up to 128 players per bracket efficiently
- History lookups use database indexes for speed
- Backtracking limited to 1,500 attempts to prevent hangs

## Configuration

### Enable/Disable History

In the API endpoint:
```python
generate_tournament_brackets(
    db=db,
    tournament_id=tournament_id,
    use_history=True,  # Set to False to disable rematch prevention
    seed=None  # Optional: Set to integer for reproducible brackets
)
```

### Deterministic Mode

For testing or reproducibility:
```python
generate_tournament_brackets(
    db=db,
    tournament_id=tournament_id,
    use_history=True,
    seed=42  # Same seed = same bracket layout
)
```

## Troubleshooting

### "Failed to save brackets" Error
**Cause**: Database transaction issues or missing match_history table  
**Solution**: 
1. Run migration: `alembic upgrade head`
2. Restart backend server
3. Verify database connection

### Brackets Take Too Long to Generate
**Cause**: Too many constraints, algorithm struggling to find valid pairings  
**Solution**:
- System automatically gives up after 1,500 attempts
- Players get refunds if bracket can't be generated
- Consider resetting match history for that player group

### Players Still Getting Same Matchups
**Cause**: Match history not being saved or loaded  
**Solution**:
1. Check `match_history` table has records
2. Verify `use_history=True` in API call
3. Check backend logs for history loading

## Future Enhancements

Potential improvements to the bracket generation system:

1. **Round 2+ History**: Track matchups beyond first round
2. **Cross-Tournament Groups**: Different history pools for different tournament types
3. **Weighted Preferences**: Prefer certain matchups over others (not just forbid)
4. **Manual Overrides**: Admin can force specific pairings
5. **History Expiration**: Forget matchups older than X months
6. **Skill-Based Seeding**: Combine history constraints with skill ranking

## Summary

The bracket generation system provides:

✅ **Automatic rematch prevention** - No repeated first-round matchups  
✅ **Intelligent backtracking** - Finds valid pairings even with many constraints  
✅ **Cross-bracket rescue** - Swaps players between brackets when needed  
✅ **Graceful degradation** - Refunds when bracket can't be generated  
✅ **Performance optimized** - Fast even with large player pools  
✅ **Battle tested** - Comprehensive test suite with 7 scenarios  

This creates a better tournament experience by ensuring variety and fairness across multiple events.
