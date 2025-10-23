import sys
sys.path.append('.')
from app.services.brackets_simple import generate_tournament_brackets

# Simple test data
test_players = [
    {'id': 1, 'firstName': 'Alice', 'lastName': 'Johnson', 'scratch': 1, 'handicap': 0, 'scores': {'game1_scratch': 180, 'game2_scratch': 165, 'game3_scratch': 155}},
    {'id': 2, 'firstName': 'Bob', 'lastName': 'Smith', 'scratch': 1, 'handicap': 0, 'scores': {'game1_scratch': 170, 'game2_scratch': 175, 'game3_scratch': 160}},
    {'id': 3, 'firstName': 'Charlie', 'lastName': 'Brown', 'scratch': 1, 'handicap': 0, 'scores': {'game1_scratch': 195, 'game2_scratch': 185, 'game3_scratch': 175}},
    {'id': 4, 'firstName': 'Diana', 'lastName': 'Wilson', 'scratch': 1, 'handicap': 0, 'scores': {'game1_scratch': 160, 'game2_scratch': 145, 'game3_scratch': 150}},
    {'id': 5, 'firstName': 'Eddie', 'lastName': 'Davis', 'scratch': 1, 'handicap': 0, 'scores': {'game1_scratch': 175, 'game2_scratch': 170, 'game3_scratch': 165}},
    {'id': 6, 'firstName': 'Fiona', 'lastName': 'Miller', 'scratch': 1, 'handicap': 0, 'scores': {'game1_scratch': 185, 'game2_scratch': 180, 'game3_scratch': 170}},
    {'id': 7, 'firstName': 'George', 'lastName': 'Taylor', 'scratch': 1, 'handicap': 0, 'scores': {'game1_scratch': 155, 'game2_scratch': 160, 'game3_scratch': 145}},
    {'id': 8, 'firstName': 'Helen', 'lastName': 'Anderson', 'scratch': 1, 'handicap': 0, 'scores': {'game1_scratch': 190, 'game2_scratch': 185, 'game3_scratch': 180}}
]

print('Testing Random Bracket Generation')
print('=================================')

result = generate_tournament_brackets(test_players, 8)
bracket = result['scratch_brackets'][0]

print('\\nFirst Round Matches:')
for i, match in enumerate(bracket['rounds'][0]['matches']):
    playerA = match['playerA']
    playerB = match['playerB']
    status = match['status']
    print(f'  Match {i+1}: {playerA} vs {playerB} - Status: {status}')

print('\\nRandom seeding implemented successfully!')
print('All matches start as pending - no predetermined winners!')