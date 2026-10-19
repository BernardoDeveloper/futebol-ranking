# Ranking jogadores — tasks

## 1 · Project and database

- [x] 1.1 (Unit) Scaffold Vite, TypeScript, Vitest, ESLint and a PGlite test harness that stubs Supabase's auth schema — R5.1
- [x] 1.2 (TDD) Write the migration: tables, constraints, auth.users allowlist trigger, RLS policies, ranking function, proven by PGlite tests — R1.3, R1.5, R2.2, R2.3, R2.4, R3.1, R3.2, R3.3, R3.4, R3.5, R4.1
  _Depends 1.1_

## 2 · App

- [x] 2.1 (Unit) Build the login email from typed input and the configured domain — R1.4
  _Depends 1.1_
- [x] 2.2 (Unit) Format average ratings and the "Copiar" text, and copy with a manual fallback — R4.1, R4.2, R4.3
  _Depends 1.1_
- [x] 2.3 (Unit) Build the API layer and the login view: request access code, verify it, sign out — R1.1, R1.2, R1.6
  _Depends 2.1_
- [x] 2.4 (Unit) Build the ranking, ratings and players views — R2.1, R2.2, R3.1, R4.1, R4.2, R4.3
  _Depends 1.2, 2.2, 2.3_

## 3 · Delivery

- [x] 3.1 (Unit) Add the GitHub Pages workflow and the README setup steps — R5.1, R5.2
  _Depends 2.4_

## 4 · Review fixes

- [x] 4.1 (TDD) Key identity on the confirmed auth account, reject password accounts, make player email immutable, stop admins removing themselves — R1.5, R1.7, R2.5, R2.6
  _Reason security review findings_
- [x] 4.2 (Unit) Render the app only when the session email changes, map only database errors to "not registered", state the unrated copy line — R1.1, R1.2, R4.2
  _Reason code review findings_

## 5 · Clearing a rating

- [x] 5.1 (Unit) Prove in PGlite that a player can delete their own rating and the ranking stops counting it — R3.6
  _Reason new requirement: clear a rating_
- [x] 5.2 (Unit) Add clearRating to the API and let the ratings view clear a rating with the empty option — R3.6
  _Depends 5.1_
  _Reason new requirement: clear a rating_

## 6 · Selecting players for the game

- [x] 6.1 (Unit) Add a checkbox per player and a check-all checkbox to the ranking, copy only the selected players, and disable "Copiar" while none is selected — R4.2, R4.4, R4.5
  _Reason new requirement: select who is at the game_
