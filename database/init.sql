
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
  user_id INTEGER NOT NULL REFERENCES users(id),
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

-- Users table for authentication and admin
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  organization TEXT,
  password TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE
);
