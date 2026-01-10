-- Connect 4 games table

CREATE TABLE IF NOT EXISTS connect4_games (
  id SERIAL PRIMARY KEY,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  host_id INT REFERENCES players(id),
  challenger_id INT REFERENCES players(id),
  board JSONB NOT NULL DEFAULT '[[],[],[],[],[],[]]', -- 6 rows, each up to 7 columns
  current_turn VARCHAR(15) DEFAULT 'host',
  winner_id INT REFERENCES players(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
