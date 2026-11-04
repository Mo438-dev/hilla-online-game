-- حُلّة delta-15: the new analytics page. Run once in the Supabase SQL editor. No accounts are merged here.
-- Safe in either order with merge-accounts-15a.sql: both create public_id and the same index only if absent.

begin;

-- opaque player key for the browser (duel ?ref= and analytics rows)
alter table public.profiles add column if not exists public_id uuid not null default gen_random_uuid();
create unique index if not exists profiles_public_id_idx on public.profiles (public_id);

-- test games stay out of every metric
alter table public.game_sessions add column if not exists is_test boolean not null default false;
update public.game_sessions set is_test = true where id = '23035a08-b72b-4789-9cdf-0b109cfecb3b';
create index if not exists game_sessions_analytics_idx on public.game_sessions (ruleset_version, player_count, completed) where not is_test;

commit;
