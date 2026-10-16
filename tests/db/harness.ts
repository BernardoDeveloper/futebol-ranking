import { readFileSync } from 'node:fs';
import { PGlite, type Transaction } from '@electric-sql/pglite';

const MIGRATION = new URL('../../supabase/migrations/0001_init.sql', import.meta.url);

// The slice of Supabase's platform the migration relies on, defined the way Supabase
// defines it: roles, the auth schema with the auth.users columns the migration reads,
// auth.jwt()/auth.uid() reading the request's claims, and the default grants Supabase
// gives anon and authenticated on new objects in public.
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    encrypted_password text,
    email_confirmed_at timestamptz
  );
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(auth.jwt() ->> 'sub', '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
`;

export async function freshDatabase({ migrate = true } = {}): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  if (migrate) await db.exec(readFileSync(MIGRATION, 'utf8'));
  return db;
}

type Session = { role: 'anon' } | { role: 'authenticated'; email: string; confirmed: boolean };

// The auth account a session belongs to, created on first use. Triggers are bypassed so
// a test can hold an account the allowlist would refuse today, such as a removed player's.
async function accountId(tx: Transaction, email: string, confirmed: boolean): Promise<string> {
  const found = await tx.query<{ id: string }>(`select id from auth.users where email = $1`, [email]);
  if (found.rows[0]) return found.rows[0].id;
  await tx.exec(`set local session_replication_role = replica`);
  const created = await tx.query<{ id: string }>(
    `insert into auth.users (email, email_confirmed_at) values ($1, case when $2 then now() end) returning id`,
    [email, confirmed],
  );
  await tx.exec(`set local session_replication_role = origin`);
  const id = created.rows[0]?.id;
  if (!id) throw new Error('account not created');
  return id;
}

// Runs fn as Supabase's PostgREST would for a request carrying this session.
export async function as<T>(
  db: PGlite,
  session: Session,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const claims =
      session.role === 'anon'
        ? {}
        : { role: session.role, email: session.email, sub: await accountId(tx, session.email, session.confirmed) };
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    await tx.exec(`set local role ${session.role}`);
    return fn(tx);
  });
}

export const player = (email: string): Session => ({ role: 'authenticated', email, confirmed: true });
export const unconfirmed = (email: string): Session => ({ role: 'authenticated', email, confirmed: false });
export const anon: Session = { role: 'anon' };
