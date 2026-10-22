---
autonomy: auto
ci: wait
---

# Manipulados — requirements

## Purpose

A joke list, for the banter only. A player may pay a R$ 2,00 Pix through AbacatePay to
appear 3 points higher in a separate "Manipulados" list built from the official
ranking. The official ranking, its average ratings and "Copiar" never change.

## R1 · Paying for a manipulation

- **R1.1** The app shall show a "Manipular" button on the authenticated player's own row of the ranking, and on no other player's row.
- **R1.2** When the player presses "Manipular", the backend shall create an AbacatePay Pix charge of R$ 2,00 for that player, and the app shall show its QR code and its copy-and-paste code.
- **R1.3** While the player's manipulation is pending, the app shall check the payment every few seconds and, once it is paid, tell the player they are manipulated.
- **R1.4** When AbacatePay reports a payment, the backend shall mark the manipulation paid only after AbacatePay's API, called with the secret API key, confirms the charge is `PAID`.
- **R1.5** If a player who already has a paid manipulation asks for another one, then the backend shall refuse it and create no charge.
- **R1.6** While the player has a pending manipulation whose charge has not expired, the backend shall return that same charge instead of creating a new one.
- **R1.7** If a webhook call does not carry the configured webhook secret, then the backend shall reject it and change nothing.
- **R1.8** The backend shall let no one but the backend itself create, change, or mark paid a manipulation; a player may read only their own.
- **R1.9** While the player has a paid manipulation, the app shall show "Manipulado" in place of the "Manipular" button.

## R2 · The Manipulados list

- **R2.1** The app shall show a "Manipulados" tab listing every player in ranking order by manipulated rating: the average rating, plus 3 for a player with a paid manipulation, rounded to one decimal.
- **R2.2** If a manipulated player has no rating, then the backend shall give them a manipulated rating of 3.
- **R2.3** The app shall mark each manipulated player in the Manipulados list.
- **R2.4** The backend shall leave the ranking and the "Copiar" text unaffected by manipulations.

## Out of scope

- Refunds, disputes, and paying for someone else.
- Card or boleto payments.
- More than one manipulation per player: the bonus is +3, once.
