# Manipulados — tasks

## 1 · Database

- [x] 1.1 (TDD) Write migration 0002: manipulations table, RLS, start_manipulation(), manipulated_ranking(), and run every migration in the PGlite harness — R1.5, R1.6, R1.8, R2.1, R2.2, R2.4

## 2 · Edge Functions

- [x] 2.1 (Unit) Write the AbacatePay client: create a R$ 2,00 Pix and check a charge's status — R1.2, R1.4
- [x] 2.2 (TDD) Write the manipulation flow: start, check the player's own charge, reconcile every pending charge — R1.2, R1.4, R1.5, R1.6
  _Depends 1.1, 2.1_
- [x] 2.3 (Unit) Write the HTTP helpers and the manipular and abacatepay-webhook functions, rejecting a webhook without the secret — R1.2, R1.3, R1.7
  _Depends 2.2_

## 3 · App

- [x] 3.1 (Unit) Add manipulate, checkManipulation, isManipulated and manipulatedRanking to the API — R1.2, R1.3, R1.9, R2.1
  _Depends 1.1_
- [x] 3.2 (Unit) Show "Manipular" on the player's own ranking row, the Pix panel with polling, and "Manipulado" once paid — R1.1, R1.2, R1.3, R1.9
  _Depends 3.1_
- [x] 3.3 (Unit) Add the Manipulados tab with the manipulated ranking and a mark on manipulated players — R2.1, R2.3
  _Depends 3.1_

## 4 · Docs

- [x] 4.1 (Unit) Record AbacatePay and Edge Functions in the stack, the new terms in the glossary, and the deploy steps in the README — R1.4, R1.7

## 5 · Static Pix confirmed by an admin

AbacatePay needs a CNPJ in production; adr:0003-take-manipulation-pix-on-a-personal-key-confirmed-by-an-admin replaces it.

- [x] 5.1 (TDD) Write migration 0003: drop the charge columns, start a manipulation without a charge, let admins confirm, reject and list pending manipulations — R1.4, R1.5, R1.6, R1.7, R1.8
  _Reason AbacatePay needs a CNPJ; replaced by a static Pix confirmed by an admin_
- [x] 5.2 (TDD) Build the static Pix copy-and-paste code for R$ 2,00 with its CRC — R1.2
  _Reason AbacatePay needs a CNPJ; replaced by a static Pix confirmed by an admin_
- [ ] 5.3 (Unit) Read the Pix key, name and city from the config and draw the Pix QR code — R1.1, R1.2
  _Depends 5.2_
  _Reason AbacatePay needs a CNPJ; replaced by a static Pix confirmed by an admin_
- [ ] 5.4 (Unit) Open, check, confirm, reject and list manipulations through the API — R1.2, R1.3, R1.4, R1.7, R1.10
  _Depends 5.1_
  _Reason AbacatePay needs a CNPJ; replaced by a static Pix confirmed by an admin_
- [ ] 5.5 (Unit) Show the static Pix panel awaiting the admin on the ranking — R1.1, R1.2, R1.3, R1.9
  _Depends 5.3, 5.4_
  _Reason AbacatePay needs a CNPJ; replaced by a static Pix confirmed by an admin_
- [ ] 5.6 (Unit) List pending manipulations with confirm and reject in the Jogadores tab — R1.10
  _Depends 5.4_
  _Reason AbacatePay needs a CNPJ; replaced by a static Pix confirmed by an admin_
- [ ] 5.7 (Unit) Remove the Edge Functions and AbacatePay, and update the stack, glossary, README and CI variables — R1.1
  _Depends 5.5, 5.6_
  _Reason AbacatePay needs a CNPJ; replaced by a static Pix confirmed by an admin_
