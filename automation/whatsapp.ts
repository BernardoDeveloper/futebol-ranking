import type { Booking } from './court.ts';

/** The part of Playwright's Page this needs, so tests can stand in for the browser. */
export interface ChatPage {
  goto(url: string, options: { waitUntil: 'domcontentloaded'; timeout: number }): Promise<unknown>;
  $$(selector: string): Promise<unknown[]>;
  waitForSelector(selector: string, options: { state?: 'attached' | 'detached'; timeout: number }): Promise<unknown>;
  press(selector: string, key: string): Promise<void>;
}

// WhatsApp Web's markup changes without notice: every selector lives here.
export const COMPOSE = 'footer div[contenteditable="true"]';
export const INVALID_NUMBER = 'text=/(número de telefone|phone number).*(inválido|invalid)/i';
const outgoing = (message: string): string => `div.message-out:has-text(${JSON.stringify(message)})`;
const pending = (message: string): string => `${outgoing(message)} >> [data-icon="msg-time"]`;
const prefilled = (message: string): string => `${COMPOSE}:has-text(${JSON.stringify(message)})`;
const HISTORY = 'div.message-in, div.message-out';

export const LOGIN_TIMEOUT = 3 * 60_000;
const PREFILL_TIMEOUT = 10_000;
const HISTORY_TIMEOUT = 5_000;
const SENT_TIMEOUT = 30_000;
const PENDING_TIMEOUT = 60_000;

const isTimeout = (error: unknown): boolean => error instanceof Error && error.name === 'TimeoutError';

/**
 * Opens the chat with the message prefilled and sends it. Waits for the QR code to be
 * scanned (R2.2), refuses a number WhatsApp rejects (R2.3), presses Enter only on the
 * prefilled message (R2.6) and only if it was not sent already (R2.5), and returns
 * once the message is no longer pending (R2.4).
 */
export async function sendOnWhatsApp(page: ChatPage, booking: Booking): Promise<void> {
  let opened: 'chat' | 'invalid';
  // One deadline for loading the page and scanning the QR code (R2.2).
  const deadline = Date.now() + LOGIN_TIMEOUT;
  const left = (): number => Math.max(deadline - Date.now(), 1);
  try {
    await page.goto(booking.url, { waitUntil: 'domcontentloaded', timeout: left() });
    opened = await Promise.race([
      page.waitForSelector(COMPOSE, { timeout: left() }).then(() => 'chat' as const),
      page.waitForSelector(INVALID_NUMBER, { timeout: left() }).then(() => 'invalid' as const),
    ]);
  } catch (error: unknown) {
    if (!isTimeout(error)) throw error;
    throw new Error('A conversa não abriu em 3 minutos. Se o WhatsApp Web pediu o QR code, leia-o com o celular e rode de novo.', { cause: error });
  }
  if (opened === 'invalid') {
    throw new Error(`O WhatsApp recusou o número +${booking.phone}. Confira COURT_WHATSAPP no .env.local. Nada foi enviado.`);
  }
  try {
    await page.waitForSelector(prefilled(booking.message), { timeout: PREFILL_TIMEOUT });
  } catch (error: unknown) {
    if (!isTimeout(error)) throw error;
    throw new Error('A conversa abriu sem a mensagem pronta na caixa de texto. Nada foi enviado.', { cause: error });
  }
  // The history renders after the compose box; a chat with no messages simply times out here.
  await page.waitForSelector(HISTORY, { timeout: HISTORY_TIMEOUT }).catch((error: unknown) => {
    if (!isTimeout(error)) throw error;
  });
  if ((await page.$$(outgoing(booking.message))).length > 0) {
    throw new Error('Esta mensagem já aparece na conversa: a quadra já foi pedida para este dia. Nada foi enviado.');
  }
  await page.press(COMPOSE, 'Enter');
  try {
    await page.waitForSelector(outgoing(booking.message), { timeout: SENT_TIMEOUT });
  } catch (error: unknown) {
    if (!isTimeout(error)) throw error;
    throw new Error('A mensagem não apareceu na conversa depois do Enter. Confira no WhatsApp se foi enviada.', { cause: error });
  }
  try {
    await page.waitForSelector(pending(booking.message), { state: 'detached', timeout: PENDING_TIMEOUT });
  } catch (error: unknown) {
    if (!isTimeout(error)) throw error;
    throw new Error('A mensagem continua pendente (ícone de relógio). Confira a conexão do celular e o WhatsApp.', { cause: error });
  }
}
