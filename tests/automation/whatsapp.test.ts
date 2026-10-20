import { describe, expect, it } from 'vitest';
import type { Booking } from '../../automation/court.ts';
import { COMPOSE, INVALID_NUMBER, LOGIN_TIMEOUT, sendOnWhatsApp, type ChatPage } from '../../automation/whatsapp.ts';

const booking: Booking = {
  phone: '551199990000',
  message: 'Bom dia. Tudo bem? A quadra 3 está disponível para o dia 24/10 às 18:30?',
  url: 'https://web.whatsapp.com/send?phone=551199990000&text=x',
};

const timeout = (): Error => Object.assign(new Error('Timeout exceeded'), { name: 'TimeoutError' });
const never = (): Promise<never> => new Promise(() => undefined);

type Outcome = 'found' | 'timeout' | 'never';

// A page where each selector is found, times out, or never resolves.
function fakePage(outcome: (selector: string, state: string | undefined) => Outcome, alreadySent = 0) {
  const calls: string[] = [];
  const page: ChatPage = {
    goto(url) {
      calls.push(`goto ${url}`);
      return Promise.resolve();
    },
    $$(selector) {
      calls.push(`count ${selector}`);
      return Promise.resolve(Array.from({ length: alreadySent }, () => ({})));
    },
    waitForSelector(selector, options) {
      calls.push(`wait ${options.state ?? 'attached'} ${selector} ${String(options.timeout)}`);
      const result = outcome(selector, options.state);
      return result === 'found' ? Promise.resolve(null) : result === 'timeout' ? Promise.reject(timeout()) : never();
    },
    press(selector, key) {
      calls.push(`press ${selector} ${key}`);
      return Promise.resolve();
    },
  };
  return { page, calls };
}

const chatOpens = (selector: string): Outcome => (selector === INVALID_NUMBER ? 'never' : 'found');

describe('sendOnWhatsApp', () => {
  it('R1.1 R2.4 opens the chat, presses Enter, and waits for the message to leave the pending state', async () => {
    const { page, calls } = fakePage(chatOpens);
    await sendOnWhatsApp(page, booking);
    expect(calls[0]).toBe(`goto ${booking.url}`);
    const enter = calls.indexOf(`press ${COMPOSE} Enter`);
    expect(enter).toBeGreaterThan(0);
    expect(calls.slice(enter - 3, enter)).toEqual([
      expect.stringMatching(/^wait attached footer .*:has-text\(".*24\/10.*"\) /),
      expect.stringMatching(/^wait attached div\.message-in, div\.message-out /),
      expect.stringMatching(/^count div\.message-out:has-text\(".*24\/10.*"\)$/),
    ]);
    expect(calls.slice(enter + 1)).toEqual([
      expect.stringMatching(/^wait attached div\.message-out:has-text\(".*24\/10.*"\) /),
      expect.stringMatching(/^wait detached .*>> \[data-icon="msg-time"\] /),
    ]);
  });

  it('R2.2 waits up to 3 minutes for the chat, so there is time to scan the QR code', async () => {
    const { page, calls } = fakePage(chatOpens);
    await sendOnWhatsApp(page, booking);
    const wait = calls.find((c) => c.startsWith(`wait attached ${COMPOSE} `));
    const ms = Number(wait?.split(' ').pop());
    expect(ms).toBeGreaterThan(LOGIN_TIMEOUT - 1000);
    expect(ms).toBeLessThanOrEqual(LOGIN_TIMEOUT);
    expect(LOGIN_TIMEOUT).toBe(180_000);
  });

  it('R2.5 still checks for an earlier message in a chat with no history', async () => {
    const { page, calls } = fakePage((selector) =>
      selector === INVALID_NUMBER ? 'never' : selector.startsWith('div.message-in') ? 'timeout' : 'found',
    );
    await sendOnWhatsApp(page, booking);
    expect(calls.some((c) => c.startsWith('press'))).toBe(true);
  });

  it('R2.2 gives up with a hint about the QR code when the chat never opens', async () => {
    const { page, calls } = fakePage(() => 'timeout');
    await expect(sendOnWhatsApp(page, booking)).rejects.toThrow(/QR code/);
    expect(calls.some((c) => c.startsWith('press'))).toBe(false);
  });

  it('R2.3 stops without pressing Enter when WhatsApp rejects the number', async () => {
    const { page, calls } = fakePage((selector) => (selector === INVALID_NUMBER ? 'found' : 'never'));
    await expect(sendOnWhatsApp(page, booking)).rejects.toThrow('O WhatsApp recusou o número +551199990000');
    expect(calls.some((c) => c.startsWith('press'))).toBe(false);
  });

  it('R2.5 stops without pressing Enter when the chat already shows the same message', async () => {
    const { page, calls } = fakePage(chatOpens, 1);
    await expect(sendOnWhatsApp(page, booking)).rejects.toThrow(/já foi pedida/);
    expect(calls.some((c) => c.startsWith('press'))).toBe(false);
  });

  it('R2.6 stops without pressing Enter when the compose box does not hold the message', async () => {
    const { page, calls } = fakePage((selector) =>
      selector === INVALID_NUMBER ? 'never' : selector.includes(':has-text(') && selector.startsWith('footer') ? 'timeout' : 'found',
    );
    await expect(sendOnWhatsApp(page, booking)).rejects.toThrow(/sem a mensagem pronta/);
    expect(calls.some((c) => c.startsWith('press'))).toBe(false);
  });

  it('R2.2 explains a WhatsApp Web page that does not load in time', async () => {
    const page: ChatPage = {
      goto: () => Promise.reject(timeout()),
      $$: () => Promise.resolve([]),
      waitForSelector: never,
      press: () => Promise.resolve(),
    };
    await expect(sendOnWhatsApp(page, booking)).rejects.toThrow(/3 minutos/);
  });

  it('R2.4 fails when the message stays pending', async () => {
    const { page } = fakePage((selector, state) =>
      selector === INVALID_NUMBER ? 'never' : state === 'detached' ? 'timeout' : 'found',
    );
    await expect(sendOnWhatsApp(page, booking)).rejects.toThrow(/pendente/);
  });

  it('fails when the message never shows up in the chat after Enter', async () => {
    const { page } = fakePage((selector) =>
      selector === INVALID_NUMBER ? 'never' : selector.startsWith('div.message-out') ? 'timeout' : 'found',
    );
    await expect(sendOnWhatsApp(page, booking)).rejects.toThrow(/não apareceu/);
  });

  it('passes on errors that are not timeouts', async () => {
    const page: ChatPage = {
      goto: () => Promise.reject(new Error('net::ERR_INTERNET_DISCONNECTED')),
      $$: () => Promise.resolve([]),
      waitForSelector: never,
      press: () => Promise.resolve(),
    };
    await expect(sendOnWhatsApp(page, booking)).rejects.toThrow('net::ERR_INTERNET_DISCONNECTED');
  });
});
