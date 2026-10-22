import { describe, expect, it, vi } from 'vitest';
import { abacatePay, type Fetch } from '../../supabase/functions/_shared/abacatepay';

const QR = 'data:image/png;base64,iVBORw0KGgo=';

function reply(status: number, body: unknown): Fetch {
  return vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));
}

function request(fetchFn: Fetch): { url: string; init: RequestInit } {
  const call = vi.mocked(fetchFn).mock.calls[0];
  if (!call) throw new Error('fetch not called');
  return { url: call[0], init: call[1] ?? {} };
}

describe('abacatePay().createPix', () => {
  const pix = { externalId: 'm-1', amount: 200, description: 'Manipulação', expiresIn: 1800 };
  const created = { id: 'pix_char_1', amount: 200, status: 'PENDING', brCode: '000201…', brCodeBase64: QR, expiresAt: '2026-10-22T13:00:00Z' };

  it('R1.2 posts a Pix of the given amount in centavos, authenticated by the API key', async () => {
    const fetchFn = reply(200, { data: created, success: true, error: null });
    await abacatePay('abc_dev_key', fetchFn).createPix(pix);
    const { url, init } = request(fetchFn);
    expect(url).toBe('https://api.abacatepay.com/v2/transparents/create');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer abc_dev_key' });
    expect(typeof init.body).toBe('string');
    expect(JSON.parse(init.body as string)).toEqual({
      method: 'PIX',
      data: { amount: 200, description: 'Manipulação', expiresIn: 1800, externalId: 'm-1' },
    });
  });

  it('R1.2 returns the charge id, copy-and-paste code, QR code and expiry', async () => {
    const result = await abacatePay('k', reply(200, { data: created, success: true, error: null })).createPix(pix);
    expect(result).toEqual({ id: 'pix_char_1', brCode: '000201…', qrCode: QR, expiresAt: '2026-10-22T13:00:00Z' });
  });

  it('throws with AbacatePay\'s error when the request fails', async () => {
    const failing = reply(401, { data: null, success: false, error: 'Token de autenticação inválido ou ausente.' });
    await expect(abacatePay('k', failing).createPix(pix)).rejects.toThrow('AbacatePay: Token de autenticação inválido ou ausente.');
  });

  it('refuses a QR code that is not a PNG data URL', async () => {
    const odd = reply(200, { data: { ...created, brCodeBase64: 'https://evil.example/qr.png' }, success: true, error: null });
    await expect(abacatePay('k', odd).createPix(pix)).rejects.toThrow(/PNG data URL/);
  });
});

describe('abacatePay().checkPix', () => {
  it('R1.4 asks AbacatePay for the charge status by id', async () => {
    const fetchFn = reply(200, { data: { id: 'pix_char_1', status: 'PAID' }, success: true, error: null });
    expect(await abacatePay('k', fetchFn).checkPix('pix_char_1')).toBe('PAID');
    const { url, init } = request(fetchFn);
    expect(url).toBe('https://api.abacatepay.com/v2/transparents/check?id=pix_char_1');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer k' });
  });

  it('throws on a response without a status rather than guessing one', async () => {
    await expect(abacatePay('k', reply(200, { data: {}, success: true, error: null })).checkPix('x')).rejects.toThrow(
      /without status/,
    );
  });

  it('throws on an HTTP error with no JSON body', async () => {
    const fetchFn: Fetch = () => Promise.resolve(new Response('bad gateway', { status: 502 }));
    await expect(abacatePay('k', fetchFn).checkPix('x')).rejects.toThrow('AbacatePay: HTTP 502');
  });
});
