# Score Field Naming Convention

This document explains the naming conventions used throughout the BracketWorks codebase for bowling scores.

## Database Schema (Snake Case)

**Table: `score`**
```python
class Score(Base):
    bowler_id: int           # FK to bowler.id
    tournament_id: int       # FK to tournament.id
    squad_id: int            # FK to squad.id
    game1_scratch: int       # Game 1 scratch score (without handicap)
    game1_total: int         # Game 1 total score (with handicap)
    game2_scratch: int       # Game 2 scratch score
    game2_total: int         # Game 2 total score
    game3_scratch: int       # Game 3 scratch score
    game3_total: int         # Game 3 total score
```

## Backend API (Snake Case)

**File: `backend/app/api/v1/brackets.py`**

When fetching scores from database:
```python
player_data = {
    'scores': {
        'game1_scratch': score_record.game1_scratch,
        'game1_total': score_record.game1_total,
        'game2_scratch': score_record.game2_scratch,
        'game2_total': score_record.game2_total,
        'game3_scratch': score_record.game3_scratch,
        'game3_total': score_record.game3_total,
    }
}
```

## Bracket Generation (Hybrid)

**File: `backend/app/services/brackets_advanced.py`**

**Input (from API):** Snake case
```python
home_scores.get('game1_total')  # Round 1 uses game1_total
home_scores.get('game2_total')  # Round 2 uses game2_total
home_scores.get('game3_total')  # Round 3 uses game3_total
```

**Output (to frontend):** Camel case
```python
{
    "scoreA": score_a,  # camelCase for frontend
    "scoreB": score_b,
    "playerA": "John Doe",
    "playerB": "Jane Smith",
    "winner": "A",
    "status": "completed"
}
```

## Frontend Display (Camel Case)

**File: `frontend/app/brackets/components/BracketTreeView.tsx`**

Displays scores using camel case:
```typescript
// Backwards compatibility - handles both old and new field names
const scoreA = (match as any).scoreA ?? (match as any).match_score_a
const scoreB = (match as any).scoreB ?? (match as any).match_score_b

// Display
{scoreA !== undefined && scoreA !== null ? scoreA : '-'}
```

## Game-to-Round Mapping

The bracket system uses game-specific scores for each round:

| Round | Game Score Used | Description |
|-------|----------------|-------------|
| Round 1 (Quarterfinals) | `game1_total` | First game determines Round 1 winners |
| Round 2 (Semifinals) | `game2_total` | Second game determines Round 2 winners |
| Round 3 (Finals) | `game3_total` | Third game determines champion |

## Score Flow

```
┌─────────────┐
│   Database  │  game1_total, game2_total, game3_total (snake_case)
└──────┬──────┘
       │
       v
┌─────────────┐
│  API Layer  │  scores: { game1_total, game2_total, ... } (snake_case)
└──────┬──────┘
       │
       v
┌─────────────┐
│  Brackets   │  Input: game1_total (snake_case)
│  Generation │  Output: scoreA, scoreB (camelCase)
└──────┬──────┘
       │
       v
┌─────────────┐
│  Frontend   │  scoreA, scoreB (camelCase)
└─────────────┘
```

## Key Files

1. **Database Model:** `backend/app/core/models.py` (Score class)
2. **API Fetching:** `backend/app/api/v1/brackets.py` (score query)
3. **Entry Creation:** `backend/app/services/brackets_simple.py` (preserves scores)
4. **Match Creation:** `backend/app/services/brackets_advanced.py` (converts to camelCase)
5. **Display:** `frontend/app/brackets/components/BracketTreeView.tsx` (reads camelCase)

## Important Notes

- **Always use `game1_total`, `game2_total`, `game3_total`** when reading from database
- **Always use `scoreA`, `scoreB`** when sending to frontend
- The frontend has backwards compatibility to handle old brackets that used `match_score_a/match_score_b`
- Scores must exist in the database BEFORE brackets are generated to display properly
- Regenerating brackets will pull fresh scores from the database

## Winner Determination

Winners are automatically determined by comparing scores:
```python
if score_a > score_b:
    winner = "A"
elif score_b > score_a:
    winner = "B"
else:
    status = "tied"
```

Winners automatically advance to the next round and their next game's score is used.
