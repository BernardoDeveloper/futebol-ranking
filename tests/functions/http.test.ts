import { describe, expect, it, vi } from 'vitest';
import type { Gateway } from '../../supabase/functions/_shared/abacatepay';
import { manipularHandler, sameSecret, webhookHandler } from '../../supabase/functions/_shared/http';
import type { Manipulation, Store } from '../../supabase/functions/_shared/manipulation';

const WEBHOOK = 'https://x.supabase.co/functions/v1/abacatepay-webhook';
const EVENT = JSON.stringify({ id: 'log_1', event: 'transparent.completed', devMode: true, data: {} });

describe('sameSecret', () => {
  it('matches only the exact secret', () => {
    expect(sameSecret('s3cret', 's3cret')).toBe(true);
    expect(sameSecret('s3creT', 's3cret')).toBe(false);
    expect(sameSecret('s3cret-and-more', 's3cret')).toBe(false);
    expect(sameSecret('', 's3cret')).toBe(false);
  });

  it('matches nothing when no secret is configured', () => {
    expect(sameSecret('', '')).toBe(false);
  });
});

describe('webhookHandler', () => {
  function setup(reconcile = vi.fn(() => Promise.resolve())) {
    return { reconcile, handle: webhookHandler({ secret: 's3cret', reconcile }) };
  }

  it('R1.7 rejects a call without the configured secret and changes nothing', async () => {
    const { reconcile, handle } = setup();
    for (const url of [WEBHOOK, `${WEBHOOK}?webhookSecret=guess`]) {
      const response = await handle(new Request(url, { method: 'POST', body: EVENT }));
      expect(response.status).toBe(401);
    }
    expect(reconcile).not.toHaveBeenCalled();
  });

  it('R1.4 reconciles the pending charges on a call with the secret, whatever the body says', async () => {
    const { reconcile, handle } = setup();
    const response = await handle(new Request(`${WEBHOOK}?webhookSecret=s3cret`, { method: 'POST', body: 'not json' }));
    expect(response.status).toBe(200);
    expect(reconcile).toHaveBeenCalledOnce();
  });

  it('answers 500 when reconciling fails, so AbacatePay retries', async () => {
    const { handle } = setup(vi.fn(() => Promise.reject(new Error('could not check 1 of 1 pending charges'))));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await handle(new Request(`${WEBHOOK}?webhookSecret=s3cret`, { method: 'POST', body: EVENT }));
    expect(response.status).toBe(500);
  });
});

describe('manipularHandler', () => {
  const pending: Manipulation = {
    id: 'm-1',
    status: 'pending',
    charge_id: 'pix_char_1',
    br_code: '000201…',
    qr_code: 'data:image/png;base64,AA==',
    expires_at: '2026-10-22T13:00:00Z',
  };

  function setup(begin: () => Promise<Manipulation> = () => Promise.resolve(pending)) {
    const mine = vi.fn(() => Promise.resolve(pending));
    const store: Store = {
      begin: vi.fn(begin),
      mine,
      pending: vi.fn(() => Promise.resolve([])),
      attach: vi.fn(() => Promise.resolve()),
      settle: vi.fn(() => Promise.resolve()),
    };
    const gateway: Gateway = {
      createPix: vi.fn(() => Promise.reject(new Error('unexpected'))),
      checkPix: vi.fn(() => Promise.resolve('PENDING')),
    };
    const storeFor = vi.fn((_authorization: string) => store);
    return { mine, storeFor, handle: manipularHandler({ store: storeFor, gateway }) };
  }

  const post = (body: unknown, headers: Record<string, string> = { Authorization: 'Bearer jwt' }): Request =>
    new Request('https://x.supabase.co/functions/v1/manipular', { method: 'POST', headers, body: JSON.stringify(body) });

  it('R1.2 starts a manipulation as the caller and returns the Pix', async () => {
    const { storeFor, handle } = setup();
    const response = await handle(post({ action: 'start' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'pending', brCode: '000201…', qrCode: pending.qr_code, expiresAt: pending.expires_at });
    expect(storeFor).toHaveBeenCalledWith('Bearer jwt');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('R1.3 checks the caller\'s manipulation', async () => {
    const { mine, handle } = setup();
    const response = await handle(post({ action: 'check' }));
    expect(await response.json()).toMatchObject({ status: 'pending' });
    expect(mine).toHaveBeenCalled();
  });

  it('refuses a call with no session or an unknown action', async () => {
    const { storeFor, handle } = setup();
    expect((await handle(post({ action: 'start' }, {}))).status).toBe(401);
    expect((await handle(post({ action: 'pay', amount: 1 }))).status).toBe(400);
    expect(storeFor).not.toHaveBeenCalled();
  });

  it('answers 403 to a session that is not a registered player', async () => {
    const { handle } = setup(() => Promise.reject(new Error('not a registered player')));
    expect((await handle(post({ action: 'start' }))).status).toBe(403);
  });

  it('hides internal error details from the caller', async () => {
    const { handle } = setup(() => Promise.reject(new Error('permission denied for table manipulations')));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await handle(post({ action: 'start' }));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('permission denied');
  });

  it('answers the CORS preflight', async () => {
    const { handle } = setup();
    const response = await handle(new Request('https://x.supabase.co/functions/v1/manipular', { method: 'OPTIONS' }));
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('authorization');
  });
});
