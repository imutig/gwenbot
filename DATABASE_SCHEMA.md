# Database Schema for gwenbot

This file documents the Supabase database schema used by gwenbot.
To update this schema, go to Supabase Dashboard → SQL Editor and run:

```sql
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
```

Then paste the results below.

---

## Schema (Last Updated: PENDING - Please paste schema output below)

<!-- 
Paste your schema output here in this format:

-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.authorized_users (
  id integer NOT NULL DEFAULT nextval('authorized_users_id_seq'::regclass),
  username character varying NOT NULL UNIQUE,
  is_super_admin boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT authorized_users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cemantig_guesses (
  id integer NOT NULL DEFAULT nextval('cemantig_guesses_id_seq'::regclass),
  session_id integer,
  player_id integer,
  word text NOT NULL,
  similarity integer NOT NULL,
  guessed_at timestamp without time zone DEFAULT now(),
  CONSTRAINT cemantig_guesses_pkey PRIMARY KEY (id),
  CONSTRAINT cemantig_guesses_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.cemantig_sessions(id),
  CONSTRAINT cemantig_guesses_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);
CREATE TABLE public.cemantig_sessions (
  id integer NOT NULL DEFAULT nextval('cemantig_sessions_id_seq'::regclass),
  secret_word text NOT NULL,
  status text DEFAULT 'active'::text,
  started_at timestamp without time zone DEFAULT now(),
  finished_at timestamp without time zone,
  winner_id integer,
  total_guesses integer DEFAULT 0,
  is_random boolean DEFAULT false,
  CONSTRAINT cemantig_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT cemantig_sessions_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.players(id)
);
CREATE TABLE public.chat_messages (
  id integer NOT NULL DEFAULT nextval('chat_messages_id_seq'::regclass),
  player_id integer,
  content text,
  emojis ARRAY,
  sent_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);
CREATE TABLE public.connect4_games (
  id integer NOT NULL DEFAULT nextval('connect4_games_id_seq'::regclass),
  status character varying NOT NULL DEFAULT 'waiting'::character varying CHECK (status::text = ANY (ARRAY['waiting'::character varying, 'playing'::character varying, 'finished'::character varying]::text[])),
  host_id integer,
  challenger_id integer,
  board jsonb NOT NULL DEFAULT '[[], [], [], [], [], []]'::jsonb,
  current_turn character varying DEFAULT 'host'::character varying,
  winner_id integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT connect4_games_pkey PRIMARY KEY (id),
  CONSTRAINT connect4_games_host_id_fkey FOREIGN KEY (host_id) REFERENCES public.players(id),
  CONSTRAINT connect4_games_challenger_id_fkey FOREIGN KEY (challenger_id) REFERENCES public.players(id),
  CONSTRAINT connect4_games_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.players(id)
);
CREATE TABLE public.game_sessions (
  id integer NOT NULL DEFAULT nextval('game_sessions_id_seq'::regclass),
  lang character varying NOT NULL,
  word character varying,
  winner_id integer,
  duration integer,
  guess_count integer,
  player_count integer,
  started_at timestamp with time zone,
  ended_at timestamp with time zone DEFAULT now(),
  CONSTRAINT game_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT game_sessions_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.players(id)
);
CREATE TABLE public.memory_games (
  id integer NOT NULL DEFAULT nextval('memory_games_id_seq'::regclass),
  mode character varying NOT NULL,
  difficulty character varying NOT NULL,
  status character varying NOT NULL DEFAULT 'waiting'::character varying,
  host_id integer,
  challenger_id integer,
  cards jsonb NOT NULL,
  matched jsonb DEFAULT '[]'::jsonb,
  host_pairs integer DEFAULT 0,
  challenger_pairs integer DEFAULT 0,
  current_turn character varying DEFAULT 'host'::character varying,
  winner_id integer,
  moves integer DEFAULT 0,
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT memory_games_pkey PRIMARY KEY (id),
  CONSTRAINT memory_games_host_id_fkey FOREIGN KEY (host_id) REFERENCES public.players(id),
  CONSTRAINT memory_games_challenger_id_fkey FOREIGN KEY (challenger_id) REFERENCES public.players(id),
  CONSTRAINT memory_games_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.players(id)
);
CREATE TABLE public.player_stats (
  id integer NOT NULL DEFAULT nextval('player_stats_id_seq'::regclass),
  player_id integer UNIQUE,
  games_played integer DEFAULT 0,
  total_points integer DEFAULT 0,
  best_session_score integer DEFAULT 0,
  words_found integer DEFAULT 0,
  sudoku_br_wins integer DEFAULT 0,
  CONSTRAINT player_stats_pkey PRIMARY KEY (id),
  CONSTRAINT player_stats_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);
CREATE TABLE public.players (
  id integer NOT NULL DEFAULT nextval('players_id_seq'::regclass),
  username character varying NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT players_pkey PRIMARY KEY (id)
);
CREATE TABLE public.session_guesses (
  id integer NOT NULL DEFAULT nextval('session_guesses_id_seq'::regclass),
  session_id integer,
  player_id integer,
  word character varying NOT NULL,
  score double precision,
  degree integer,
  points integer,
  guessed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT session_guesses_pkey PRIMARY KEY (id),
  CONSTRAINT session_guesses_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.game_sessions(id),
  CONSTRAINT session_guesses_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);
CREATE TABLE public.streamer_records (
  id integer NOT NULL DEFAULT nextval('streamer_records_id_seq'::regclass),
  lang character varying NOT NULL,
  record_type character varying NOT NULL,
  value integer NOT NULL,
  month character varying,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT streamer_records_pkey PRIMARY KEY (id)
);
CREATE TABLE public.sudoku_br_players (
  id integer NOT NULL DEFAULT nextval('sudoku_br_players_id_seq'::regclass),
  game_id integer,
  player_id integer,
  progress text DEFAULT ''::text,
  cells_filled integer DEFAULT 0,
  errors integer DEFAULT 0,
  status character varying DEFAULT 'playing'::character varying,
  finish_rank integer,
  finish_time integer,
  joined_at timestamp with time zone DEFAULT now(),
  finished_at timestamp with time zone,
  CONSTRAINT sudoku_br_players_pkey PRIMARY KEY (id),
  CONSTRAINT sudoku_br_players_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.sudoku_games(id),
  CONSTRAINT sudoku_br_players_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);
CREATE TABLE public.sudoku_games (
  id integer NOT NULL DEFAULT nextval('sudoku_games_id_seq'::regclass),
  mode character varying NOT NULL,
  difficulty character varying DEFAULT 'medium'::character varying,
  puzzle text NOT NULL,
  solution text NOT NULL,
  status character varying DEFAULT 'waiting'::character varying,
  winner_id integer,
  created_at timestamp with time zone DEFAULT now(),
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  host_id integer,
  host_progress text DEFAULT ''::text,
  challenger_progress text DEFAULT ''::text,
  time_seconds integer,
  challenger_id integer,
  host_errors integer DEFAULT 0,
  challenger_errors integer DEFAULT 0,
  is_battle_royale boolean DEFAULT false,
  CONSTRAINT sudoku_games_pkey PRIMARY KEY (id),
  CONSTRAINT sudoku_games_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.players(id),
  CONSTRAINT sudoku_games_host_id_fkey FOREIGN KEY (host_id) REFERENCES public.players(id),
  CONSTRAINT sudoku_games_challenger_id_fkey FOREIGN KEY (challenger_id) REFERENCES public.players(id)
);
CREATE TABLE public.sudoku_players (
  id integer NOT NULL DEFAULT nextval('sudoku_players_id_seq'::regclass),
  game_id integer,
  player_id integer,
  role character varying NOT NULL,
  progress text,
  cells_filled integer DEFAULT 0,
  finished_at timestamp with time zone,
  CONSTRAINT sudoku_players_pkey PRIMARY KEY (id),
  CONSTRAINT sudoku_players_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.sudoku_games(id),
  CONSTRAINT sudoku_players_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);
CREATE TABLE public.sudoku_queue (
  id integer NOT NULL DEFAULT nextval('sudoku_queue_id_seq'::regclass),
  game_id integer,
  player_id integer,
  joined_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sudoku_queue_pkey PRIMARY KEY (id),
  CONSTRAINT sudoku_queue_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.sudoku_games(id),
  CONSTRAINT sudoku_queue_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);
CREATE TABLE public.twitch_streams (
  id integer NOT NULL DEFAULT nextval('twitch_streams_id_seq'::regclass),
  twitch_stream_id character varying UNIQUE,
  title text,
  game_name character varying,
  started_at timestamp with time zone NOT NULL,
  ended_at timestamp with time zone,
  peak_viewers integer DEFAULT 0,
  total_chatters integer DEFAULT 0,
  CONSTRAINT twitch_streams_pkey PRIMARY KEY (id)
);
CREATE TABLE public.twitch_tokens (
  id integer NOT NULL DEFAULT nextval('twitch_tokens_id_seq'::regclass),
  token_type character varying NOT NULL,
  user_id character varying,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamp with time zone,
  scopes ARRAY,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT twitch_tokens_pkey PRIMARY KEY (id)
);
CREATE TABLE public.viewer_presence (
  id integer NOT NULL DEFAULT nextval('viewer_presence_id_seq'::regclass),
  stream_id integer,
  player_id integer,
  first_seen timestamp with time zone NOT NULL,
  last_seen timestamp with time zone NOT NULL,
  message_count integer DEFAULT 1,
  watch_time_seconds integer DEFAULT 0,
  CONSTRAINT viewer_presence_pkey PRIMARY KEY (id),
  CONSTRAINT viewer_presence_stream_id_fkey FOREIGN KEY (stream_id) REFERENCES public.twitch_streams(id),
  CONSTRAINT viewer_presence_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);

## Known Tables

Based on the codebase, these tables are used:

- `players` - Player/viewer information
- `game_sessions` - Cemantix game sessions
- `session_guesses` - Guesses made during game sessions
- `player_stats` - Player statistics for games
- `streamer_records` - FR/EN alltime and monthly records
- `chat_messages` - Chat message history
- `viewer_presence` - Viewer watch time tracking
- `twitch_tokens` - OAuth tokens for bot and broadcaster
- `authorized_users` - Admin users list
- `streams` - Stream session tracking
- `sudoku_games` - Sudoku game state
- `sudoku_players` - Sudoku player data
