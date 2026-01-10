-- Add word_length column to gwendle_games table
ALTER TABLE gwendle_games 
ADD COLUMN word_length INTEGER NOT NULL DEFAULT 5;

-- Update existing records to have word_length = 5 (implicitly handled by DEFAULT, but good to be explicit if needed)
-- UPDATE gwendle_games SET word_length = 5 WHERE word_length IS NULL;
