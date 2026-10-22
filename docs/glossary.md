# Glossary

One canonical term per concept, and the synonyms nobody should use for it.

- **player** — a registered member of the team, identified by their company email; only players can log in. Avoid: user, athlete
- **admin** — a player allowed to register and remove players.
- **rating** — the whole number from 1 to 10 one player gives another; one per pair, overwritten when changed, deleted when cleared. Avoid: vote, score, grade
- **average rating** — the mean of the ratings a player received, rounded to one decimal.
- **ranking** — every player ordered by average rating, highest first, unrated players last.
- **access code** — the one-time code emailed at login. Avoid: OTP code, token
- **manipulation** — a player's R$ 2,00 Pix to the organizer's key which, once an admin confirms it, adds 3 to their average rating in the Manipulados list, and nowhere else; at most one per player. Avoid: boost, bribe
- **manipulated rating** — the average rating plus 3 for a player with a confirmed manipulation, shown only in the Manipulados list.
- **manipulation code** — `MANIP` and the first 8 hex digits of a manipulation's id, sent as the Pix txid so an admin can find the payment.
