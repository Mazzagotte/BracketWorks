from sqlalchemy.orm import declarative_base, Mapped, mapped_column, relationship
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Date, JSON, Text, Float, DateTime
from datetime import datetime

Base = declarative_base()

class SelectedSquad(Base):
    __tablename__ = "selected_squad"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    squad_id: Mapped[int] = mapped_column(Integer, ForeignKey("squad.id"), nullable=False, index=True)

class Squad(Base):
    __tablename__ = "squad"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournament.id"), nullable=False, index=True)
    date: Mapped[str] = mapped_column(String, nullable=False)
    time: Mapped[str] = mapped_column(String, nullable=False)

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    organization: Mapped[str | None] = mapped_column(String, nullable=True)
    password: Mapped[str] = mapped_column(String, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)  # False = regular, True = admin
class Bowler(Base):
    __tablename__ = "bowler"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournament.id"), nullable=False, index=True)
    squad_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("squad.id"), nullable=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    average: Mapped[int | None] = mapped_column(Integer, nullable=True)
    handicap: Mapped[int | None] = mapped_column(Integer, nullable=True)  # Computed handicap pin value
    handicap_entries: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scratch_entries: Mapped[int | None] = mapped_column(Integer, nullable=True)
    lane: Mapped[str | None] = mapped_column(String, nullable=True)
    division: Mapped[str | None] = mapped_column(String, nullable=True, default='Open')
    usbc: Mapped[str | None] = mapped_column(String, nullable=True)
    amount_paid: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.0)

class Tournament(Base):
    __tablename__ = "tournament"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    location: Mapped[str] = mapped_column(String, nullable=True)
    start_date: Mapped[str] = mapped_column(String, nullable=True)  # ISO date string
    end_date: Mapped[str] = mapped_column(String, nullable=True)    # ISO date string
    squad_times: Mapped[str] = mapped_column(Text, nullable=True) # JSON string mapping date to times

class BracketSettings(Base):
    __tablename__ = "bracket_settings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournament.id"), nullable=False, index=True)
    bracket_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    first_place: Mapped[float | None] = mapped_column(Float, nullable=True)
    second_place: Mapped[float | None] = mapped_column(Float, nullable=True)
    house_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    cost_per_bracket: Mapped[float | None] = mapped_column(Float, nullable=True)
    handicap_percentage: Mapped[float | None] = mapped_column(Float, nullable=True, default=80.0)
    handicap_base: Mapped[float | None] = mapped_column(Float, nullable=True, default=200.0)

class Score(Base):
    __tablename__ = "score"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    bowler_id: Mapped[int] = mapped_column(Integer, ForeignKey("bowler.id"), nullable=False, index=True)
    tournament_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournament.id"), nullable=False, index=True)
    squad_id: Mapped[int] = mapped_column(Integer, ForeignKey("squad.id"), nullable=False, index=True)
    game1_scratch: Mapped[int | None] = mapped_column(Integer, nullable=True)
    game1_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    game2_scratch: Mapped[int | None] = mapped_column(Integer, nullable=True)
    game2_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    game3_scratch: Mapped[int | None] = mapped_column(Integer, nullable=True)
    game3_total: Mapped[int | None] = mapped_column(Integer, nullable=True)

# New models for generated bracket persistence

class GeneratedBracket(Base):
    __tablename__ = "generated_bracket"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournament.id"), nullable=False, index=True)
    squad_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("squad.id"), nullable=True, index=True)
    bracket_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # 'scratch' or 'handicap'
    bracket_index: Mapped[int] = mapped_column(Integer, nullable=False)  # 0, 1, 2... for multiple brackets of same type
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    bracket_size: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)

class BracketRound(Base):
    __tablename__ = "bracket_round"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    bracket_id: Mapped[int] = mapped_column(Integer, ForeignKey("generated_bracket.id"), nullable=False, index=True)
    round_index: Mapped[int] = mapped_column(Integer, nullable=False)  # 0, 1, 2...
    round_name: Mapped[str] = mapped_column(String(50), nullable=False)  # "Round 1", "Quarterfinals", etc.

class BracketMatch(Base):
    __tablename__ = "bracket_match"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    round_id: Mapped[int] = mapped_column(Integer, ForeignKey("bracket_round.id"), nullable=False, index=True)
    match_index: Mapped[int] = mapped_column(Integer, nullable=False)  # 0, 1, 2... within the round
    player_a_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("bowler.id"), nullable=True)
    player_a_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    player_a_seed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    player_b_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("bowler.id"), nullable=True)
    player_b_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    player_b_seed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score_a: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score_b: Mapped[int | None] = mapped_column(Integer, nullable=True)
    winner: Mapped[str | None] = mapped_column(String(1), nullable=True)  # 'A' or 'B'
    status: Mapped[str] = mapped_column(String(20), nullable=False, default='pending', index=True)  # 'pending', 'in_progress', 'completed'
    match_date: Mapped[str | None] = mapped_column(String, nullable=True)

class BracketSummary(Base):
    __tablename__ = "bracket_summary"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournament.id"), nullable=False, index=True)
    squad_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("squad.id"), nullable=True, index=True)
    total_scratch_entries: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_handicap_entries: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    scratch_brackets_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    handicap_brackets_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    scratch_placed_entries: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    handicap_placed_entries: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    scratch_refund_entries: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    handicap_refund_entries: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    generation_date: Mapped[str] = mapped_column(String, nullable=False)


# New models for winner tracking and payouts

class TournamentWinner(Base):
    """Track winners for individual brackets within tournaments"""
    __tablename__ = "tournament_winner"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournament.id"), nullable=False, index=True)
    squad_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("squad.id"), nullable=True, index=True)
    bracket_id: Mapped[int] = mapped_column(Integer, ForeignKey("generated_bracket.id"), nullable=False, index=True)
    bowler_id: Mapped[int] = mapped_column(Integer, ForeignKey("bowler.id"), nullable=False, index=True)
    bracket_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # 'scratch' or 'handicap'
    bracket_name: Mapped[str] = mapped_column(String(100), nullable=False)  # "Scratch Bracket 1", etc.
    placement: Mapped[int] = mapped_column(Integer, nullable=False, index=True)  # 1=1st, 2=2nd, 3=3rd, 4=4th
    placement_text: Mapped[str] = mapped_column(String(10), nullable=False)  # "1st", "2nd", "3rd", "4th"
    player_name: Mapped[str] = mapped_column(String(100), nullable=False)
    winning_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)


class TournamentPayout(Base):
    """Store payout information and calculations for tournaments"""
    __tablename__ = "tournament_payout" 
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournament.id"), nullable=False, index=True)
    squad_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("squad.id"), nullable=True, index=True)
    bracket_id: Mapped[int] = mapped_column(Integer, ForeignKey("generated_bracket.id"), nullable=False, index=True)
    winner_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournament_winner.id"), nullable=False, index=True)
    bowler_id: Mapped[int] = mapped_column(Integer, ForeignKey("bowler.id"), nullable=False, index=True)
    bracket_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # 'scratch' or 'handicap'
    bracket_name: Mapped[str] = mapped_column(String(100), nullable=False)
    placement: Mapped[int] = mapped_column(Integer, nullable=False)
    player_name: Mapped[str] = mapped_column(String(100), nullable=False)
    prize_pool_total: Mapped[float] = mapped_column(Float, nullable=False)
    payout_percentage: Mapped[float] = mapped_column(Float, nullable=False)  # 60.0 for 60%
    payout_amount: Mapped[float] = mapped_column(Float, nullable=False)
    entry_fee: Mapped[float] = mapped_column(Float, nullable=False)
    bracket_size: Mapped[int] = mapped_column(Integer, nullable=False)
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    paid_date: Mapped[str | None] = mapped_column(String, nullable=True)
    payment_method: Mapped[str | None] = mapped_column(String(50), nullable=True)  # 'cash', 'check', 'venmo', etc.
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)


class PayoutSummary(Base):
    """Summary of all payouts for a tournament"""
    __tablename__ = "payout_summary"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournament.id"), nullable=False, index=True)
    squad_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("squad.id"), nullable=True, index=True)
    total_prize_pool: Mapped[float] = mapped_column(Float, nullable=False)
    total_scratch_pool: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    total_handicap_pool: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    total_paid_out: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    total_unpaid: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    scratch_brackets_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    handicap_brackets_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_winners: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    scratch_entry_fee: Mapped[float] = mapped_column(Float, nullable=False)
    handicap_entry_fee: Mapped[float] = mapped_column(Float, nullable=False)
    house_percentage: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.0)
    house_amount: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.0)
    is_finalized: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    finalized_date: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)


class MatchHistory(Base):
    """Track historical first-round matchups to prevent rematches"""
    __tablename__ = "match_history"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournament.id"), nullable=False, index=True)
    player_a_id: Mapped[int] = mapped_column(Integer, ForeignKey("bowler.id"), nullable=False, index=True)
    player_b_id: Mapped[int] = mapped_column(Integer, ForeignKey("bowler.id"), nullable=False, index=True)
    bracket_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # 'scratch' or 'handicap'
    bracket_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)  # 1 for first round
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
