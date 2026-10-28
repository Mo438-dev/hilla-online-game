-- حُلّة — delta-14: usernames + wider analytics. Run once in the Supabase SQL editor, after
-- leaderboard-schema.sql. Safe to re-run. Additive only (new nullable columns, a new table, new
-- indexes); no existing row is changed, except that display names stop having to be unique.

-- ---------------------------------------------------------------------------
-- Usernames: a unique English handle (@mohammed_w). Display names («اسمك») can now repeat.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists username_changed_at timestamptz;
create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-z][a-z0-9_]{2,14}$');
-- display names may repeat now: drop the uniqueness on the normalised name (the column stays)
alter table public.profiles drop constraint if exists profiles_nickname_key_key;
drop index if exists public.profiles_nickname_key_key;

-- profile analytics (coarse device info only)
alter table public.profiles add column if not exists created_platform text;      -- ios | android | desktop
alter table public.profiles add column if not exists created_standalone boolean; -- home-screen app vs browser
alter table public.profiles add column if not exists first_game_at timestamptz;
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.profiles add column if not exists merged_into uuid;

-- ---------------------------------------------------------------------------
-- game_sessions: more about each game
-- ---------------------------------------------------------------------------
alter table public.game_sessions add column if not exists mode text;              -- online | local
alter table public.game_sessions add column if not exists cards_per_player integer;
alter table public.game_sessions add column if not exists ended_reason text;      -- win | abandoned | everyone_left
alter table public.game_sessions add column if not exists duration_ms integer;
alter table public.game_sessions add column if not exists coord_rounds integer;
alter table public.game_sessions add column if not exists app_build text;         -- deployed commit
-- (human_count, bot_count, winner_is_bot and ruleset_version already exist)

-- ---------------------------------------------------------------------------
-- game_players: per-seat outcome and behaviour
-- ---------------------------------------------------------------------------
alter table public.game_players add column if not exists user_id uuid;
alter table public.game_players add column if not exists seat integer;
alter table public.game_players add column if not exists place integer;
alter table public.game_players add column if not exists cards_left integer;
alter table public.game_players add column if not exists items_played integer;
alter table public.game_players add column if not exists rares_played integer;
alter table public.game_players add column if not exists actions_played jsonb;    -- {"drawTwo":1,...}
alter table public.game_players add column if not exists blocks_used integer;
alter table public.game_players add column if not exists times_targeted integer;
alter table public.game_players add column if not exists missed_turns integer;
alter table public.game_players add column if not exists became_inactive boolean;
alter table public.game_players add column if not exists premoves_set integer;
alter table public.game_players add column if not exists premoves_played integer;
alter table public.game_players add column if not exists reactions_sent integer;
alter table public.game_players add column if not exists platform text;
alter table public.game_players add column if not exists standalone boolean;
alter table public.game_players add column if not exists lang text;

-- ---------------------------------------------------------------------------
-- game_feedback: how far through the one-question-at-a-time survey people got
-- (game_id is already the session id)
-- ---------------------------------------------------------------------------
alter table public.game_feedback add column if not exists steps_answered smallint;
alter table public.game_feedback add column if not exists skipped_at_step smallint;

-- ---------------------------------------------------------------------------
-- client_errors: uncaught errors from players' devices (rate-limited on the device)
-- ---------------------------------------------------------------------------
create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  session_id uuid,          -- the game being played, if any
  user_id uuid,
  app_build text,
  platform text,
  standalone boolean,
  message text,
  stack text,
  url_path text
);
create index if not exists client_errors_created_idx on public.client_errors (created_at);
alter table public.client_errors enable row level security;
revoke all on public.client_errors from anon, authenticated;
grant all privileges on public.client_errors to service_role;
grant usage, select on all sequences in schema public to service_role;
