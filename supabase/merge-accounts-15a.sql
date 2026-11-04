-- حُلّة — hotfix 15a: merge the split accounts. Run once in the Supabase SQL editor.
-- All-or-nothing: any failed check or statement rolls the whole file back.
--   Najd:     f30719cc → 21d836d0 (keeps «نجودي» and nakh2020)
--   Mohammed: a1db07a9 → 5cf99a6d (the one in use now; «محمد ونعم» and mwooody move onto it)
-- Old profile rows stay, marked merged_into. game_feedback and game_events hold seat ids, not account
-- ids, so nothing moves there; client_errors has no rows for these accounts but is moved for safety.

begin;

-- Opaque public id for leaderboard rows (same as hotfix-15a.sql; safe if that already ran).
alter table public.profiles add column if not exists public_id uuid default gen_random_uuid();
update public.profiles set public_id = gen_random_uuid() where public_id is null;
alter table public.profiles alter column public_id set not null;
create unique index if not exists profiles_public_id_idx on public.profiles (public_id);

-- Merged profiles are hidden from every board.
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
  najd_old uuid := 'f30719cc-c2e3-44c2-a46b-f3886a6cb6aa';
  najd_new uuid := '21d836d0-b17e-496a-8139-22209be5a82b';
  moh_old  uuid := 'a1db07a9-09b1-4331-980d-cf03bb2b312a';
  moh_new  uuid := '5cf99a6d-a871-499f-be39-6e15c3a25add';
  pair record;
  clashes integer;
  moved integer;
  old_name citext; old_key text; old_user text; old_changed timestamptz;
begin
  for pair in select * from (values (najd_old, najd_new), (moh_old, moh_new)) as t(old_id, new_id) loop
    -- both accounts must exist, and neither may already be merged
    if (select count(*) from public.profiles where user_id in (pair.old_id, pair.new_id) and merged_into is null) <> 2 then
      raise exception 'profiles missing or already merged: % -> %', pair.old_id, pair.new_id;
    end if;
    -- the same game on both accounts would break unique (game_id, user_id): stop rather than guess
    select count(*) into clashes
    from public.game_results a join public.game_results b on a.game_id = b.game_id
    where a.user_id = pair.old_id and b.user_id = pair.new_id;
    if clashes > 0 then
      raise exception '% games exist on both % and %', clashes, pair.old_id, pair.new_id;
    end if;

    update public.game_results set user_id = pair.new_id where user_id = pair.old_id;
    get diagnostics moved = row_count;
    raise notice 'game_results moved % -> %: %', pair.old_id, pair.new_id, moved;
    update public.game_players set user_id = pair.new_id where user_id = pair.old_id;
    get diagnostics moved = row_count;
    raise notice 'game_players moved: %', moved;
    update public.client_errors set user_id = pair.new_id where user_id = pair.old_id;

    -- Name and username move only when the new account has none. The old username is cleared FIRST:
    -- the unique index on lower(username) would refuse two rows holding it at once.
    select nickname, nickname_key, username, username_changed_at into old_name, old_key, old_user, old_changed
    from public.profiles where user_id = pair.old_id;
    update public.profiles set username = null, username_changed_at = null, merged_into = pair.new_id where user_id = pair.old_id;
    update public.profiles
    set nickname = coalesce(nickname, old_name),
        nickname_key = case when nickname is null then old_key else nickname_key end,
        username_changed_at = case when username is null and old_user is not null then old_changed else username_changed_at end,
        username = coalesce(username, old_user),
        first_game_at = least(first_game_at, (select first_game_at from public.profiles where user_id = pair.old_id))
    where user_id = pair.new_id;
  end loop;

  -- final checks
  if exists (select 1 from public.game_results where user_id in (najd_old, moh_old)) then
    raise exception 'results still on an old account';
  end if;
  if (select username from public.profiles where user_id = moh_new) is distinct from 'mwooody'
     or (select nickname::text from public.profiles where user_id = moh_new) is distinct from 'محمد ونعم'
     or (select username from public.profiles where user_id = najd_new) is distinct from 'nakh2020' then
    raise exception 'names did not end up where expected';
  end if;
end $$;

-- what happened
select left(p.user_id::text, 8) as account, p.nickname, p.username, left(p.merged_into::text, 8) as merged_into,
       (select count(*) from public.game_results r where r.user_id = p.user_id) as results,
       (select count(*) from public.game_players g where g.user_id = p.user_id) as seats
from public.profiles p
where p.user_id in ('f30719cc-c2e3-44c2-a46b-f3886a6cb6aa', '21d836d0-b17e-496a-8139-22209be5a82b',
                    'a1db07a9-09b1-4331-980d-cf03bb2b312a', '5cf99a6d-a871-499f-be39-6e15c3a25add');

commit;
