-- Migration: Add avatar_seed to players table

ALTER TABLE public.players 
ADD COLUMN IF NOT EXISTS avatar_seed text;

-- Optional: Set default constraint if you want, but NULL is fine (fallback to username)
-- ALTER TABLE public.players ALTER COLUMN avatar_seed SET DEFAULT NULL;
