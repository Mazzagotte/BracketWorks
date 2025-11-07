"""Check the most recent bracket data from the database"""
import sys
import json
from sqlalchemy import create_engine, text
from app.core.config import settings

def main():
    engine = create_engine(settings.DATABASE_URL)
    conn = engine.connect()
    
    # Get most recent bracket
    result = conn.execute(text("""
        SELECT id, tournament_id, squad_id, bracket_data, created_at 
        FROM simple_brackets 
        WHERE is_active = true 
        ORDER BY created_at DESC 
        LIMIT 1
    """))
    
    row = result.fetchone()
    
    if not row:
        print("No active brackets found in database")
        conn.close()
        return
    
    bracket_id, tournament_id, squad_id, bracket_data, created_at = row
    
    print(f"\n{'='*80}")
    print(f"MOST RECENT BRACKET")
    print(f"{'='*80}")
    print(f"Bracket ID: {bracket_id}")
    print(f"Tournament ID: {tournament_id}")
    print(f"Squad ID: {squad_id}")
    print(f"Created: {created_at}")
    print(f"\n{'='*80}")
    print(f"BRACKET ANALYSIS")
    print(f"{'='*80}\n")
    
    # Analyze handicap brackets
    handicap_brackets = bracket_data.get('handicap_brackets', [])
    print(f"Number of Handicap Brackets: {len(handicap_brackets)}\n")
    
    for i, bracket in enumerate(handicap_brackets, 1):
        print(f"\n--- Handicap Bracket {i}: {bracket.get('title', 'Untitled')} ---")
        
        rounds = bracket.get('rounds', [])
        if not rounds:
            print("  No rounds found")
            continue
            
        first_round = rounds[0]
        matches = first_round.get('matches', [])
        
        print(f"First Round Matches ({len(matches)} matches):\n")
        
        # Track all players in this bracket
        all_players = {}  # player_name -> count
        all_player_ids = {}  # player_id -> count
        
        for j, match in enumerate(matches, 1):
            player_a = match.get('playerA', 'Unknown')
            player_b = match.get('playerB', 'Unknown')
            player_a_id = match.get('playerA_id')
            player_b_id = match.get('playerB_id')
            
            print(f"  Match {j}: {player_a} (ID: {player_a_id}) vs {player_b} (ID: {player_b_id})")
            
            # Count occurrences
            all_players[player_a] = all_players.get(player_a, 0) + 1
            all_players[player_b] = all_players.get(player_b, 0) + 1
            
            if player_a_id:
                all_player_ids[player_a_id] = all_player_ids.get(player_a_id, 0) + 1
            if player_b_id:
                all_player_ids[player_b_id] = all_player_ids.get(player_b_id, 0) + 1
        
        # Check for duplicates
        print(f"\n  Validation:")
        duplicates_found = False
        
        for player_name, count in all_players.items():
            if count > 1:
                print(f"    ❌ DUPLICATE: '{player_name}' appears {count} times")
                duplicates_found = True
        
        for player_id, count in all_player_ids.items():
            if count > 1:
                print(f"    ❌ DUPLICATE PLAYER_ID: {player_id} appears {count} times")
                duplicates_found = True
        
        if not duplicates_found:
            print(f"    ✅ No duplicates - all players unique in this bracket")
    
    # Analyze scratch brackets
    scratch_brackets = bracket_data.get('scratch_brackets', [])
    print(f"\n\nNumber of Scratch Brackets: {len(scratch_brackets)}\n")
    
    for i, bracket in enumerate(scratch_brackets, 1):
        print(f"\n--- Scratch Bracket {i}: {bracket.get('title', 'Untitled')} ---")
        
        rounds = bracket.get('rounds', [])
        if not rounds:
            print("  No rounds found")
            continue
            
        first_round = rounds[0]
        matches = first_round.get('matches', [])
        
        print(f"First Round Matches ({len(matches)} matches):\n")
        
        all_players = {}
        all_player_ids = {}
        
        for j, match in enumerate(matches, 1):
            player_a = match.get('playerA', 'Unknown')
            player_b = match.get('playerB', 'Unknown')
            player_a_id = match.get('playerA_id')
            player_b_id = match.get('playerB_id')
            
            print(f"  Match {j}: {player_a} (ID: {player_a_id}) vs {player_b} (ID: {player_b_id})")
            
            all_players[player_a] = all_players.get(player_a, 0) + 1
            all_players[player_b] = all_players.get(player_b, 0) + 1
            
            if player_a_id:
                all_player_ids[player_a_id] = all_player_ids.get(player_a_id, 0) + 1
            if player_b_id:
                all_player_ids[player_b_id] = all_player_ids.get(player_b_id, 0) + 1
        
        print(f"\n  Validation:")
        duplicates_found = False
        
        for player_name, count in all_players.items():
            if count > 1:
                print(f"    ❌ DUPLICATE: '{player_name}' appears {count} times")
                duplicates_found = True
        
        for player_id, count in all_player_ids.items():
            if count > 1:
                print(f"    ❌ DUPLICATE PLAYER_ID: {player_id} appears {count} times")
                duplicates_found = True
        
        if not duplicates_found:
            print(f"    ✅ No duplicates - all players unique in this bracket")
    
    print(f"\n{'='*80}\n")
    
    conn.close()

if __name__ == "__main__":
    main()
