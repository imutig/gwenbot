-- Migration: Create GwenGuessr tables
-- Created: 2026-01-12

-- Sessions de jeu
CREATE TABLE IF NOT EXISTS gwenguessr_games (
    id SERIAL PRIMARY KEY,
    host_id INT REFERENCES players(id),
    status TEXT DEFAULT 'lobby', -- 'lobby', 'playing', 'between_rounds', 'finished'
    current_round INT DEFAULT 0,
    total_rounds INT DEFAULT 5,
    round_duration INT DEFAULT 60, -- Durée en secondes par round
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Rounds individuels
CREATE TABLE IF NOT EXISTS gwenguessr_rounds (
    id SERIAL PRIMARY KEY,
    game_id INT REFERENCES gwenguessr_games(id) ON DELETE CASCADE,
    round_number INT NOT NULL,
    image_id TEXT NOT NULL, -- Mapillary image ID
    image_url TEXT NOT NULL,
    correct_lat FLOAT NOT NULL,
    correct_lng FLOAT NOT NULL,
    country TEXT, -- Pour affichage
    city TEXT, -- Optionnel
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    UNIQUE(game_id, round_number)
);

-- Guesses des viewers
CREATE TABLE IF NOT EXISTS gwenguessr_guesses (
    id SERIAL PRIMARY KEY,
    round_id INT REFERENCES gwenguessr_rounds(id) ON DELETE CASCADE,
    player_id INT REFERENCES players(id),
    guess_lat FLOAT NOT NULL,
    guess_lng FLOAT NOT NULL,
    distance_km FLOAT, -- Calculé au reveal
    points INT DEFAULT 0,
    guessed_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(round_id, player_id) -- 1 guess par round par joueur
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_gwenguessr_games_status ON gwenguessr_games(status);
CREATE INDEX IF NOT EXISTS idx_gwenguessr_rounds_game ON gwenguessr_rounds(game_id);
CREATE INDEX IF NOT EXISTS idx_gwenguessr_guesses_round ON gwenguessr_guesses(round_id);
CREATE INDEX IF NOT EXISTS idx_gwenguessr_guesses_player ON gwenguessr_guesses(player_id);
