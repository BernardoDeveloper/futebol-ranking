# Ranking jogadores — tasks

## 1 · Project and database

- [x] 1.1 (Unit) Scaffold Vite, TypeScript, Vitest, ESLint and a PGlite test harness that stubs Supabase's auth schema — R5.1
- [ ] 1.2 (TDD) Write the migration: tables, constraints, auth.users allowlist trigger, RLS policies, ranking function, proven by PGlite tests — R1.3, R1.5, R2.2, R2.3, R2.4, R3.1, R3.2, R3.3, R3.4, R3.5, R4.1
  _Depends 1.1_

## 2 · App

- [ ] 2.1 (Unit) Build the login email from typed input and the configured domain — R1.4
  _Depends 1.1_
- [ ] 2.2 (Unit) Format average ratings and the "Copiar" text, and copy with a manual fallback — R4.1, R4.2, R4.3
  _Depends 1.1_
- [ ] 2.3 (Unit) Build the API layer and the login view: request access code, verify it, sign out — R1.1, R1.2, R1.6
  _Depends 2.1_
- [ ] 2.4 (Unit) Build the ranking, ratings and players views — R2.1, R2.2, R3.1, R4.1, R4.2, R4.3
  _Depends 1.2, 2.2, 2.3_

## 3 · Delivery

- [ ] 3.1 (Unit) Add the GitHub Pages workflow and the README setup steps — R5.1, R5.2
  _Depends 2.4_
