---
status: accepted
---

# 0003 · Take the manipulation Pix on a personal key, confirmed by an admin

## Context

adr:0002-take-pix-payments-through-abacatepay-edge-functions chose AbacatePay behind
Supabase Edge Functions. It worked in Dev Mode, but AbacatePay's production accounts
require a CNPJ, and the team's organizer has none. Considered:

- another gateway that accepts a personal (CPF) account, keeping automatic confirmation,
  at a fee per Pix and a second provider sign-up;
- opening a MEI to get a CNPJ, at a monthly tax and fiscal obligations for a R$ 2 joke;
- a static Pix to the organizer's own key, with an admin confirming each payment by hand.

## Decision

Take the R$ 2,00 on the organizer's personal Pix key with a static Pix (BR Code) built
in the browser from the key, name and city in the build configuration, carrying the
manipulation's code as its txid. Nothing confirms the payment automatically: an admin
who sees it arrive marks the manipulation paid in the app, or rejects it. Who may
confirm stays in Postgres, as every other rule (adr:0001-use-supabase-for-auth-and-data).
The Edge Functions and AbacatePay are removed.

## Consequences

- No gateway, no fee, no server code, no secrets: the Pix key is public by nature.
- A manipulation shows only after an admin checks their bank statement; trust in the
  admin is the control, and the database records which admin decided.
- Moving to automatic confirmation later means a gateway again, as in adr:0002; the
  table keeps the pending/paid shape that design used.
