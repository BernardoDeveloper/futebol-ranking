# Ranking jogadores — design

## What changes

Serves R1.1–R1.6, R2.1–R2.4, R3.1–R3.5, R4.1–R4.3, R5.1, R5.2.

A new static single-page app (Vite + TypeScript, no UI framework) talking directly to
Supabase, per adr:0001-use-supabase-for-auth-and-data. Every rule that protects one
player from another is enforced in Postgres, never in the browser: the browser is
untrusted and holds only the public anon key.

```
src/
  config.ts        reads VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_ALLOWED_EMAIL_DOMAIN
  email.ts         turns what was typed into the login email (R1.4)
  ranking.ts       average formatting and the "Copiar" text (R4.1, R4.2)
  clipboard.ts     copy with a manual fallback (R4.3)
  api.ts           thin supabase-js calls, one per operation
  main.ts, views/  login, ranking, ratings, players (admin)
supabase/migrations/0001_init.sql   schema, trigger, policies, ranking function
tests/             vitest; tests/db/ runs the migration in PGlite
.github/workflows/deploy.yml        test, lint, build, publish to Pages (R5.2)
```

`vite.config.ts` sets `base: './'` so the build works under the repository's Pages
sub-path without knowing the repository name.

## Data

```
players  id uuid pk · name text · email text unique, lower-case · is_admin bool · created_at
ratings  rater_id → players on delete cascade · rated_id → players on delete cascade
         value smallint check 1..10 · updated_at
         pk (rater_id, rated_id) · check rater_id <> rated_id
```

The pair primary key makes "rate again" an upsert that replaces (R3.2); the check
constraints carry R3.1's range and R3.4. Cascades carry R2.2. `unique(email)` carries
R2.4.

## Boundaries and contracts

The session's identity is the email claim in the Supabase JWT, read as
`auth.jwt() ->> 'email'`. Two `security definer` helpers map it to a player:
`current_player_id()` and `is_admin()`. Everything below keys on them.

- **Allowlist (R1.3).** A `before insert` trigger on `auth.users` raises unless the
  new email belongs to a player, so an unknown address never gets an account and the
  access code is never sent.
- **Row-level security (R1.5, R2.3, R3.3, R3.5).**
  - `players`: select when `current_player_id() is not null`; insert, update, delete
    only when `is_admin()`.
  - `ratings`: select, insert, update, delete only where `rater_id = current_player_id()`.
    Nobody, admins included, can read another player's individual ratings.
- **Ranking (R4.1).** `ranking()` is a `security definer` function returning
  `player_id, name, average, ratings_count`, already ordered (average desc nulls last,
  then name), and empty when `current_player_id()` is null. It is the only way
  averages leave the database, so individual ratings stay private.
- `anon` gets no grants on any table or function.

**Bootstrap.** The first admin is inserted by hand in the Supabase SQL editor; the
README says how. After that, admins register everyone else from the app.

**Access code email.** Supabase's default email template sends a link. The "Magic
Link" template must contain `{{ .Token }}` so the email carries the six-digit code
that `verifyOtp({ email, token, type: 'email' })` checks (R1.2).

## Risks

- Supabase's built-in mailer allows only a few emails per hour; a whole team logging in
  before a game will hit it. Configuring custom SMTP is a deployment step in the README.
- The policies cannot be exercised against real Supabase in CI. The PGlite tests stub
  `auth.jwt()` and `auth.users` the way Supabase defines them; a drift in Supabase's
  `auth` schema would not be caught.
