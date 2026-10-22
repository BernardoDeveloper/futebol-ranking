-- Manipulados — a R$ 2,00 Pix that adds 3 to a player's average rating in a joke list.
-- specs/manipulados/design.md; adr:0002-take-pix-payments-through-abacatepay-edge-functions.
-- Players only read their own rows; the Edge Functions write with the service role.

create table public.manipulations (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired')),
  charge_id text unique,
  br_code text,
  qr_code text,
  expires_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  paid_at timestamptz
);

-- Only once: at most one pending or paid manipulation per player.
create unique index manipulations_one_per_player on public.manipulations (player_id)
  where status <> 'expired';

-- The pending manipulation to pay, or a fresh one. Raises for a non-player and for a
-- player already manipulated. A pending row with no charge was never shown to anyone,
-- so nobody can have paid it: it is dropped rather than reused.

create function public.start_manipulation() returns public.manipulations
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.current_player_id();
  row public.manipulations;
begin
  if me is null then
    raise exception 'not a registered player' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.manipulations m where m.player_id = me and m.status = 'paid') then
    raise exception 'already manipulated' using errcode = 'unique_violation';
  end if;

  update public.manipulations m set status = 'expired'
  where m.player_id = me and m.status = 'pending' and m.expires_at <= now();
  delete from public.manipulations m
  where m.player_id = me and m.status = 'pending' and m.charge_id is null;

  select * into row from public.manipulations m where m.player_id = me and m.status = 'pending';
  if not found then
    insert into public.manipulations (player_id) values (me) returning * into row;
  end if;
  return row;
end
$$;

-- The ranking with 3 added to the average rating of every manipulated player.
-- ranking() is untouched: the official list and "Copiar" never see a manipulation.

create function public.manipulated_ranking()
returns table (player_id uuid, name text, average numeric, manipulated boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name,
         case when m.player_id is null then round(avg(r.value), 1)
              else round(coalesce(avg(r.value), 0) + 3, 1) end as average,
         m.player_id is not null
  from public.players p
  left join public.ratings r on r.rated_id = p.id
  left join public.manipulations m on m.player_id = p.id and m.status = 'paid'
  where public.current_player_id() is not null
  group by p.id, p.name, m.player_id
  order by 3 desc nulls last, p.name
$$;

alter table public.manipulations enable row level security;

create policy manipulations_select on public.manipulations
  for select to authenticated using (player_id = public.current_player_id());

revoke all on public.manipulations from anon, authenticated, public;
grant select on public.manipulations to authenticated;
grant select, insert, update, delete on public.manipulations to service_role;

revoke execute on function public.start_manipulation(), public.manipulated_ranking() from anon, public;
grant execute on function public.start_manipulation(), public.manipulated_ranking() to authenticated;
