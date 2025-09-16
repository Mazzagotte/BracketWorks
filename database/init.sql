
-- Minimal init. Extend for your real schema or use Alembic migrations.
CREATE TABLE IF NOT EXISTS bowler (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  average INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bracket (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  squad TEXT,
  game_count INTEGER DEFAULT 3,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tournaments used by the dashboard
CREATE TABLE IF NOT EXISTS tournament (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  start_date TEXT,
  end_date TEXT,
  squad_times TEXT
);

CREATE TABLE IF NOT EXISTS entry (
  id SERIAL PRIMARY KEY,
  bracket_id INTEGER REFERENCES bracket(id) ON DELETE CASCADE,
  bowler_id INTEGER REFERENCES bowler(id) ON DELETE CASCADE,
  paid BOOLEAN DEFAULT FALSE
);
