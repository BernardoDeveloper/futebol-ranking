---
status: accepted
---

# 0001 · Use Supabase for authentication and data

## Context

The site is hosted on GitHub Pages, which serves static files only: it can neither
send an email nor store a rating. Login must prove the person owns their company
email (a one-time code), and the database must stop a player from rating in someone
else's name even though every query comes straight from the browser.

Considered: Supabase, Firebase, and a Cloudflare Worker sending mail through Resend.
Firebase's email login is a magic link, not a typed code. A Worker means writing and
operating our own auth and mail, plus a verified sending domain.

## Decision

Use Supabase: its email OTP sign-in for the access code, and its Postgres for players
and ratings. Authorization lives in the database as row-level security policies and
an `auth.users` trigger, keyed on the email in the session's JWT, so it holds no
matter what the browser sends. The browser only ever holds the public anon key.

## Consequences

- The free plan is enough for a team; its built-in mailer is rate-limited, so a custom
  SMTP sender should be configured once the team starts logging in.
- The security of the app is the SQL in `supabase/migrations/`, and its tests run that
  SQL against a real Postgres (PGlite) with Supabase's `auth` schema stubbed.
- Moving off Supabase means re-implementing auth and porting the policies.
