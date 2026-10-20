---
autonomy: auto
ci: no-wait
---

# Agendamento quadra — requirements

## Purpose

Booking the court is a WhatsApp message to the venue, sent by hand every week. This
automation sends that message from the organizer's own computer with one command,
through WhatsApp Web in the browser, for the day given on the command line.

## R1 · Trigger

- **R1.1** When the organizer runs the court booking command with a day, the automation shall send the court booking message for that day to the venue's WhatsApp number through WhatsApp Web.
- **R1.2** The automation shall write the court booking message as `Bom dia. Tudo bem? A quadra 3 está disponível para o dia <DD/MM> às 18:30?`.
- **R1.3** The automation shall accept the day as `DD/MM` or `DD/MM/AAAA`, reading `DD/MM` as its next occurrence from today.
- **R1.4** If the day is missing, is not a calendar date, or has already passed, then the automation shall stop without opening the browser and say why.
- **R1.5** If the venue's number is not configured, or is not a full international number of 12 to 15 digits, then the automation shall stop without opening the browser and say how to configure it.
- **R1.6** Where the dry-run option is given, the automation shall print the message and where it would go without opening the browser.
- **R1.7** The automation shall read the venue's number from `.env.local`, which is not tracked, so the number never reaches the public repository.

## R2 · WhatsApp Web

- **R2.1** The automation shall keep the WhatsApp Web session in a browser profile outside the repository, so the QR code is scanned only on the first run, readable only by the organizer's user account.
- **R2.2** While WhatsApp Web waits for the QR code to be scanned, the automation shall wait up to 3 minutes before giving up.
- **R2.3** If WhatsApp Web rejects the number, then the automation shall stop without sending and say so.
- **R2.4** When the message has been sent, the automation shall wait until WhatsApp Web no longer shows it as pending before closing the browser.
- **R2.5** If the chat already shows the court booking message for that day, then the automation shall stop without sending and say so.
- **R2.6** If the compose box does not hold the court booking message, then the automation shall stop without sending and say so.
- **R2.7** If sending fails, then the automation shall say why and leave the browser window open until the organizer closes it.

## Out of scope

- Reading the venue's reply, or booking anything in the ranking app.
- Running on a schedule: the organizer triggers each booking.
- Running from the GitHub Pages site, which cannot drive a browser.
