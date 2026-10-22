# Stack

Every adopted technology, with one line on why. Technology not listed here is an open
decision, never something adopted silently.

## Runtime

- **@supabase/supabase-js** — client for Supabase email-OTP auth and Postgres, the whole backend (adr:0001-use-supabase-for-auth-and-data).
- **GitHub Pages** — free static hosting; the build output is plain files.
- **qrcode-generator** — draws the Manipulados Pix QR code in the browser as an image data URL; no dependencies, no canvas (adr:0003-take-manipulation-pix-on-a-personal-key-confirmed-by-an-admin).
- **Supabase Edge Functions** (Deno) — the only server code: they hold the AbacatePay API key the browser must never see (adr:0002-take-pix-payments-through-abacatepay-edge-functions).
- **AbacatePay** — Pix charges for the Manipulados joke list, with a Dev Mode for simulated payments (adr:0002-take-pix-payments-through-abacatepay-edge-functions).

## Development

- **vite** — dev server and static build for GitHub Pages.
- **typescript** — type checking; held below 6.1 because typescript-eslint does not support 7 yet.
- **vitest** — unit tests, sharing Vite's config.
- **@electric-sql/pglite** — real Postgres in-process, so the RLS policies are tested without Docker.
- **happy-dom** — a DOM for testing the views in Vitest without a browser.
- **@types/node** — types for the Node APIs the database tests use to read the migration.
- **eslint**, **@eslint/js**, **typescript-eslint**, **globals** — the lint layer: unused code, floating promises, unsafe types.
