-- Cemantig Migration
-- Run this in Supabase SQL Editor

-- 1. Sessions de jeu Cemantig
CREATE TABLE IF NOT EXISTS cemantig_sessions (
    id SERIAL PRIMARY KEY,
    secret_word TEXT NOT NULL,
    status TEXT DEFAULT 'active', -- active, finished
    started_at TIMESTAMP DEFAULT NOW(),
    finished_at TIMESTAMP,
    winner_id INTEGER REFERENCES players(id),
    total_guesses INTEGER DEFAULT 0
);

-- 2. Guesses des joueurs
CREATE TABLE IF NOT EXISTS cemantig_guesses (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES cemantig_sessions(id) ON DELETE CASCADE,
    player_id INTEGER REFERENCES players(id),
    word TEXT NOT NULL,
    similarity INTEGER NOT NULL, -- 0-1000
    guessed_at TIMESTAMP DEFAULT NOW()
);

-- 3. Index pour performances
CREATE INDEX IF NOT EXISTS idx_cemantig_sessions_status ON cemantig_sessions(status);
CREATE INDEX IF NOT EXISTS idx_cemantig_guesses_session ON cemantig_guesses(session_id);
CREATE INDEX IF NOT EXISTS idx_cemantig_guesses_similarity ON cemantig_guesses(similarity DESC);

-- 4. Enable RLS (required for Realtime to work with anon key)
ALTER TABLE cemantig_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cemantig_guesses ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies - Allow everyone to SELECT (needed for Realtime)
DROP POLICY IF EXISTS "Allow public read access on cemantig_sessions" ON cemantig_sessions;
CREATE POLICY "Allow public read access on cemantig_sessions" ON cemantig_sessions
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access on cemantig_guesses" ON cemantig_guesses;
CREATE POLICY "Allow public read access on cemantig_guesses" ON cemantig_guesses
    FOR SELECT USING (true);

-- 6. Replica Identity for Realtime
ALTER TABLE cemantig_sessions REPLICA IDENTITY FULL;
ALTER TABLE cemantig_guesses REPLICA IDENTITY FULL;

-- 7. Enable Realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE cemantig_guesses;
ALTER PUBLICATION supabase_realtime ADD TABLE cemantig_sessions;

-- Done!
