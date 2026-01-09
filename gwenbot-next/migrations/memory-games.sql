-- Memory game tables

-- Memory games table
CREATE TABLE IF NOT EXISTS memory_games (
  id SERIAL PRIMARY KEY,
  mode VARCHAR(10) NOT NULL CHECK (mode IN ('solo', '1v1')),
  difficulty VARCHAR(10) NOT NULL CHECK (difficulty IN ('easy', 'hard')),
  status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  host_id INT REFERENCES players(id),
  challenger_id INT REFERENCES players(id),
  cards JSONB NOT NULL, -- shuffled card positions
  matched JSONB DEFAULT '[]', -- matched pair indices
  host_pairs INT DEFAULT 0,
  challenger_pairs INT DEFAULT 0,
  current_turn VARCHAR(15) DEFAULT 'host', -- 'host' | 'challenger'
  winner_id INT REFERENCES players(id),
  moves INT DEFAULT 0,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable realtime for memory games
ALTER PUBLICATION supabase_realtime ADD TABLE memory_games;
