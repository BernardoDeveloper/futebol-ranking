// The court booking command: `npm run quadra -- 24/10 [--dry-run]`. Wiring only; the logic is in court.ts and whatsapp.ts.
import { chmodSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { run, type Booking } from './court.ts';
import { sendOnWhatsApp } from './whatsapp.ts';

// Outside the repository, so the WhatsApp session can never be committed (R2.1).
const HOME = join(homedir(), '.futebol-ranking');
const PROFILE = join(HOME, 'whatsapp');

try {
  process.loadEnvFile(fileURLToPath(new URL('../.env.local', import.meta.url)));
} catch (error: unknown) {
  // No .env.local: run() explains how to configure the number. Anything else is a real problem.
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
}

/** Set when sending failed, so the window stays open for the organizer to check (R2.7). */
let leftOpen: Promise<void> | undefined;

async function send(booking: Booking): Promise<void> {
  // The profile is the WhatsApp session: only this user may read it (R2.1).
  mkdirSync(PROFILE, { recursive: true, mode: 0o700 });
  // mkdir's mode applies only to directories it creates.
  chmodSync(HOME, 0o700);
  chmodSync(PROFILE, 0o700);
  const context = await chromium.launchPersistentContext(PROFILE, {
    channel: 'chrome',
    headless: false,
    viewport: null,
    // Playwright turns Chrome's sandbox off by default; this window renders a third party's messages.
    chromiumSandbox: true,
  });
  // Registered now, so a window the organizer closes mid-send still counts as closed.
  const closed = new Promise<void>((resolve) => context.once('close', () => { resolve(); }));
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await sendOnWhatsApp(page, booking);
  } catch (error: unknown) {
    leftOpen = closed;
    throw error;
  }
  await context.close();
}

const now = new Date();
process.exitCode = await run(process.argv.slice(2), {
  phone: process.env.COURT_WHATSAPP,
  today: { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() },
  log: (line) => {
    console.log(line);
  },
  error: (line) => {
    console.error(line);
  },
  send,
});

if (leftOpen) {
  console.error('A janela do navegador ficou aberta para você conferir. Feche-a para terminar.');
  await leftOpen;
}
