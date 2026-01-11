-- Pictionary Game Tables
-- Run this in Supabase SQL Editor

-- Games table
CREATE TABLE IF NOT EXISTS pictionary_games (
  id SERIAL PRIMARY KEY,
  host_id INTEGER REFERENCES players(id),
  status VARCHAR DEFAULT 'waiting', -- waiting, playing, finished
  max_players INTEGER DEFAULT 6,
  current_round INTEGER DEFAULT 0,
  current_drawer_id INTEGER REFERENCES players(id),
  current_word VARCHAR,
  round_started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

-- Players in a game (queue and scores)
CREATE TABLE IF NOT EXISTS pictionary_players (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES pictionary_games(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES players(id),
  score INTEGER DEFAULT 0,
  draw_order INTEGER,
  has_drawn BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, player_id)
);

-- Rounds history (one per drawer)
CREATE TABLE IF NOT EXISTS pictionary_rounds (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES pictionary_games(id) ON DELETE CASCADE,
  drawer_id INTEGER REFERENCES players(id),
  word VARCHAR NOT NULL,
  word_choices JSONB, -- The 3 options shown to drawer
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  strokes JSONB DEFAULT '[]', -- Drawing data for history
  guessed_by INTEGER REFERENCES players(id),
  guessed_at TIMESTAMPTZ,
  round_number INTEGER NOT NULL
);

-- Index for quick game lookups
CREATE INDEX IF NOT EXISTS idx_pictionary_players_game ON pictionary_players(game_id);
CREATE INDEX IF NOT EXISTS idx_pictionary_rounds_game ON pictionary_rounds(game_id);

-- Enable realtime for games table
ALTER PUBLICATION supabase_realtime ADD TABLE pictionary_games;
