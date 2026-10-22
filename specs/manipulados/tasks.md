# Manipulados — tasks

## 1 · Database

- [x] 1.1 (TDD) Write migration 0002: manipulations table, RLS, start_manipulation(), manipulated_ranking(), and run every migration in the PGlite harness — R1.5, R1.6, R1.8, R2.1, R2.2, R2.4

## 2 · Edge Functions

- [x] 2.1 (Unit) Write the AbacatePay client: create a R$ 2,00 Pix and check a charge's status — R1.2, R1.4
- [x] 2.2 (TDD) Write the manipulation flow: start, check the player's own charge, reconcile every pending charge — R1.2, R1.4, R1.5, R1.6
  _Depends 1.1, 2.1_
- [ ] 2.3 (Unit) Write the HTTP helpers and the manipular and abacatepay-webhook functions, rejecting a webhook without the secret — R1.2, R1.3, R1.7
  _Depends 2.2_

## 3 · App

- [ ] 3.1 (Unit) Add manipulate, checkManipulation, myManipulation and manipulatedRanking to the API — R1.2, R1.3, R1.9, R2.1
  _Depends 1.1_
- [ ] 3.2 (Unit) Show "Manipular" on the player's own ranking row, the Pix panel with polling, and "Manipulado" once paid — R1.1, R1.2, R1.3, R1.9
  _Depends 3.1_
- [ ] 3.3 (Unit) Add the Manipulados tab with the manipulated ranking and a mark on manipulated players — R2.1, R2.3
  _Depends 3.1_

## 4 · Docs

- [ ] 4.1 (Unit) Record AbacatePay and Edge Functions in the stack, the new terms in the glossary, and the deploy steps in the README — R1.4, R1.7
