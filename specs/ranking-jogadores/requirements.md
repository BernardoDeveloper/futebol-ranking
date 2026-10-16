---
autonomy: auto
ci: no-wait
---

# Ranking jogadores — requirements

## Purpose

The company team plays football about once a month. This app lets an admin register
the players, lets every player give every other player a rating, and turns those
ratings into a ranking that can be copied and pasted into a team-balancing tool.
Access is by a one-time code sent to the player's company email, so nobody can rate
in another player's name.

## R1 · Access

- **R1.1** When a visitor submits an email address, the app shall ask the backend to send a one-time access code to that address.
- **R1.2** When the visitor submits the access code they received, the app shall start an authenticated session for that email.
- **R1.3** If the submitted email does not belong to a registered player, then the backend shall refuse to create an account for it.
- **R1.4** Where an allowed email domain is configured, the app shall accept only the part before the `@` and append that domain.
- **R1.5** If an authenticated session's account has no confirmed email belonging to a registered player, then the backend shall return no player, rating, or ranking data to it.
- **R1.6** When the player signs out, the app shall end the session.
- **R1.7** If an account is created or changed to have a password, then the backend shall reject it, so the access code is the only way in.

## R2 · Players

- **R2.1** While the authenticated player is an admin, the app shall let them register a player with a name and an email.
- **R2.2** While the authenticated player is an admin, the app shall let them remove a player, together with every rating given or received by that player.
- **R2.3** If a player who is not an admin attempts to create, change, or remove a player, then the backend shall reject the operation.
- **R2.4** If an admin registers an email that already belongs to a player, then the backend shall reject it.
- **R2.5** If anyone attempts to change a registered player's email, then the backend shall reject it; a wrong email is fixed by removing and registering the player again.
- **R2.6** If an admin attempts to remove themselves, then the backend shall leave the player in place.

## R3 · Ratings

- **R3.1** The app shall let the authenticated player give each other player a rating, a whole number from 1 to 10.
- **R3.2** When a player rates someone they have already rated, the backend shall replace the previous rating.
- **R3.3** If a player attempts to save, change, or delete a rating in another player's name, then the backend shall reject it.
- **R3.4** If a player attempts to rate themselves, then the backend shall reject it.
- **R3.5** The backend shall return each individual rating only to the player who gave it; every other player sees ratings only as the ranking's averages.

## R4 · Ranking

- **R4.1** The app shall show the ranking: every player with their average rating rounded to one decimal and the number of ratings received, ordered from highest to lowest average, with players who have no rating listed last.
- **R4.2** When the player presses "Copiar", the app shall copy the ranking to the clipboard as one line per player, `<name> - <average rating>`, in ranking order, writing `sem nota` in place of the average for a player nobody has rated.
- **R4.3** If the clipboard write fails, then the app shall show the ranking text so it can be copied by hand.

## R5 · Hosting

- **R5.1** The app shall run as static files served by GitHub Pages, with no server of its own.
- **R5.2** When a commit reaches `main`, the CI shall run the tests and the lint, then build and publish the site to GitHub Pages.

## Out of scope

- Scheduling games, confirming attendance, and drawing the teams — the copied ranking feeds an external balancer.
- Rating history per game; a rating is the rater's current opinion and is overwritten.
- Players registering themselves; only an admin registers players.
