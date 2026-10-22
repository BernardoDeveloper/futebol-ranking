import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { supabaseStore } from '../../supabase/functions/_shared/store';

interface Sent {
  method: string;
  url: URL;
  headers: Headers;
  body: unknown;
}

// A Supabase client whose requests are recorded and answered with `reply`.
function client(key: string, reply: unknown, sent: Sent[]) {
  const fetchFn = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    sent.push({ method: init?.method ?? 'GET', url: new URL(input instanceof Request ? input.url : input), headers: new Headers(init?.headers), body });
    return Promise.resolve(new Response(JSON.stringify(reply), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  });
  return createClient('https://x.supabase.co', key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchFn, headers: key === 'anon' ? { Authorization: 'Bearer player-jwt' } : {} },
  });
}

const ROW = { id: 'm-1', status: 'pending', charge_id: null, br_code: null, qr_code: null, expires_at: null };

describe('supabaseStore', () => {
  it('R1.8 starts a manipulation through start_manipulation() with the player\'s JWT', async () => {
    const sent: Sent[] = [];
    const store = supabaseStore(client('anon', ROW, sent), client('service', null, []));
    expect(await store.begin()).toEqual(ROW);
    expect(sent[0]?.url.pathname).toBe('/rest/v1/rpc/start_manipulation');
    expect(sent[0]?.headers.get('Authorization')).toBe('Bearer player-jwt');
  });

  it('R1.4 marks paid only a row still pending, with the service role', async () => {
    const sent: Sent[] = [];
    const store = supabaseStore(null, client('service', null, sent));
    await store.settle('m-1', 'paid');
    const request = sent[0];
    expect(request?.method).toBe('PATCH');
    expect(request?.url.searchParams.get('id')).toBe('eq.m-1');
    expect(request?.url.searchParams.get('status')).toBe('eq.pending');
    expect(request?.body).toMatchObject({ status: 'paid' });
    expect(request?.headers.get('apikey')).toBe('service');
  });

  it('attaches a charge only to a pending row that has none, failing when no row took it', async () => {
    const sent: Sent[] = [];
    const pix = { id: 'pix_char_1', brCode: 'br', qrCode: 'qr', expiresAt: '2026-10-22T13:00:00Z' };
    await supabaseStore(null, client('service', [{ id: 'm-1' }], sent)).attach('m-1', pix);
    expect(sent[0]?.url.searchParams.get('status')).toBe('eq.pending');
    expect(sent[0]?.url.searchParams.get('charge_id')).toBe('is.null');
    await expect(supabaseStore(null, client('service', [], [])).attach('m-1', pix)).rejects.toThrow(/no longer pending/);
  });

  it('R1.4 lists only pending rows that have a charge', async () => {
    const sent: Sent[] = [];
    await supabaseStore(null, client('service', [], sent)).pending();
    expect(sent[0]?.url.searchParams.get('status')).toBe('eq.pending');
    expect(sent[0]?.url.searchParams.get('charge_id')).toBe('not.is.null');
  });

  it('refuses player calls from the webhook, which has no player session', async () => {
    await expect(supabaseStore(null, client('service', null, [])).begin()).rejects.toThrow('no player session');
  });
});
