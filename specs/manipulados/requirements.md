---
autonomy: auto
ci: wait
---

# Manipulados — requirements

## Purpose

A joke list, for the banter only. A player may pay a R$ 2,00 Pix to the organizer's
personal Pix key to appear 3 points higher in a separate "Manipulados" list built from
the official ranking, once an admin confirms the payment. The official ranking, its
average ratings and "Copiar" never change.

## R1 · Paying for a manipulation

- **R1.1** Where a Pix key is configured, the app shall show a "Manipular" button on the authenticated player's own row of the ranking, and on no other player's row.
- **R1.2** When the player presses "Manipular", the backend shall open a pending manipulation for that player, and the app shall show a static Pix of R$ 2,00 to the configured key as a QR code and a copy-and-paste code, carrying the manipulation's code.
- **R1.3** While the player's manipulation is pending, the app shall tell the player it awaits an admin's confirmation and, once it is confirmed, tell the player they are manipulated.
- **R1.4** When an admin confirms a pending manipulation, the backend shall mark it paid and record which admin confirmed it.
- **R1.5** If a player who already has a paid manipulation asks for another one, then the backend shall refuse it.
- **R1.6** While the player has a pending manipulation, the backend shall return that same manipulation instead of opening a new one.
- **R1.7** When an admin rejects a pending manipulation, the backend shall mark it rejected, so the player may open a new one.
- **R1.8** If anyone but an admin attempts to confirm or reject a manipulation, then the backend shall reject the operation; a player may only open and read their own manipulation.
- **R1.9** While the player has a paid manipulation, the app shall show "Manipulado" in place of the "Manipular" button.
- **R1.10** While the authenticated player is an admin, the app shall list the pending manipulations with each player's name and manipulation code, offering to confirm or reject each.

## R2 · The Manipulados list

- **R2.1** The app shall show a "Manipulados" tab listing every player in ranking order by manipulated rating: the average rating, plus 3 for a player with a paid manipulation, rounded to one decimal.
- **R2.2** If a manipulated player has no rating, then the backend shall give them a manipulated rating of 3.
- **R2.3** The app shall mark each manipulated player in the Manipulados list.
- **R2.4** The backend shall leave the ranking and the "Copiar" text unaffected by manipulations.

## Out of scope

- Confirming payments automatically: there is no payment gateway (adr:0003-take-manipulation-pix-on-a-personal-key-confirmed-by-an-admin).
- Refunds, and paying for someone else.
- More than one manipulation per player: the bonus is +3, once.
