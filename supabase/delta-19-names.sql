-- حُلّة — saved accounts may leave the display name empty and go by @username.
-- The leaderboard lists them too (nickname comes back null; the app shows @username).
-- Run once in the Supabase SQL editor. Same function signature, so nothing else changes.

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
    and (p.nickname is not null or p.username is not null)
    and not p.hidden
    and p.merged_into is null
    and (p_from is null or r.finished_at >= p_from)
    and (p_to is null or r.finished_at < p_to)
  group by r.user_id, p.nickname
$$;
