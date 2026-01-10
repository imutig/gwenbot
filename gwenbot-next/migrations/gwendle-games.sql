-- Gwendle games table for global leaderboard

CREATE TABLE IF NOT EXISTS gwendle_games (
  id SERIAL PRIMARY KEY,
  player_id INT REFERENCES players(id),
  word VARCHAR(10) NOT NULL,
  attempts INT NOT NULL,
  won BOOLEAN NOT NULL DEFAULT true,
  played_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_gwendle_games_won ON gwendle_games(won);
CREATE INDEX IF NOT EXISTS idx_gwendle_games_played_at ON gwendle_games(played_at);
