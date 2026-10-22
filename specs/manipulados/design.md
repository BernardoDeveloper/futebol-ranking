# Manipulados — design

## What changes

Serves R1.1–R1.9, R2.1–R2.4.

The first server-side code in the project: the AbacatePay API key is a secret and
cannot reach the browser, so two Supabase Edge Functions hold it, per
adr:0002-take-pix-payments-through-abacatepay-edge-functions. Every rule about who may
manipulate, and when, still lives in SQL, per adr:0001-use-supabase-for-auth-and-data.

```
supabase/migrations/0002_manipulations.sql   table, RLS, start_manipulation(), manipulated_ranking()
supabase/functions/_shared/abacatepay.ts     createPix, checkPix: the two AbacatePay calls
supabase/functions/_shared/manipulation.ts   start, check, reconcile: the flow, over a store and a gateway
supabase/functions/_shared/http.ts           CORS, JSON replies, constant-time secret compare
supabase/functions/manipular/index.ts        POST {action: "start" | "check"}, called by the app with the player's JWT
supabase/functions/abacatepay-webhook/index.ts  AbacatePay's webhook; no JWT, checked by ?webhookSecret=
src/api.ts                                   manipulate, checkManipulation, myManipulation, manipulatedRanking
src/views/ranking.ts                         "Manipular" on the player's own row, the Pix panel, polling
src/views/manipulated.ts                     the Manipulados tab
```

`_shared/` is plain TypeScript with no Deno or npm imports, so Vitest tests it in Node;
the two `index.ts` files are thin Deno glue (`Deno.serve`, `npm:@supabase/supabase-js`)
and are excluded from `tsc` and ESLint.

## Data

```
manipulations  id uuid pk · player_id → players on delete cascade
               status text check in (pending, paid, expired) default pending
               charge_id text unique · br_code text · qr_code text · expires_at timestamptz
               created_at · paid_at
               unique (player_id) where status <> 'expired'
```

The partial unique index is the "only once" rule (R1.5, R1.6): a player holds at most
one manipulation that is pending or paid. `id` is sent to AbacatePay as `externalId`.

## Boundaries and contracts

**Starting (R1.2, R1.5, R1.6).** `manipular` with `start` calls
`start_manipulation()` as the player (their JWT). That `security definer` function
raises for a non-player, raises `already manipulated` when a paid row exists, expires
the player's pending row whose `expires_at` has passed, drops a pending row with no
charge (one the function crashed before attaching, never shown, so never payable), and
returns the pending row or a fresh one. When the row has no charge yet, the function
creates the Pix (`amount: 200`, `expiresIn: 1800`) and attaches `charge_id`, `br_code`,
`qr_code`, `expires_at` with the service-role client. The amount is a server
constant; nothing the browser sends reaches it.

**Confirming (R1.3, R1.4, R1.7).** AbacatePay's event payload is not the source of
truth, its API is. Both paths call `GET /transparents/check?id=<charge_id>` with the
API key and mark the row paid only on `PAID`, expired on `EXPIRED` or `CANCELLED`:
- `manipular` with `check` reconciles the caller's own pending row; the app polls it
  every 3 s while the Pix panel is open.
- `abacatepay-webhook` compares `?webhookSecret=` to `ABACATEPAY_WEBHOOK_SECRET` in
  constant time, answers 401 on mismatch, and otherwise reconciles every pending row
  with a charge. It ignores the body, so a duplicate or replayed event is harmless,
  and it covers the player who closed the tab after paying.

The status update is `where status = 'pending'`, so reconciling twice is a no-op.

**Row-level security (R1.8).** `authenticated` may select only rows where
`player_id = current_player_id()` and has no insert, update or delete; writes go
through `start_manipulation()` or the service role. `anon` gets nothing.

**Manipulated ranking (R2.1–R2.4).** `manipulated_ranking()` is `security definer`,
empty for a non-player, returning `player_id, name, average, manipulated`, where
`average` is `round(coalesce(avg(rating), 0) + 3, 1)` for a manipulated player and the
official average otherwise, ordered desc nulls last, then name. `ranking()` is
untouched, so the official list and "Copiar" are unchanged (R2.4).

**Secrets.** `ABACATEPAY_API_KEY` and `ABACATEPAY_WEBHOOK_SECRET` are Supabase function
secrets; `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are
provided by the platform. A Dev Mode key gives simulated payments; switching to real
money is swapping the key and re-registering the webhook in production.

## Risks

- AbacatePay's per-event payload is not documented where we could read it; ignoring
  the body and asking the API sidesteps that, at one extra HTTPS call per pending row.
- The webhook secret travels in the URL, as AbacatePay designs it; it can show up in
  Supabase's request logs. It only lets someone trigger a reconcile, which changes
  nothing AbacatePay's API does not confirm.
- The Edge Function glue (`index.ts`) is not type-checked or tested in CI: no Deno
  there. It is kept to request parsing and wiring for that reason.
