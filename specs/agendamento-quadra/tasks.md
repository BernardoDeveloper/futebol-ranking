# Agendamento quadra — tasks

## 1 · Message

- [x] 1.1 (Unit) Parse the day, write the court booking message, and build the WhatsApp Web URL — R1.2, R1.3, R1.4
- [x] 1.2 (Unit) Check the arguments and the number, print on dry run, and hand a valid booking to the sender — R1.4, R1.5, R1.6, R1.7
  _Depends 1.1_

## 2 · Sending

- [x] 2.1 (Unit) Send through WhatsApp Web: wait for login, stop on a rejected number, press Enter, wait until not pending — R1.1, R2.2, R2.3, R2.4
  _Depends 1.2_
- [x] 2.2 (Unit) Wire the command: read .env.local, launch Chrome on a persistent profile outside the repository, add the npm script — R1.1, R1.7, R2.1
  _Depends 2.1_

## 3 · Review findings

- [x] 3.1 (Unit) Refuse short numbers, check the prefilled text and an earlier identical message before Enter, print the reason before leaving the window open, sandbox Chrome, keep the profile private — R1.5, R2.1, R2.5, R2.6, R2.7
  _Depends 2.2_
  _Reason code and security review findings_
