import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.models import Base, Score, Tournament, Squad, Bowler, BracketSettings
from app.services.bracket_persistence_simple import determine_winner_with_tiebreakers
import random

# Create test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_tiebreakers.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="module")
def db():
    """Create test database and session"""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def tournament_data(db):
    """Create test tournament, bowlers, and scores"""
    # Create a test user first (required for tournament)
    from app.core.models import User
    user = User(
        username="testuser",
        email="test@test.com",
        first_name="Test",
        last_name="User",
        password="test"
    )
    db.add(user)
    db.flush()
    
    # Create tournament
    tournament = Tournament(
        user_id=user.id,
        name="Test Tournament",
        location="Test Location",
        start_date="2024-01-15"
    )
    db.add(tournament)
    db.flush()
    
    # Create bracket settings
    settings = BracketSettings(
        tournament_id=tournament.id,
        handicap_base=200,
        handicap_percentage=80
    )
    db.add(settings)
    
    # Create squad
    squad = Squad(
        tournament_id=tournament.id,
        date="2024-01-15",
        time="10:00"
    )
    db.add(squad)
    db.flush()
    
    # Create two bowlers
    bowler_a = Bowler(
        first_name="Player",
        last_name="A",
        usbc_number="A123456",
        average=180
    )
    bowler_b = Bowler(
        first_name="Player",
        last_name="B", 
        usbc_number="B123456",
        average=180
    )
    db.add_all([bowler_a, bowler_b])
    db.flush()
    
    db.commit()
    
    return {
        'tournament': tournament,
        'squad': squad,
        'bowler_a': bowler_a,
        'bowler_b': bowler_b
    }

def test_tiebreaker_higher_game_player_a_wins(db, tournament_data):
    """Test tiebreaker when Player A has higher individual game"""
    tournament = tournament_data['tournament']
    bowler_a = tournament_data['bowler_a']
    bowler_b = tournament_data['bowler_b']
    
    # Create scores - both total 600, but A has higher game
    score_a = Score(
        tournament_id=tournament.id,
        bowler_id=bowler_a.id,
        game1_scratch=220,  # Highest
        game1_total=220,
        game2_scratch=190,
        game2_total=190,
        game3_scratch=190,
        game3_total=190
    )
    score_b = Score(
        tournament_id=tournament.id,
        bowler_id=bowler_b.id,
        game1_scratch=200,
        game1_total=200,
        game2_scratch=200,
        game2_total=200,
        game3_scratch=200,
        game3_total=200
    )
    db.add_all([score_a, score_b])
    db.commit()
    
    winner, method, notes = determine_winner_with_tiebreakers(
        db, tournament.id, bowler_a.id, bowler_b.id, 600, 600, use_scratch=True
    )
    
    assert winner == 'A'
    assert method == 'highest_game'
    assert '220' in notes
    assert '200' in notes
    
    # Cleanup
    db.delete(score_a)
    db.delete(score_b)
    db.commit()

def test_tiebreaker_higher_game_player_b_wins(db, tournament_data):
    """Test tiebreaker when Player B has higher individual game"""
    tournament = tournament_data['tournament']
    bowler_a = tournament_data['bowler_a']
    bowler_b = tournament_data['bowler_b']
    
    # Create scores - both total 600, but B has higher game
    score_a = Score(
        tournament_id=tournament.id,
        bowler_id=bowler_a.id,
        game1_scratch=200,
        game1_total=200,
        game2_scratch=200,
        game2_total=200,
        game3_scratch=200,
        game3_total=200
    )
    score_b = Score(
        tournament_id=tournament.id,
        bowler_id=bowler_b.id,
        game1_scratch=235,  # Highest
        game1_total=235,
        game2_scratch=180,
        game2_total=180,
        game3_scratch=185,
        game3_total=185
    )
    db.add_all([score_a, score_b])
    db.commit()
    
    winner, method, notes = determine_winner_with_tiebreakers(
        db, tournament.id, bowler_a.id, bowler_b.id, 600, 600, use_scratch=True
    )
    
    assert winner == 'B'
    assert method == 'highest_game'
    assert '200' in notes
    assert '235' in notes
    
    # Cleanup
    db.delete(score_a)
    db.delete(score_b)
    db.commit()

def test_tiebreaker_random_when_all_games_equal(db, tournament_data):
    """Test random tiebreaker when all games are equal"""
    tournament = tournament_data['tournament']
    bowler_a = tournament_data['bowler_a']
    bowler_b = tournament_data['bowler_b']
    
    # Create scores - perfectly identical
    score_a = Score(
        tournament_id=tournament.id,
        bowler_id=bowler_a.id,
        game1_scratch=200,
        game1_total=200,
        game2_scratch=200,
        game2_total=200,
        game3_scratch=200,
        game3_total=200
    )
    score_b = Score(
        tournament_id=tournament.id,
        bowler_id=bowler_b.id,
        game1_scratch=200,
        game1_total=200,
        game2_scratch=200,
        game2_total=200,
        game3_scratch=200,
        game3_total=200
    )
    db.add_all([score_a, score_b])
    db.commit()
    
    # Set random seed for reproducibility
    random.seed(42)
    
    winner, method, notes = determine_winner_with_tiebreakers(
        db, tournament.id, bowler_a.id, bowler_b.id, 600, 600, use_scratch=True
    )
    
    assert winner in ['A', 'B']
    assert method == 'random'
    assert 'random selection' in notes.lower()
    
    # Cleanup
    db.delete(score_a)
    db.delete(score_b)
    db.commit()

def test_no_tie_player_a_wins(db, tournament_data):
    """Test normal case when Player A wins without tie"""
    tournament = tournament_data['tournament']
    bowler_a = tournament_data['bowler_a']
    bowler_b = tournament_data['bowler_b']
    
    # Create scores - A wins clearly
    score_a = Score(
        tournament_id=tournament.id,
        bowler_id=bowler_a.id,
        game1_scratch=220,
        game1_total=220,
        game2_scratch=210,
        game2_total=210,
        game3_scratch=215,
        game3_total=215
    )
    score_b = Score(
        tournament_id=tournament.id,
        bowler_id=bowler_b.id,
        game1_scratch=200,
        game1_total=200,
        game2_scratch=190,
        game2_total=190,
        game3_scratch=195,
        game3_total=195
    )
    db.add_all([score_a, score_b])
    db.commit()
    
    winner, method, notes = determine_winner_with_tiebreakers(
        db, tournament.id, bowler_a.id, bowler_b.id, 645, 585, use_scratch=True
    )
    
    assert winner == 'A'
    assert method == 'normal'
    assert notes is None
    
    # Cleanup
    db.delete(score_a)
    db.delete(score_b)
    db.commit()

def test_no_tie_player_b_wins(db, tournament_data):
    """Test normal case when Player B wins without tie"""
    tournament = tournament_data['tournament']
    bowler_a = tournament_data['bowler_a']
    bowler_b = tournament_data['bowler_b']
    
    # Create scores - B wins clearly
    score_a = Score(
        tournament_id=tournament.id,
        bowler_id=bowler_a.id,
        game1_scratch=180,
        game1_total=180,
        game2_scratch=175,
        game2_total=175,
        game3_scratch=170,
        game3_total=170
    )
    score_b = Score(
        tournament_id=tournament.id,
        bowler_id=bowler_b.id,
        game1_scratch=210,
        game1_total=210,
        game2_scratch=215,
        game2_total=215,
        game3_scratch=220,
        game3_total=220
    )
    db.add_all([score_a, score_b])
    db.commit()
    
    winner, method, notes = determine_winner_with_tiebreakers(
        db, tournament.id, bowler_a.id, bowler_b.id, 525, 645, use_scratch=True
    )
    
    assert winner == 'B'
    assert method == 'normal'
    assert notes is None
    
    # Cleanup
    db.delete(score_a)
    db.delete(score_b)
    db.commit()
