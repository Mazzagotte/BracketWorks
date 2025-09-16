from sqlalchemy.orm import declarative_base, Mapped, mapped_column, relationship
from sqlalchemy import Integer, String, Boolean, ForeignKey, Date, JSON, Text

Base = declarative_base()

class Bowler(Base):
    __tablename__ = "bowler"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    average: Mapped[int | None] = mapped_column(Integer, nullable=True)

class Bracket(Base):
    __tablename__ = "bracket"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    squad: Mapped[str | None] = mapped_column(String, nullable=True)
    game_count: Mapped[int] = mapped_column(Integer, default=3)

class Tournament(Base):
    __tablename__ = "tournament"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    location: Mapped[str] = mapped_column(String, nullable=True)
    start_date: Mapped[str] = mapped_column(String, nullable=True)  # ISO date string
    end_date: Mapped[str] = mapped_column(String, nullable=True)    # ISO date string
    squad_times: Mapped[str] = mapped_column(Text, nullable=True) # JSON string mapping date to times
