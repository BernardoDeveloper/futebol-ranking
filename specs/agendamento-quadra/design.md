# Agendamento quadra — design

## What changes

Serves R1.1–R1.7, R2.1–R2.7.

A Node command in `automation/`, outside the static app, run on the organizer's
computer:

```
npm run quadra -- 24/10            send
npm run quadra -- 24/10 --dry-run  print only
```

```
automation/
  court.ts      day parsing, the message, the WhatsApp Web URL, argument and number checks (R1.2–R1.7)
  whatsapp.ts   drives WhatsApp Web through a narrow page interface (R2.2–R2.4)
  main.ts       wiring: reads .env.local, launches Chrome with Playwright, runs court.ts (R1.1, R2.1)
tests/automation/   vitest, with a fake page standing in for the browser
```

The files are TypeScript run by `tsx`, so nothing is compiled. Node 22's own type
stripping was the first choice, but distro builds of Node ship without it. Imports
carry the `.ts` extension (`allowImportingTsExtensions`, safe because nothing is
emitted), which also keeps the door open to plain `node` later.

The chat is opened with `https://web.whatsapp.com/send?phone=<digits>&text=<message>`,
which prefills the message. Before pressing Enter the command checks that the compose
box holds that text (R2.6), so Enter can never send something else or into
another chat, and that no outgoing message in the chat already has it (R2.5), so a
retry after an unclear failure does not book twice. The duplicate check first gives the history up to
5 seconds to render, and still sees only the messages WhatsApp Web has loaded, which in
practice are the recent ones. It then waits
for the outgoing message and for its pending clock icon to go away (R2.4). Playwright drives the installed Google Chrome (`channel: 'chrome'`), so no
browser is downloaded, in a dedicated profile at `~/.futebol-ranking/whatsapp`, created with mode `0700`
because the profile is the WhatsApp session (R2.1). Chrome runs with its sandbox on
(`chromiumSandbox: true`); Playwright turns it off by default, and this window renders
messages from a third party.
The profile is not the organizer's everyday Chrome profile: Chrome refuses a profile
already open in another window.

The number lives in `.env.local` as `COURT_WHATSAPP` (R1.7). Only `VITE_`-prefixed
variables reach the app bundle, so it never reaches the site either. Any formatting is
accepted; only digits are kept, and they must be 12 to 15, so a number missing its
country code (`55`) is refused instead of reaching a stranger (R1.5).

On failure the reason is printed first, then the window stays open until the organizer
closes it (R2.7): it usually shows the chat with the text prefilled, ready to send by
hand.

## Alternatives considered

- **A button on the site opening a WhatsApp link.** No dependency and works on a phone,
  but the organizer still presses send, and the number would be public in the bundle.
  Rejected by the organizer in favour of a fully automatic send.
- **WhatsApp Business API.** The only sanctioned automation, but it needs a business
  account, approved templates and paid conversations for one message a week. Rejected.

## Risks

- WhatsApp's terms forbid automated use. One message a week from the organizer's own
  session is low risk, not none.
- WhatsApp Web's markup changes without notice. The selectors live together at the top
  of `whatsapp.ts`; when they break, the command fails with a message rather than
  sending something wrong, and leaves the window open, usually on the chat with the
  text prefilled, so the organizer can send by hand.
