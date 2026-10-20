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
- **happy-dom** — a DOM for testing the views in Vitest without a browser.
- **@types/node** — types for the Node APIs the database tests use to read the migration.
- **playwright-core** — drives the installed Chrome through WhatsApp Web for the court booking command; the `-core` package downloads no browser.
- **tsx** — runs the TypeScript court booking command directly; distro builds of Node 22 ship without type stripping.
- **eslint**, **@eslint/js**, **typescript-eslint**, **globals** — the lint layer: unused code, floating promises, unsafe types.
