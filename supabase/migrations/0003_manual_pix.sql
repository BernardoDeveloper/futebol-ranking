-- Manipulados without a payment gateway: a static Pix to the organizer's key, confirmed
-- by an admin. specs/manipulados/design.md;
-- adr:0003-take-manipulation-pix-on-a-personal-key-confirmed-by-an-admin.
-- 0002 has already run, so this migration changes it rather than editing it.

alter table public.manipulations
  drop column charge_id,
  drop column br_code,
  drop column qr_code,
  drop column expires_at,
  add column decided_by uuid references public.players (id) on delete set null;

alter table public.manipulations drop constraint manipulations_status_check;
update public.manipulations set status = 'rejected' where status = 'expired';
alter table public.manipulations
  add constraint manipulations_status_check check (status in ('pending', 'paid', 'rejected'));

-- Only once: at most one pending or paid manipulation per player.
drop index public.manipulations_one_per_player;
create unique index manipulations_one_per_player on public.manipulations (player_id)
  where status <> 'rejected';

-- The player's pending manipulation, or a fresh one. Raises for a non-player and for a
-- player already manipulated.

create or replace function public.start_manipulation() returns public.manipulations
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
  select * into row from public.manipulations m where m.player_id = me and m.status = 'pending';
  if not found then
    insert into public.manipulations (player_id) values (me) returning * into row;
  end if;
  return row;
end
$$;

-- An admin, having seen the Pix arrive (or not), moves a pending manipulation to paid or
-- rejected. Only pending ones move, and the deciding admin is recorded.

create function public.decide_manipulation(manipulation_id uuid, outcome text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'only admins confirm or reject manipulations' using errcode = 'insufficient_privilege';
  end if;
  update public.manipulations m
  set status = outcome,
      paid_at = case when outcome = 'paid' then now() end,
      decided_by = public.current_player_id()
  where m.id = manipulation_id and m.status = 'pending';
  if not found then
    raise exception 'manipulation % is not pending', manipulation_id using errcode = 'no_data_found';
  end if;
end
$$;

create function public.confirm_manipulation(manipulation_id uuid) returns void
language sql security definer set search_path = '' as $$
  select public.decide_manipulation(manipulation_id, 'paid')
$$;

create function public.reject_manipulation(manipulation_id uuid) returns void
language sql security definer set search_path = '' as $$
  select public.decide_manipulation(manipulation_id, 'rejected')
$$;

-- What an admin checks against their bank statement; nothing for anyone else.

create function public.pending_manipulations()
returns table (id uuid, name text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.id, p.name, m.created_at
  from public.manipulations m
  join public.players p on p.id = m.player_id
  where m.status = 'pending' and public.is_admin()
  order by m.created_at
$$;

-- No server writes manipulations any more.
revoke insert, update, delete on public.manipulations from service_role;

revoke execute on function
  public.decide_manipulation(uuid, text), public.confirm_manipulation(uuid),
  public.reject_manipulation(uuid), public.pending_manipulations()
  from anon, public;
-- decide_manipulation takes any outcome, so it is reachable only through the two wrappers.
revoke execute on function public.decide_manipulation(uuid, text) from authenticated;
grant execute on function
  public.confirm_manipulation(uuid), public.reject_manipulation(uuid), public.pending_manipulations()
  to authenticated;
