# Manipulados — design

## What changes

Serves R1.1–R1.10, R2.1–R2.4.

A static Pix to the organizer's personal key, confirmed by an admin, per
adr:0003-take-manipulation-pix-on-a-personal-key-confirmed-by-an-admin (which superseded
the AbacatePay design of adr:0002-take-pix-payments-through-abacatepay-edge-functions:
production there needs a CNPJ). No server code: every rule about who may manipulate,
confirm or reject lives in SQL, per adr:0001-use-supabase-for-auth-and-data.

```
supabase/migrations/0002_manipulations.sql   table, RLS, manipulated_ranking() — already run
supabase/migrations/0003_manual_pix.sql      drops the charge columns; start, confirm, reject, pending list
src/pix.ts                                   the static Pix BR Code (EMV fields + CRC16)
src/config.ts                                VITE_PIX_KEY, VITE_PIX_NAME, VITE_PIX_CITY
src/api.ts                                   manipulate, checkManipulation, isManipulated, manipulatedRanking,
                                             pendingManipulations, confirmManipulation, rejectManipulation
src/views/ranking.ts                         "Manipular" on the player's own row, the Pix panel
src/views/manipulated.ts                     the Manipulados tab
src/views/players.ts                         pending manipulations, for admins
```

## Data

```
manipulations  id uuid pk · player_id → players on delete cascade
               status text check in (pending, paid, rejected) default pending
               created_at · paid_at · decided_by → players on delete set null
               unique (player_id) where status <> 'rejected'
```

The partial unique index is the "only once" rule (R1.5, R1.6): a player holds at most
one manipulation that is pending or paid. `decided_by` is the admin who confirmed or
rejected it (R1.4). 0002's `charge_id`, `br_code`, `qr_code` and `expires_at` are
dropped by 0003, and its `expired` status becomes `rejected`.

## Boundaries and contracts

**The Pix (R1.1, R1.2).** `src/pix.ts` builds the BR Code of the Banco Central's static
Pix: payload format, the `br.gov.bcb.pix` account with the key, category `0000`,
currency `986`, amount `2.00`, country, name (≤ 25), city (≤ 15), and the txid in field
62, closed by a CRC16-CCITT over the whole payload. The txid is the manipulation's
code: `MANIP` and the first 8 hex digits of its id, so an admin can match a payment in
a statement that shows it. The key, name and city are build-time variables; the key is
public by nature. Without a key, the button is not shown. The QR image is drawn in the
browser from the same payload.

**Opening (R1.2, R1.5, R1.6).** `start_manipulation()` (`security definer`) raises for
a non-player, raises `already manipulated` when a paid row exists, and returns the
player's pending row or a fresh one. Nothing is charged: the row only waits.

**Deciding (R1.4, R1.7, R1.8).** `confirm_manipulation(id)` and
`reject_manipulation(id)` are `security definer`, raise unless `is_admin()`, and move
only a `pending` row, to `paid` (with `paid_at`) or `rejected`, recording
`decided_by = current_player_id()`. `pending_manipulations()` returns `id, player name,
created_at` of every pending row to an admin, and nothing to anyone else.

**Row-level security (R1.8).** `authenticated` may select only rows where
`player_id = current_player_id()` and has no insert, update or delete; every write goes
through the three functions. `anon` gets nothing.

**Waiting (R1.3, R1.9).** While the Pix panel is on screen the app re-reads the
player's own row every 10 s; it shows "Manipulado" once an admin confirmed, and offers
a new Pix once one was rejected.

**Manipulated ranking (R2.1–R2.4).** `manipulated_ranking()` (from 0002) returns
`player_id, name, average, manipulated`, where `average` is
`round(coalesce(avg(rating), 0) + 3, 1)` for a manipulated player and the official
average otherwise. `ranking()` is untouched, so the official list and "Copiar" are
unchanged (R2.4).

## Risks

- Payment is on trust: an admin could confirm without a payment, and a player could
  claim one. Accepted for R$ 2 of banter; `decided_by` records who confirmed.
- Not every bank shows the txid of a static Pix in the receiver's statement; the admin
  then matches by the payer's name and the amount.
