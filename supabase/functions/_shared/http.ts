// The two Edge Functions' request handling, kept out of their Deno index.ts so Vitest
// runs it. specs/manipulados/design.md.

import type { Gateway } from './abacatepay.ts';
import { check, start, type Store } from './manipulation.ts';

// The app is a static site on another origin; the player's JWT travels in a header, not a cookie.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Details go to the function's logs, never to the caller.
const INTERNAL = 'internal error';

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

/** Compares in time that does not depend on where the strings differ. An empty secret matches nothing. */
export function sameSecret(given: string, expected: string): boolean {
  if (expected === '') return false;
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** `manipular`: POST {action: "start" | "check"} with the player's JWT (R1.2, R1.3). */
export function manipularHandler(deps: { store: (authorization: string) => Store; gateway: Gateway }) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'not signed in' }, 401);
    const body: unknown = await request.json().catch(() => null);
    const action = typeof body === 'object' && body !== null ? (body as { action?: unknown }).action : undefined;
    if (action !== 'start' && action !== 'check') return json({ error: 'unknown action' }, 400);
    const store = deps.store(authorization);
    try {
      return json(action === 'start' ? await start(store, deps.gateway) : await check(store, deps.gateway));
    } catch (error) {
      const message = errorMessage(error);
      if (/not a registered player/.test(message)) return json({ error: message }, 403);
      console.error(error);
      return json({ error: INTERNAL }, 500);
    }
  };
}

/** `abacatepay-webhook`: any event is a prompt to reconcile; only the secret lets it through (R1.4, R1.7). */
export function webhookHandler(deps: { secret: string; reconcile: () => Promise<void> }) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
    const given = new URL(request.url).searchParams.get('webhookSecret') ?? '';
    if (!sameSecret(given, deps.secret)) return json({ error: 'forbidden' }, 401);
    try {
      await deps.reconcile();
      return json({ ok: true });
    } catch (error) {
      // A non-2xx makes AbacatePay retry the delivery later.
      console.error(error);
      return json({ error: INTERNAL }, 500);
    }
  };
}
