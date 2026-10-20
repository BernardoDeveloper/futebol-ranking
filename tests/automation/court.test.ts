import { describe, expect, it, vi } from 'vitest';
import { courtMessage, parseDay, phoneDigits, run, type Booking, whatsappUrl } from '../../automation/court.ts';

const today = { day: 20, month: 10, year: 2026 };

describe('parseDay', () => {
  it('R1.3 reads DD/MM as its next occurrence from today, today included', () => {
    expect(parseDay('24/10', today)).toEqual({ day: 24, month: 10, year: 2026 });
    expect(parseDay('20/10', today)).toEqual({ day: 20, month: 10, year: 2026 });
    expect(parseDay('5/1', today)).toEqual({ day: 5, month: 1, year: 2027 });
    expect(parseDay('19/10', today)).toEqual({ day: 19, month: 10, year: 2027 });
  });

  it('R1.3 reads DD/MM/AAAA as written', () => {
    expect(parseDay('07/11/2026', today)).toEqual({ day: 7, month: 11, year: 2026 });
  });

  it('R1.3 finds the next 29/02 in a leap year', () => {
    expect(parseDay('29/02', today)).toEqual({ day: 29, month: 2, year: 2028 });
  });

  it('R1.4 explains a day that is not a calendar date', () => {
    expect(parseDay('31/02', today)).toEqual({ error: '31/02 não existe no calendário.' });
    expect(parseDay('31/11/2026', today)).toEqual({ error: '31/11/2026 não existe no calendário.' });
    expect(parseDay('10/13', today)).toEqual({ error: '10/13 não existe no calendário.' });
  });

  it('R1.4 explains a full date that has passed', () => {
    expect(parseDay('19/10/2026', today)).toEqual({ error: '19/10/2026 já passou.' });
  });

  it('R1.4 explains input that is not a day', () => {
    expect(parseDay('amanhã', today)).toHaveProperty('error');
    expect(parseDay('2026-10-24', today)).toHaveProperty('error');
  });
});

describe('courtMessage', () => {
  it('R1.2 asks for court 3 on the day at 18:30, zero-padding the day and month', () => {
    expect(courtMessage({ day: 7, month: 1, year: 2027 })).toBe(
      'Bom dia. Tudo bem? A quadra 3 está disponível para o dia 07/01 às 18:30?',
    );
  });
});

describe('whatsappUrl', () => {
  it('opens the chat with the message encoded in the URL', () => {
    const url = new URL(whatsappUrl('5511999990000', 'Bom dia. às 18:30?'));
    expect(url.origin + url.pathname).toBe('https://web.whatsapp.com/send');
    expect(url.searchParams.get('phone')).toBe('5511999990000');
    expect(url.searchParams.get('text')).toBe('Bom dia. às 18:30?');
  });
});

describe('phoneDigits', () => {
  it('R1.7 keeps only the digits of the configured number', () => {
    expect(phoneDigits('+55 11 9999-0000')).toBe('551199990000');
  });

  it('R1.5 treats a missing or too short number as not configured', () => {
    expect(phoneDigits(undefined)).toBeNull();
    expect(phoneDigits('  ')).toBeNull();
    expect(phoneDigits('12345')).toBeNull();
  });

  it('R1.5 refuses a number missing its country code, or longer than an international number', () => {
    expect(phoneDigits('11 99999-0000')).toBeNull();
    expect(phoneDigits('5511999990000')).toBe('5511999990000');
    expect(phoneDigits('1234567890123456')).toBeNull();
  });
});

describe('run', () => {
  function deps(phone = '+55 11 9999-0000') {
    return {
      phone,
      today,
      log: vi.fn((_line: string) => undefined),
      error: vi.fn((_line: string) => undefined),
      send: vi.fn((_booking: Booking) => Promise.resolve()),
    };
  }

  it('R1.1 hands the message for the given day to the sender', async () => {
    const d = deps();
    expect(await run(['24/10'], d)).toBe(0);
    expect(d.send).toHaveBeenCalledWith({
      phone: '551199990000',
      message: 'Bom dia. Tudo bem? A quadra 3 está disponível para o dia 24/10 às 18:30?',
      url: whatsappUrl('551199990000', 'Bom dia. Tudo bem? A quadra 3 está disponível para o dia 24/10 às 18:30?'),
    });
  });

  it('R1.4 stops before sending when the day is missing or invalid, and says why', async () => {
    for (const args of [[], ['31/02'], ['19/10/2026'], ['24/10', '25/10']]) {
      const d = deps();
      expect(await run(args, d)).toBe(1);
      expect(d.send).not.toHaveBeenCalled();
      expect(d.error).toHaveBeenCalledOnce();
    }
  });

  it('stops on an unknown option instead of sending', async () => {
    const d = deps();
    expect(await run(['24/10', '--enviar'], d)).toBe(1);
    expect(d.send).not.toHaveBeenCalled();
  });

  it('R1.5 stops before sending when the number is not configured, and says how to configure it', async () => {
    const d = { ...deps(), phone: undefined };
    expect(await run(['24/10'], d)).toBe(1);
    expect(d.send).not.toHaveBeenCalled();
    expect(d.error.mock.calls[0]?.[0]).toMatch(/COURT_WHATSAPP=/);
  });

  it('R1.6 prints the number and the message on a dry run, without sending', async () => {
    const d = deps();
    expect(await run(['--dry-run', '24/10'], d)).toBe(0);
    expect(d.send).not.toHaveBeenCalled();
    expect(d.log.mock.calls.map((c) => c[0])).toEqual([
      'Para: +551199990000',
      'Mensagem: Bom dia. Tudo bem? A quadra 3 está disponível para o dia 24/10 às 18:30?',
    ]);
  });

  it('reports a failed send and exits non-zero', async () => {
    const d = deps();
    d.send.mockRejectedValueOnce(new Error('WhatsApp recusou o número.'));
    expect(await run(['24/10'], d)).toBe(1);
    expect(d.error).toHaveBeenCalledWith('WhatsApp recusou o número.');
  });
});
