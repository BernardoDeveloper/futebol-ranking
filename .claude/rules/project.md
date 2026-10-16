# This project

Static SPA (Vite + TypeScript) on GitHub Pages; Supabase is the whole backend
(see docs/adr/0001-use-supabase-for-auth-and-data.md).

## Commands

```bash
# Build
npm run build

# Test — the whole suite
npm test

# Test — one file (used after every task; scope, not suite)
npx vitest run tests/<file>.test.ts

# Lint — ESLint (strict type-checked) plus tsc
npm run lint

# Format / format check
# none adopted
```

## Conventions

- **Branch names:** `feat/<slug>`, `fix/<slug>`
- **Commits:** Conventional Commits
- **Anything a new contributor gets wrong on their first try:** authorization lives in
  `supabase/migrations/`, never in the browser. A rule enforced only in `src/` is not
  enforced. Prove a policy change in `tests/db/`.

## Boundaries

- `supabase/migrations/*.sql` that have already been run on the Supabase project are
  never edited; add a new numbered migration instead.
