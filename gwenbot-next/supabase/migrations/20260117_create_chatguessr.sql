-- Migration: Create ChatGuessr tables
-- Created: 2026-01-17

-- Sessions de jeu ChatGuessr
CREATE TABLE IF NOT EXISTS chatguessr_games (
    id SERIAL PRIMARY KEY,
    status TEXT DEFAULT 'active', -- 'active', 'finished'
    created_at TIMESTAMPTZ DEFAULT now(),
    finished_at TIMESTAMPTZ,
    score INT DEFAULT 0,           -- Nombre de bonnes réponses
    total_players INT DEFAULT 0    -- Nombre total de joueurs à deviner
);

-- Snapshot des messages pour une partie
CREATE TABLE IF NOT EXISTS chatguessr_messages (
    id SERIAL PRIMARY KEY,
    game_id INT REFERENCES chatguessr_games(id) ON DELETE CASCADE,
    original_player_id INT REFERENCES players(id),
    fake_username TEXT NOT NULL,   -- Ex: "MysteriousWolf_42"
    fake_color TEXT NOT NULL,      -- Couleur Twitch style (#FF0000)
    content TEXT NOT NULL,
    position INT NOT NULL,         -- Ordre d'affichage (1-20)
    sent_at TIMESTAMPTZ
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_chatguessr_games_status ON chatguessr_games(status);
CREATE INDEX IF NOT EXISTS idx_chatguessr_messages_game ON chatguessr_messages(game_id);
