-- ===========================================
-- Sudoku Battle Royale - Database Migrations
-- Run this in Supabase SQL Editor
-- ===========================================

-- 0. Increase mode column length to support 'battle_royale' (13 chars)
ALTER TABLE sudoku_games 
ALTER COLUMN mode TYPE VARCHAR(20);

-- 1. Add is_battle_royale column to sudoku_games
ALTER TABLE sudoku_games 
ADD COLUMN IF NOT EXISTS is_battle_royale BOOLEAN DEFAULT FALSE;

-- 2. Add sudoku_br_wins column to player_stats
ALTER TABLE player_stats 
ADD COLUMN IF NOT EXISTS sudoku_br_wins INTEGER DEFAULT 0;

-- 3. Create sudoku_br_players table for Battle Royale participants
CREATE TABLE IF NOT EXISTS sudoku_br_players (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES sudoku_games(id) ON DELETE CASCADE,
    player_id INTEGER REFERENCES players(id),
    progress TEXT DEFAULT '',           -- Current grid state (81 chars)
    cells_filled INTEGER DEFAULT 0,     -- Number of cells correctly filled
    errors INTEGER DEFAULT 0,           -- Error counter (3 = eliminated)
    status VARCHAR(20) DEFAULT 'playing', -- 'playing', 'eliminated', 'finished'
    finish_rank INTEGER,                -- Rank when finished (1, 2, 3...)
    finish_time INTEGER,                -- Time in seconds when finished
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    UNIQUE(game_id, player_id)
);

-- 4. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sudoku_br_players_game_id ON sudoku_br_players(game_id);
CREATE INDEX IF NOT EXISTS idx_sudoku_br_players_status ON sudoku_br_players(status);

-- 5. Enable realtime for the new table
ALTER PUBLICATION supabase_realtime ADD TABLE sudoku_br_players;

-- Done! Run this script in Supabase SQL Editor
