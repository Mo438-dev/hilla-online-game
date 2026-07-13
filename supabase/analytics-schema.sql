-- ============================================================================
-- Hilla game analytics schema
-- Run this in the Supabase SQL editor (same workflow as schema.sql).
-- Raw events in game_events are the single source of truth and append-only.
-- All aggregation happens in the analytics_* views below — there are no
-- app-maintained counter columns anywhere in this schema.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A. game_sessions — one row per game, created at game_started,
--    outcome fields filled in once at game_finished.
-- ---------------------------------------------------------------------------
create table if not exists public.game_sessions (
  id uuid primary key,
  room_code text,
  ruleset_version text not null default 'v1',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer,
  player_count integer not null,
  human_count integer not null,
  bot_count integer not null,
  winner_player_id text,
  winner_name text,
  winner_is_bot boolean,
  total_turns integer,
  total_rounds integer,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists game_sessions_created_at_idx on public.game_sessions (created_at);
create index if not exists game_sessions_ruleset_idx on public.game_sessions (ruleset_version);

-- ---------------------------------------------------------------------------
-- B. game_players — identity/outcome only, set once. No running totals here:
--    everything countable is derived from game_events via
--    analytics_player_summary (see "Aggregation strategy" in the README).
-- ---------------------------------------------------------------------------
create table if not exists public.game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.game_sessions(id),
  player_id text not null,
  player_name text,
  is_bot boolean not null default false,
  won boolean not null default false,
  created_at timestamptz not null default now(),
  unique (game_id, player_id)
);

create index if not exists game_players_game_id_idx on public.game_players (game_id);

-- ---------------------------------------------------------------------------
-- C. game_events — immutable raw events. event_id is deterministic
--    client-side, so duplicate emissions (multi-client races, retries,
--    React double effects) collapse into a single row via the unique index.
--    items jsonb (items_played only): [{ "name": text, "region": text,
--    "rarity": "common"|"medium"|"rare" }, ...] — one entry per card placed.
--    payload jsonb is allowlisted per event type by the API route.
-- ---------------------------------------------------------------------------
create table if not exists public.game_events (
  id uuid primary key default gen_random_uuid(),
  event_id text unique not null,
  game_id uuid references public.game_sessions(id),
  room_code text,
  player_id text,
  player_name text,
  is_bot boolean,
  event_type text not null,
  turn_number integer,
  round_number integer,
  coord_type text,
  coord_region text,
  coord_item_count integer,
  cards_played_count integer,
  items jsonb,
  action_type text,
  skip_reason text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists game_events_game_id_idx on public.game_events (game_id);
create index if not exists game_events_player_id_idx on public.game_events (player_id);
create index if not exists game_events_event_type_idx on public.game_events (event_type);
create index if not exists game_events_created_at_idx on public.game_events (created_at);

-- ---------------------------------------------------------------------------
-- Row level security: analytics tables are server-only. The browser never
-- reads or writes them directly — all access goes through Next.js API routes
-- holding the service role key.
-- ---------------------------------------------------------------------------
alter table public.game_sessions enable row level security;
alter table public.game_players enable row level security;
alter table public.game_events enable row level security;

drop policy if exists "service role manages game_sessions" on public.game_sessions;
create policy "service role manages game_sessions" on public.game_sessions
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages game_players" on public.game_players;
create policy "service role manages game_players" on public.game_players
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages game_events" on public.game_events;
create policy "service role manages game_events" on public.game_events
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

revoke all on public.game_sessions from anon, authenticated;
revoke all on public.game_players from anon, authenticated;
revoke all on public.game_events from anon, authenticated;

-- ============================================================================
-- Views — the only aggregation layer. If dashboard queries ever get slow,
-- convert the hot ones to materialized views refreshed on a schedule
-- (pg_cron or a Vercel cron hitting a refresh endpoint); do NOT add counter
-- columns to the tables.
-- ============================================================================

-- Per-game summary: session fields + counts derived from raw events.
create or replace view public.analytics_game_summary
with (security_invoker = false) as
select
  gs.id,
  gs.room_code,
  gs.ruleset_version,
  gs.started_at,
  gs.ended_at,
  gs.duration_seconds,
  gs.player_count,
  gs.human_count,
  gs.bot_count,
  gs.winner_player_id,
  gs.winner_name,
  gs.winner_is_bot,
  gs.total_turns,
  gs.total_rounds,
  gs.completed,
  coalesce(ev.turns_started, 0) as turns_started,
  coalesce(ev.item_play_events, 0) as item_play_events,
  coalesce(ev.cards_played_total, 0) as cards_played_total,
  case when coalesce(ev.item_play_events, 0) > 0
       then ev.cards_played_total::numeric / ev.item_play_events end as avg_cards_per_item_play,
  greatest(coalesce(ev.turns_started, 0) - coalesce(ev.turns_with_items, 0), 0) as zero_card_turns,
  case when coalesce(ev.turns_started, 0) > 0
       then greatest(ev.turns_started - coalesce(ev.turns_with_items, 0), 0)::numeric / ev.turns_started end as zero_card_turn_rate,
  coalesce(ev.skip_count, 0) as skip_count,
  coalesce(ev.no_valid_card_skips, 0) as no_valid_card_skips,
  coalesce(ev.action_plays, 0) as action_plays,
  coalesce(ev.blocks_used, 0) as blocks_used,
  coalesce(ev.random_coord_count, 0) as random_coord_count,
  coalesce(ev.region_coord_count, 0) as region_coord_count
from public.game_sessions gs
left join (
  select
    game_id,
    count(*) filter (where event_type = 'turn_started') as turns_started,
    count(*) filter (where event_type = 'items_played') as item_play_events,
    sum(cards_played_count) filter (where event_type = 'items_played') as cards_played_total,
    count(distinct turn_number) filter (where event_type = 'items_played') as turns_with_items,
    count(*) filter (where event_type = 'turn_skipped') as skip_count,
    count(*) filter (where event_type = 'turn_skipped' and skip_reason = 'no_valid_card') as no_valid_card_skips,
    count(*) filter (where event_type = 'action_played') as action_plays,
    count(*) filter (where event_type = 'block_used') as blocks_used,
    count(*) filter (where event_type = 'coord_changed' and coord_type = 'random') as random_coord_count,
    count(*) filter (where event_type = 'coord_changed' and coord_type = 'region') as region_coord_count
  from public.game_events
  group by game_id
) ev on ev.game_id = gs.id;

-- Per-player-per-game summary — replaces per-player counter columns entirely.
create or replace view public.analytics_player_summary
with (security_invoker = false) as
select
  gp.game_id,
  gp.player_id,
  gp.player_name,
  gp.is_bot,
  gp.won,
  gs.ruleset_version,
  gs.player_count,
  gs.completed,
  count(*) filter (where e.event_type = 'turn_started') as turns_taken,
  count(*) filter (where e.event_type = 'items_played') as item_play_events,
  coalesce(sum(e.cards_played_count) filter (where e.event_type = 'items_played'), 0) as cards_played,
  case when count(*) filter (where e.event_type = 'items_played') > 0
       then sum(e.cards_played_count) filter (where e.event_type = 'items_played')::numeric
            / count(*) filter (where e.event_type = 'items_played') end as avg_cards_per_item_play,
  greatest(
    count(*) filter (where e.event_type = 'turn_started')
      - count(distinct e.turn_number) filter (where e.event_type = 'items_played'), 0) as zero_card_turns,
  count(*) filter (where e.event_type = 'turn_skipped') as skip_count,
  count(*) filter (where e.event_type = 'turn_skipped' and e.skip_reason = 'no_valid_card') as no_valid_card_skips,
  count(*) filter (where e.event_type = 'action_played') as action_cards_played,
  count(*) filter (where e.event_type = 'block_used') as blocks_used
from public.game_players gp
join public.game_sessions gs on gs.id = gp.game_id
left join public.game_events e on e.game_id = gp.game_id and e.player_id = gp.player_id
group by gp.game_id, gp.player_id, gp.player_name, gp.is_bot, gp.won,
         gs.ruleset_version, gs.player_count, gs.completed;

-- Daily rollup (UTC days).
create or replace view public.analytics_daily_summary
with (security_invoker = false) as
select
  (gs.started_at at time zone 'utc')::date as day,
  count(*) as games_started,
  count(*) filter (where gs.completed) as games_completed,
  avg(gs.duration_seconds) filter (where gs.completed) as avg_duration_seconds,
  avg(gs.total_turns) filter (where gs.completed) as avg_total_turns,
  avg(gs.player_count) as avg_player_count,
  count(*) filter (where gs.winner_is_bot = false) as human_wins,
  count(*) filter (where gs.winner_is_bot = true) as bot_wins
from public.game_sessions gs
group by 1;

-- Coordination-card behavior: how often each coord card shape is drawn, and
-- how players behave under it (skips vs item plays). Gameplay events are
-- stamped with the live coord context, so turn_skipped/items_played rows
-- carry the coord they happened under.
create or replace view public.analytics_coord_summary
with (security_invoker = false) as
select
  gs.ruleset_version,
  e.coord_type,
  e.coord_region,
  e.coord_item_count,
  count(*) filter (where e.event_type = 'coord_changed') as times_drawn,
  count(*) filter (where e.event_type = 'turn_skipped') as turns_skipped_under,
  count(*) filter (where e.event_type = 'turn_skipped' and e.skip_reason = 'no_valid_card') as no_valid_card_skips_under,
  count(*) filter (where e.event_type = 'items_played') as item_plays_under,
  coalesce(sum(e.cards_played_count) filter (where e.event_type = 'items_played'), 0) as cards_played_under
from public.game_events e
join public.game_sessions gs on gs.id = e.game_id
where e.event_type in ('coord_changed', 'turn_skipped', 'items_played')
group by 1, 2, 3, 4;

-- Rarity/region unload behavior: unnests the items payload of items_played
-- events. This is the "is rare actually hard to unload?" view.
create or replace view public.analytics_rarity_summary
with (security_invoker = false) as
select
  gs.ruleset_version,
  item ->> 'rarity' as rarity,
  item ->> 'region' as region,
  item ->> 'name' as item_name,
  count(*) as times_played,
  count(*) filter (where e.is_bot) as times_played_by_bots,
  count(*) filter (where e.coord_type = 'random') as played_on_random_coord,
  count(distinct e.game_id) as games_seen_in
from public.game_events e
join public.game_sessions gs on gs.id = e.game_id
cross join lateral jsonb_array_elements(e.items) as item
where e.event_type = 'items_played' and e.items is not null
group by 1, 2, 3, 4;

-- Estimated human-pace duration for bot-containing games: average
-- seconds-per-turn from completed all-human games with the same player_count
-- and ruleset_version, multiplied by the bot game's total_turns.
create or replace view public.analytics_duration_estimate
with (security_invoker = false) as
with human_baseline as (
  select player_count, ruleset_version,
         avg(duration_seconds::numeric / nullif(total_turns, 0)) as avg_seconds_per_turn
  from public.game_sessions
  where completed = true and bot_count = 0
  group by player_count, ruleset_version
)
select gs.id, gs.room_code, gs.player_count, gs.ruleset_version, gs.total_turns,
       gs.duration_seconds as actual_duration_seconds,
       gs.total_turns * hb.avg_seconds_per_turn as estimated_human_duration_seconds
from public.game_sessions gs
join human_baseline hb
  on hb.player_count = gs.player_count and hb.ruleset_version = gs.ruleset_version
where gs.bot_count > 0 and gs.completed = true;

-- Win rate for players who used a given action card at least once in a game.
-- Compare against 1/player_count (naive baseline) or the human/bot win rates
-- in analytics_game_summary to flag overpowered cards.
create or replace view public.analytics_action_advantage
with (security_invoker = false) as
select e.action_type, gs.player_count, gs.ruleset_version,
       count(distinct case when gp.won then e.game_id || e.player_id end)::float
         / nullif(count(distinct e.game_id || e.player_id), 0) as win_rate_when_used,
       count(distinct e.game_id || e.player_id) as players_who_used_it
from public.game_events e
join public.game_players gp on gp.game_id = e.game_id and gp.player_id = e.player_id
join public.game_sessions gs on gs.id = e.game_id
where e.event_type = 'action_played'
group by e.action_type, gs.player_count, gs.ruleset_version;

-- One row per ruleset_version with the key balance metrics side by side, so
-- two versions can be diffed directly.
create or replace view public.analytics_version_comparison
with (security_invoker = false) as
select
  gs.ruleset_version,
  count(distinct gs.id) as games_played,
  avg(gs.duration_seconds) filter (where gs.completed) as avg_duration_seconds,
  avg(gs.total_turns) filter (where gs.completed) as avg_total_turns,
  avg(case when gs.winner_is_bot = false then 1.0 else 0.0 end) as human_win_rate,
  (select avg(e.cards_played_count) from public.game_events e
     join public.game_sessions gs2 on gs2.id = e.game_id
     where e.event_type = 'items_played' and gs2.ruleset_version = gs.ruleset_version
  ) as avg_cards_per_item_play,
  (select count(*) filter (where e.event_type = 'turn_skipped')::numeric
            / nullif(count(*) filter (where e.event_type = 'turn_started'), 0)
     from public.game_events e join public.game_sessions gs2 on gs2.id = e.game_id
     where e.event_type in ('turn_skipped', 'turn_started')
       and gs2.ruleset_version = gs.ruleset_version
  ) as skip_rate,
  (select avg(case when e.coord_type = 'random' then 1.0 else 0.0 end)
     from public.game_events e join public.game_sessions gs2 on gs2.id = e.game_id
     where e.event_type = 'coord_changed' and gs2.ruleset_version = gs.ruleset_version
  ) as random_coord_share
from public.game_sessions gs
where gs.completed = true
group by gs.ruleset_version;

-- Views are server-only, same as the tables.
revoke all on public.analytics_game_summary from anon, authenticated;
revoke all on public.analytics_player_summary from anon, authenticated;
revoke all on public.analytics_daily_summary from anon, authenticated;
revoke all on public.analytics_coord_summary from anon, authenticated;
revoke all on public.analytics_rarity_summary from anon, authenticated;
revoke all on public.analytics_duration_estimate from anon, authenticated;
revoke all on public.analytics_action_advantage from anon, authenticated;
revoke all on public.analytics_version_comparison from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Optional later anonymization: hashes stored player names in place using the
-- built-in sha256 (no pgcrypto needed). Run manually in the SQL editor when
-- desired: select public.analytics_anonymize_player_names();
-- ---------------------------------------------------------------------------
create or replace function public.analytics_anonymize_player_names()
returns void
language plpgsql
as $$
begin
  update public.game_players
     set player_name = 'p_' || left(encode(sha256(convert_to(player_name, 'utf8')), 'hex'), 12)
   where player_name is not null and player_name not like 'p\_%';

  update public.game_events
     set player_name = 'p_' || left(encode(sha256(convert_to(player_name, 'utf8')), 'hex'), 12)
   where player_name is not null and player_name not like 'p\_%';

  update public.game_sessions
     set winner_name = 'p_' || left(encode(sha256(convert_to(winner_name, 'utf8')), 'hex'), 12)
   where winner_name is not null and winner_name not like 'p\_%';
end;
$$;

revoke all on function public.analytics_anonymize_player_names() from anon, authenticated;
