# Stack

Every adopted technology, with one line on why. Technology not listed here is an open
decision, never something adopted silently.

## Runtime

- **@supabase/supabase-js** — client for Supabase email-OTP auth and Postgres, the whole backend (adr:0001-use-supabase-for-auth-and-data).
- **GitHub Pages** — free static hosting; the build output is plain files.

## Development

- **vite** — dev server and static build for GitHub Pages.
- **typescript** — type checking; held below 6.1 because typescript-eslint does not support 7 yet.
- **vitest** — unit tests, sharing Vite's config.
- **@electric-sql/pglite** — real Postgres in-process, so the RLS policies are tested without Docker.
- **@types/node** — types for the Node APIs the database tests use to read the migration.
- **eslint**, **@eslint/js**, **typescript-eslint**, **globals** — the lint layer: unused code, floating promises, unsafe types.
