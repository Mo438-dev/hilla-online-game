create table if not exists public.hilla_rooms (
  code text primary key,
  host_id text not null,
  per_player integer not null,
  max_players integer not null,
  started boolean not null default false,
  lobby jsonb not null default '[]'::jsonb,
  game jsonb,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_hilla_room_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_hilla_room_updated_at on public.hilla_rooms;
create trigger set_hilla_room_updated_at
before update on public.hilla_rooms
for each row
execute function public.set_hilla_room_updated_at();

alter table public.hilla_rooms enable row level security;

drop policy if exists "service role can manage hilla rooms" on public.hilla_rooms;
create policy "service role can manage hilla rooms"
on public.hilla_rooms
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create index if not exists hilla_rooms_expires_at_idx on public.hilla_rooms (expires_at);
