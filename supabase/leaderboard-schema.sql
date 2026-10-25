-- حُلّة — Leaderboard + accounts (v1). Run once in the Supabase SQL editor, after schema.sql and the
-- analytics schemas. Safe to re-run (idempotent). Everything here is written only by server routes
-- holding the service role; the browser never touches these tables directly.

create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- Rooms: which game the room is on, when the server saw it start, and whether any save of it was
-- rejected by the integrity checks (lib/integrity.ts). Set by the server, never by the client.
-- ---------------------------------------------------------------------------
alter table public.hilla_rooms add column if not exists game_id uuid;
alter table public.hilla_rooms add column if not exists game_started_at timestamptz;
alter table public.hilla_rooms add column if not exists integrity_rejects integer not null default 0;

-- Every rejected save, for review. game_id may be null for a room whose game never started.
create table if not exists public.integrity_rejections (
  id bigint generated always as identity primary key,
  room_code text not null,
  game_id uuid,
  reason text not null,
  created_at timestamptz not null default now()
);
create index if not exists integrity_rejections_game_idx on public.integrity_rejections (game_id);

-- Analytics: lets the dashboard join games to accounts later.
alter table public.game_players add column if not exists user_id uuid;

-- ---------------------------------------------------------------------------
-- Profiles: one per auth user (guest or saved). nickname_key is the normalised form used for
-- uniqueness (tashkeel/tatweel stripped, أ/إ/آ → ا, ى → ي, lower-case), so near-duplicates collide.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname citext,
  nickname_key text unique,
  nickname_changed_at timestamptz,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

-- Server routes enforce 2–16 (lib/leaderboard/nickname.ts); this is the backstop.
alter table public.profiles drop constraint if exists profiles_nickname_length;
alter table public.profiles add constraint profiles_nickname_length
  check (nickname is null or char_length(nickname) between 2 and 16);

create table if not exists public.nickname_reports (
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reporter_id, target_id)
);

-- ---------------------------------------------------------------------------
-- Seasons: one Hijri year (Umm al-Qura), 1 Muharram 00:00 Asia/Riyadh. Seeded, never computed in
-- SQL. Re-check against the official calendar and add the next year before 1450 ends.
-- ---------------------------------------------------------------------------
create table if not exists public.seasons (
  hijri_year int primary key,
  starts_at timestamptz not null,
  ends_at timestamptz not null
);
insert into public.seasons values
  (1448, '2026-06-16 00:00+03', '2027-06-06 00:00+03'),
  (1449, '2027-06-06 00:00+03', '2028-05-25 00:00+03'),
  (1450, '2028-05-25 00:00+03', '2029-05-14 00:00+03')
on conflict (hijri_year) do nothing;

-- ---------------------------------------------------------------------------
-- Results: one row per human seat with an account, per finished online game. Every row is stored;
-- rows that fail a counting rule keep counted=false and a reason. points/beaten/won/finished are
-- stored so a later re-tune can be recomputed from history.
-- ---------------------------------------------------------------------------
create table if not exists public.game_results (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.game_sessions(id),
  room_code text,
  user_id uuid not null references auth.users(id) on delete cascade,
  place int not null,
  humans int not null,
  total_players int not null,
  cards_left int not null,
  beaten int not null,
  won boolean not null,
  finished boolean not null,
  points int not null,
  counted boolean not null,
  reason text,
  group_key text not null,               -- sorted user_ids of the humans, for the same-group cap
  duration_ms int,
  turns int,
  ruleset_version text,
  finished_at timestamptz not null default now(),
  unique (game_id, user_id)
);
create index if not exists game_results_finished_idx on public.game_results (finished_at);
create index if not exists game_results_user_idx on public.game_results (user_id, finished_at);
create index if not exists game_results_group_idx on public.game_results (group_key, finished_at);

-- ---------------------------------------------------------------------------
-- Ranking. leaderboard_rows is the one query behind GET /api/leaderboard (service role only; it
-- returns user_id so the route can find the caller's own row, and the route strips it). The two
-- views are the spec's public shape: nickname, points, games, wins, rank, never user_id or email.
-- ---------------------------------------------------------------------------
create or replace function public.leaderboard_rows(p_from timestamptz, p_to timestamptz)
returns table (user_id uuid, nickname text, points bigint, games bigint, wins bigint, rank bigint)
language sql
stable
as $$
  select r.user_id,
         p.nickname::text,
         sum(r.points)::bigint as points,
         count(*)::bigint as games,
         count(*) filter (where r.place = 1)::bigint as wins,
         rank() over (order by sum(r.points) desc)::bigint as rank
  from public.game_results r
  join public.profiles p on p.user_id = r.user_id
  where r.counted
    and p.nickname is not null
    and not p.hidden
    and (p_from is null or r.finished_at >= p_from)
    and (p_to is null or r.finished_at < p_to)
  group by r.user_id, p.nickname
$$;

create or replace view public.leaderboard_all_time as
  select nickname, points, games, wins, rank from public.leaderboard_rows(null, null);

create or replace view public.leaderboard_season as
  select l.nickname, l.points, l.games, l.wins, l.rank
  from public.seasons s
  cross join lateral public.leaderboard_rows(s.starts_at, s.ends_at) l
  where now() >= s.starts_at and now() < s.ends_at;

-- Daily cleanup (Mohammed's rule): anonymous users whose last sign-in was over a year ago. Saved
-- accounts are never touched. Their results cascade away with them.
create or replace function public.delete_stale_guests()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare n integer;
begin
  delete from auth.users
  where is_anonymous
    and coalesce(last_sign_in_at, created_at) < now() - interval '1 year';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: server-only, except that a signed-in user may read their own results and profile.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.game_results enable row level security;
alter table public.seasons enable row level security;
alter table public.nickname_reports enable row level security;
alter table public.integrity_rejections enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select to authenticated using (user_id = auth.uid());
drop policy if exists "own results" on public.game_results;
create policy "own results" on public.game_results for select to authenticated using (user_id = auth.uid());

revoke all on public.profiles, public.game_results, public.seasons, public.nickname_reports, public.integrity_rejections from anon;
revoke insert, update, delete on public.profiles, public.game_results from authenticated;
revoke all on public.seasons, public.nickname_reports, public.integrity_rejections from authenticated;
revoke all on public.leaderboard_all_time, public.leaderboard_season from anon, authenticated;
revoke all on function public.leaderboard_rows(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.delete_stale_guests() from public, anon, authenticated;
grant select on public.profiles, public.game_results to authenticated;
-- Explicit, as with game_feedback: default grants didn't reliably cover service_role there.
grant all privileges on public.profiles, public.game_results, public.seasons, public.nickname_reports, public.integrity_rejections to service_role;
grant select on public.leaderboard_all_time, public.leaderboard_season to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function public.leaderboard_rows(timestamptz, timestamptz) to service_role;
grant execute on function public.delete_stale_guests() to service_role;

-- ---------------------------------------------------------------------------
-- Extra locks on existing objects, now that anonymous sign-ins give guests the "authenticated" role.
-- 1. hilla_rooms: RLS already allows only the service role; also drop the default table grants so
--    the policy isn't the only lock. Nothing in the browser reads hilla_rooms (all access is through
--    server routes with the service role key).
-- 2. analytics_anonymize_player_names(): functions are executable by PUBLIC by default, which the
--    earlier revoke from anon/authenticated didn't remove.
-- ---------------------------------------------------------------------------
revoke all on public.hilla_rooms from anon, authenticated;
grant all privileges on public.hilla_rooms to service_role;
revoke execute on function public.analytics_anonymize_player_names() from public;
grant execute on function public.analytics_anonymize_player_names() to service_role;
