-- ============================================================================
-- Hilla analytics V2 — additive, rerunnable migration.
-- Run AFTER analytics-schema.sql in the Supabase SQL editor.
-- Nothing here destroys or rewrites existing data; older games simply lack
-- the new events/fields and show "data unavailable" in the dashboard.
-- ============================================================================

-- Coordination-cycle tracing: every gameplay event now also carries the id of
-- the coordination card that was live when it happened, so a "cycle" is
-- group by (game_id, coord_card_id).
alter table public.game_events add column if not exists coord_card_id text;
create index if not exists game_events_coord_card_idx on public.game_events (game_id, coord_card_id);

-- ---------------------------------------------------------------------------
-- Post-game survey (optional, never blocks gameplay).
-- client_pid is a random localStorage-only pseudonymous id — no emails, IPs
-- or fingerprints are ever collected.
-- ---------------------------------------------------------------------------
create table if not exists public.game_feedback (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.game_sessions(id),
  player_id text,
  client_pid text,
  fun smallint check (fun between 1 and 5),
  clarity smallint check (clarity between 1 and 5),
  play_again boolean,
  comment text,
  created_at timestamptz not null default now(),
  unique (game_id, player_id)
);

create index if not exists game_feedback_game_id_idx on public.game_feedback (game_id);
create index if not exists game_feedback_created_at_idx on public.game_feedback (created_at);

alter table public.game_feedback enable row level security;
drop policy if exists "service role manages game_feedback" on public.game_feedback;
create policy "service role manages game_feedback" on public.game_feedback
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
revoke all on public.game_feedback from anon, authenticated;

-- ---------------------------------------------------------------------------
-- V2 views (exploration/BI convenience; the dashboard itself aggregates the
-- raw events server-side so every filter applies consistently).
-- ---------------------------------------------------------------------------

-- Item lifecycle: dealt (deal_snapshot) vs played (items_played) vs stuck with
-- losers at game end (end_snapshot), per ruleset version.
create or replace view public.analytics_item_lifecycle
with (security_invoker = false) as
with dealt as (
  select gs.ruleset_version, item ->> 'name' as item_name, item ->> 'region' as region,
         item ->> 'rarity' as rarity, count(*) as dealt_count
  from public.game_events e
  join public.game_sessions gs on gs.id = e.game_id
  cross join lateral jsonb_array_elements(e.items) as item
  where e.event_type = 'deal_snapshot'
  group by 1, 2, 3, 4
),
played as (
  select gs.ruleset_version, item ->> 'name' as item_name, count(*) as played_count
  from public.game_events e
  join public.game_sessions gs on gs.id = e.game_id
  cross join lateral jsonb_array_elements(e.items) as item
  where e.event_type = 'items_played'
  group by 1, 2
),
stuck as (
  select gs.ruleset_version, item ->> 'name' as item_name, count(*) as stuck_count
  from public.game_events e
  join public.game_sessions gs on gs.id = e.game_id
  cross join lateral jsonb_array_elements(e.items) as item
  where e.event_type = 'end_snapshot'
  group by 1, 2
)
select d.ruleset_version, d.item_name, d.region, d.rarity,
       d.dealt_count,
       coalesce(p.played_count, 0) as played_count,
       coalesce(s.stuck_count, 0) as stuck_with_losers,
       case when d.dealt_count > 0 then coalesce(p.played_count, 0)::numeric / d.dealt_count end as unload_rate
from dealt d
left join played p on p.ruleset_version = d.ruleset_version and p.item_name = d.item_name
left join stuck s on s.ruleset_version = d.ruleset_version and s.item_name = d.item_name;

-- Player experience: games per pseudonymous browser id.
create or replace view public.analytics_player_experience
with (security_invoker = false) as
select e.payload ->> 'client_pid' as client_pid,
       count(distinct e.game_id) as games_played,
       min(e.created_at) as first_seen,
       max(e.created_at) as last_seen
from public.game_events e
where e.event_type = 'player_identity' and e.payload ->> 'client_pid' is not null
group by 1;

-- Survey rollup per ruleset version, with sample sizes.
create or replace view public.analytics_feedback_summary
with (security_invoker = false) as
select gs.ruleset_version,
       count(*) as responses,
       avg(f.fun) as avg_fun,
       avg(f.clarity) as avg_clarity,
       avg(case when f.play_again then 1.0 else 0.0 end) as play_again_rate,
       count(f.comment) filter (where length(coalesce(f.comment, '')) > 0) as comments
from public.game_feedback f
join public.game_sessions gs on gs.id = f.game_id
group by 1;

revoke all on public.analytics_item_lifecycle from anon, authenticated;
revoke all on public.analytics_player_experience from anon, authenticated;
revoke all on public.analytics_feedback_summary from anon, authenticated;

-- Retention/cleanup plan (documented, NOT automated): raw events are kept
-- indefinitely for now. When volume warrants, archive game_events older than
-- 12 months to CSV and delete with:
--   delete from public.game_events where created_at < now() - interval '12 months';
-- Aggregated views recompute automatically from whatever raw data remains.
