-- Add streak tracking column to gwendle_games
-- Run this in Supabase SQL Editor

ALTER TABLE gwendle_games ADD COLUMN IF NOT EXISTS current_streak INT DEFAULT 0;
