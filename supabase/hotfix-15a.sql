-- حُلّة — hotfix 15a: an opaque public id per profile, for head-to-head links from the leaderboard.
-- Leaderboard rows never carry user_id. Safe to re-run. All-or-nothing.
begin;
alter table public.profiles add column if not exists public_id uuid default gen_random_uuid();
update public.profiles set public_id = gen_random_uuid() where public_id is null;
alter table public.profiles alter column public_id set not null;
create unique index if not exists profiles_public_id_idx on public.profiles (public_id);
commit;
