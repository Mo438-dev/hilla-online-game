-- حُلّة — merge Mohammed's two accounts into the one in use, and give it the username mwooody.
-- Run once in the Supabase SQL editor. All-or-nothing: any failed check rolls the whole file back.
--   from a1db07a9 (guest, @mwooody, «محمد ونعم», 15 results)
--   into 5cf99a6d (saved with email, @mwooody1, «محمد», 22 results) — the account signed in now
-- The kept account's name «محمد» stays; only the username changes to mwooody.
-- The old profile row stays, marked merged_into (hidden from every board and the head-to-head).

begin;

-- Merged profiles are hidden from every board (same function as merge-accounts-15a.sql; safe to repeat).
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
    and p.merged_into is null
    and (p_from is null or r.finished_at >= p_from)
    and (p_to is null or r.finished_at < p_to)
  group by r.user_id, p.nickname
$$;

do $$
declare
  old_id uuid := 'a1db07a9-09b1-4331-980d-cf03bb2b312a';
  new_id uuid := '5cf99a6d-a871-499f-be39-6e15c3a25add';
  clashes integer;
  moved integer;
begin
  if (select count(*) from public.profiles where user_id in (old_id, new_id) and merged_into is null) <> 2 then
    raise exception 'profiles missing or already merged';
  end if;
  -- the same game on both accounts would break unique (game_id, user_id): stop rather than guess
  select count(*) into clashes
  from public.game_results a join public.game_results b on a.game_id = b.game_id
  where a.user_id = old_id and b.user_id = new_id;
  if clashes > 0 then
    raise exception '% games exist on both accounts', clashes;
  end if;

  update public.game_results set user_id = new_id where user_id = old_id;
  get diagnostics moved = row_count;
  raise notice 'game_results moved: %', moved;
  update public.game_players set user_id = new_id where user_id = old_id;
  get diagnostics moved = row_count;
  raise notice 'game_players moved: %', moved;
  update public.client_errors set user_id = new_id where user_id = old_id;

  -- free mwooody on the old account FIRST (the unique index on lower(username) refuses two holders),
  -- then put it on the kept account
  update public.profiles set username = null, username_changed_at = null, merged_into = new_id where user_id = old_id;
  update public.profiles
  set username = 'mwooody',
      username_changed_at = now(),
      first_game_at = least(first_game_at, (select first_game_at from public.profiles where user_id = old_id))
  where user_id = new_id;

  if exists (select 1 from public.game_results where user_id = old_id) then
    raise exception 'results still on the old account';
  end if;
  if (select username from public.profiles where user_id = new_id) is distinct from 'mwooody' then
    raise exception 'username did not end up as mwooody';
  end if;
end $$;

-- what happened
select left(p.user_id::text, 8) as account, p.nickname, p.username, left(p.merged_into::text, 8) as merged_into,
       (select count(*) from public.game_results r where r.user_id = p.user_id) as results,
       (select count(*) from public.game_players g where g.user_id = p.user_id) as seats
from public.profiles p
where p.user_id in ('a1db07a9-09b1-4331-980d-cf03bb2b312a', '5cf99a6d-a871-499f-be39-6e15c3a25add');

commit;
