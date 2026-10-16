-- Ranking jogadores — schema, account allowlist, row-level security, ranking.
-- specs/ranking-jogadores/design.md; adr:0001-use-supabase-for-auth-and-data.
-- Every rule protecting one player from another lives here: the browser is untrusted.

create table public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0 and name !~ '[\r\n]'),
  email text not null unique check (email = lower(trim(email)) and email like '%_@_%'),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.ratings (
  rater_id uuid not null references public.players (id) on delete cascade,
  rated_id uuid not null references public.players (id) on delete cascade,
  value smallint not null check (value between 1 and 10),
  updated_at timestamptz not null default now(),
  primary key (rater_id, rated_id),
  check (rater_id <> rated_id)
);

create index ratings_rated_id_idx on public.ratings (rated_id);

-- Identity: the session's auth account, once its email is confirmed, mapped to a player
-- by that account's email. The JWT's email claim alone is not trusted.

create function public.current_player_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id
  from auth.users u
  join public.players p on p.email = lower(u.email)
  where u.id = auth.uid() and u.email_confirmed_at is not null
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.is_admin from public.players p where p.id = public.current_player_id()),
    false
  )
$$;

-- Allowlist: no auth account, and so no access code, for an email that is not a player;
-- and no password on any account, so nobody can pre-create a player's account with a
-- password of their own and sign in with it later.

create function public.enforce_player_allowlist() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.players p where p.email = lower(new.email)) then
    raise exception 'email % is not a registered player', new.email
      using errcode = 'insufficient_privilege';
  end if;
  if coalesce(new.encrypted_password, '') <> '' then
    raise exception 'accounts sign in by access code only'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;

create trigger enforce_player_allowlist
  before insert or update of email, encrypted_password on auth.users
  for each row execute function public.enforce_player_allowlist();

-- A player's email is their identity: changing it would let whoever owns the new inbox
-- log in as that player. A wrong email is fixed by removing and registering again.

create function public.keep_player_email() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    raise exception 'a player''s email cannot be changed' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;

create trigger keep_player_email
  before update of email on public.players
  for each row execute function public.keep_player_email();

create function public.touch_rating() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger touch_rating
  before update on public.ratings
  for each row execute function public.touch_rating();

-- Row-level security.

alter table public.players enable row level security;
alter table public.ratings enable row level security;

create policy players_select on public.players
  for select to authenticated using (public.current_player_id() is not null);
create policy players_insert on public.players
  for insert to authenticated with check (public.is_admin());
create policy players_update on public.players
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy players_delete on public.players
  for delete to authenticated using (public.is_admin() and id <> public.current_player_id());

create policy ratings_select on public.ratings
  for select to authenticated using (rater_id = public.current_player_id());
create policy ratings_insert on public.ratings
  for insert to authenticated with check (rater_id = public.current_player_id());
create policy ratings_update on public.ratings
  for update to authenticated
  using (rater_id = public.current_player_id())
  with check (rater_id = public.current_player_id());
create policy ratings_delete on public.ratings
  for delete to authenticated using (rater_id = public.current_player_id());

-- Ranking: the only way averages leave the database; individual ratings never do.

create function public.ranking()
returns table (player_id uuid, name text, average numeric, ratings_count integer)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, round(avg(r.value), 1), count(r.value)::integer
  from public.players p
  left join public.ratings r on r.rated_id = p.id
  where public.current_player_id() is not null
  group by p.id, p.name
  order by round(avg(r.value), 1) desc nulls last, p.name
$$;

-- Grants: authenticated only; anon gets nothing.

revoke all on public.players, public.ratings from anon, public;
revoke execute on function
  public.current_player_id(), public.is_admin(), public.ranking(),
  public.enforce_player_allowlist(), public.touch_rating(), public.keep_player_email()
  from anon, public;
revoke execute on function
  public.enforce_player_allowlist(), public.touch_rating(), public.keep_player_email()
  from authenticated;
grant select, insert, update, delete on public.players, public.ratings to authenticated;
grant execute on function public.current_player_id(), public.is_admin(), public.ranking()
  to authenticated;
