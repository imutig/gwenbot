-- Bingo Extension Tables
-- Run in Supabase SQL Editor

CREATE TABLE public.bingo_sessions (
    id serial PRIMARY KEY,
    items jsonb NOT NULL DEFAULT '[]'::jsonb,
    status varchar NOT NULL DEFAULT 'active',
    created_by varchar,
    winners jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.bingo_cards (
    id serial PRIMARY KEY,
    session_id integer NOT NULL REFERENCES public.bingo_sessions(id) ON DELETE CASCADE,
    twitch_user_id varchar NOT NULL,
    twitch_username varchar,
    grid jsonb NOT NULL,
    checked jsonb NOT NULL DEFAULT '[false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false]'::jsonb,
    has_bingo boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    UNIQUE(session_id, twitch_user_id)
);

-- Index for fast lookups
CREATE INDEX idx_bingo_cards_session_user ON public.bingo_cards(session_id, twitch_user_id);
CREATE INDEX idx_bingo_sessions_status ON public.bingo_sessions(status);
