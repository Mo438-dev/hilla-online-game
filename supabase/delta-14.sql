-- حُلّة — delta-14: usernames + wider analytics. Run once in the Supabase SQL editor, after
-- leaderboard-schema.sql. Safe to re-run. Additive only (new nullable columns, a new table, new
-- indexes); no existing row is changed, except that display names stop having to be unique.
-- All-or-nothing: if any statement fails, nothing is applied.

begin;

-- ---------------------------------------------------------------------------
-- Usernames: a unique English handle (@mohammed_w). Display names («اسمك») can now repeat.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists username_changed_at timestamptz;
create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-z][a-z0-9_]{2,14}$');
-- display names may repeat now: drop ANY unique constraint or unique index on profiles.nickname_key,
-- whatever it's called (the column stays, it's still used for lookups)
do $$
declare r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
    where con.conrelid = 'public.profiles'::regclass and con.contype = 'u' and att.attname = 'nickname_key'
  loop
    execute format('alter table public.profiles drop constraint %I', r.conname);
  end loop;
  for r in
    select ic.relname as indexname
    from pg_index ix
    join pg_class ic on ic.oid = ix.indexrelid
    join pg_attribute att on att.attrelid = ix.indrelid and att.attnum = any (ix.indkey)
    where ix.indrelid = 'public.profiles'::regclass and ix.indisunique and not ix.indisprimary and att.attname = 'nickname_key'
  loop
    execute format('drop index if exists public.%I', r.indexname);
  end loop;
  -- check: nothing unique may be left on nickname_key
  if exists (
    select 1
    from pg_index ix
    join pg_attribute att on att.attrelid = ix.indrelid and att.attnum = any (ix.indkey)
    where ix.indrelid = 'public.profiles'::regclass and ix.indisunique and not ix.indisprimary and att.attname = 'nickname_key'
  ) then
    raise exception 'profiles.nickname_key is still unique';
  end if;
end $$;

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
create index if not exists game_players_user_idx on public.game_players (user_id);

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

commit;
