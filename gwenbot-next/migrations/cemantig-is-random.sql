-- Cemantig: Add is_random column for random word mode
-- This allows the host to play when they didn't choose the word
-- Run this in Supabase SQL Editor

ALTER TABLE cemantig_sessions 
ADD COLUMN IF NOT EXISTS is_random BOOLEAN DEFAULT FALSE;
