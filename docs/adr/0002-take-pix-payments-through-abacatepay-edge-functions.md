---
status: superseded
superseded-by: 0003-take-manipulation-pix-on-a-personal-key-confirmed-by-an-admin
---

# 0002 · Take Pix payments through AbacatePay, behind Supabase Edge Functions

## Context

The "Manipulados" joke list charges a player R$ 2,00 by Pix. Creating a charge and
confirming it need a payment provider's secret API key, and the site is static files
on GitHub Pages: nothing in the browser can hold a secret
(adr:0001-use-supabase-for-auth-and-data). The team asked for AbacatePay, which offers
Pix by API with a Dev Mode for simulated payments and webhooks for confirmations.

Considered for the server side: Supabase Edge Functions, and a separate Cloudflare
Worker. A Worker means a second platform, second secrets store and second deploy,
for two small endpoints.

## Decision

Use AbacatePay's transparent Pix checkout, called only from two Supabase Edge
Functions holding the API key and the webhook secret as function secrets. A payment
counts only once AbacatePay's API, asked with that key, reports the charge `PAID`; a
webhook call is a prompt to ask, never proof. Who may pay and the state of a payment
stay in Postgres, guarded by the same row-level security as everything else.

## Consequences

- The project now has server code, in Deno, which CI cannot type-check or run; the
  testable flow lives in plain TypeScript under `supabase/functions/_shared/`.
- Deploying needs the Supabase CLI (`supabase functions deploy`) and two secrets.
- The money goes to the AbacatePay account whose key is configured; AbacatePay's fee
  applies to each charge.
- Leaving AbacatePay means replacing `_shared/abacatepay.ts` and the webhook; the
  table and SQL do not depend on the provider beyond a `charge_id`.
