// The manipulation flow, over a store (Postgres) and a gateway (AbacatePay), so it runs
// in Vitest as well as in the Edge Functions. specs/manipulados/design.md.
// A payment counts only when AbacatePay's API says PAID; nothing the caller sends does.

import type { Gateway, Pix } from './abacatepay.ts';

/** R$ 2,00. A server constant: nothing from the browser reaches the amount. */
export const PRICE_CENTS = 200;
/** How long the Pix stays payable, in seconds. */
export const PIX_EXPIRES_IN = 30 * 60;
const DESCRIPTION = 'Manipulados: +3 na lista da zoeira, só pela resenha';

export interface Manipulation {
  id: string;
  status: 'pending' | 'paid' | 'expired';
  charge_id: string | null;
  br_code: string | null;
  qr_code: string | null;
  expires_at: string | null;
}

export interface Store {
  /** start_manipulation() as the player: their pending manipulation or a fresh one. Throws "already manipulated". */
  begin(): Promise<Manipulation>;
  /** The player's pending or paid manipulation, if any. */
  mine(): Promise<Manipulation | null>;
  /** Every pending manipulation that has a charge, across players. */
  pending(): Promise<Manipulation[]>;
  attach(id: string, pix: Pix): Promise<void>;
  /** Moves a pending manipulation to paid or expired; a no-op on any other. */
  settle(id: string, status: 'paid' | 'expired'): Promise<void>;
}

/** What the app is told. */
export type View =
  | { status: 'none' }
  | { status: 'paid' }
  | { status: 'pending'; brCode: string; qrCode: string; expiresAt: string };

function pendingView(row: Manipulation): View | null {
  if (row.charge_id === null || row.br_code === null || row.qr_code === null || row.expires_at === null) return null;
  return { status: 'pending', brCode: row.br_code, qrCode: row.qr_code, expiresAt: row.expires_at };
}

function outcome(status: string): 'paid' | 'expired' | null {
  if (status === 'PAID') return 'paid';
  if (status === 'EXPIRED' || status === 'CANCELLED') return 'expired';
  return null;
}

async function settleOne(store: Store, gateway: Gateway, id: string, chargeId: string): Promise<'paid' | 'expired' | null> {
  const settled = outcome(await gateway.checkPix(chargeId));
  if (settled) await store.settle(id, settled);
  return settled;
}

/** R1.2, R1.5, R1.6: the player's Pix, created on first ask. */
export async function start(store: Store, gateway: Gateway): Promise<View> {
  let row: Manipulation;
  try {
    row = await store.begin();
  } catch (error) {
    if (error instanceof Error && /already manipulated/.test(error.message)) return { status: 'paid' };
    throw error;
  }
  if (row.charge_id !== null && row.expires_at !== null && Date.parse(row.expires_at) <= Date.now()) {
    // Past its expiry here, but a payment may have landed in its last seconds: ask first.
    const settled = await settleOne(store, gateway, row.id, row.charge_id);
    if (settled === 'paid') return { status: 'paid' };
    if (settled === 'expired') row = await store.begin();
  }
  const existing = pendingView(row);
  if (existing) return existing;
  const pix = await gateway.createPix({
    externalId: row.id,
    amount: PRICE_CENTS,
    description: DESCRIPTION,
    expiresIn: PIX_EXPIRES_IN,
  });
  await store.attach(row.id, pix);
  return { status: 'pending', brCode: pix.brCode, qrCode: pix.qrCode, expiresAt: pix.expiresAt };
}

/** R1.3, R1.4: the player's state, settling their own pending charge first. */
export async function check(store: Store, gateway: Gateway): Promise<View> {
  const row = await store.mine();
  if (row === null) return { status: 'none' };
  if (row.status === 'paid') return { status: 'paid' };
  const view = pendingView(row);
  if (row.status !== 'pending' || view === null || row.charge_id === null) return { status: 'none' };
  const settled = await settleOne(store, gateway, row.id, row.charge_id);
  if (settled === 'paid') return { status: 'paid' };
  if (settled === 'expired') return { status: 'none' };
  return view;
}

/** R1.4: every pending charge, for the webhook. Throws after trying all if any check failed. */
export async function reconcile(store: Store, gateway: Gateway): Promise<void> {
  const rows = await store.pending();
  let failed = 0;
  for (const row of rows) {
    if (row.charge_id === null) continue;
    try {
      await settleOne(store, gateway, row.id, row.charge_id);
    } catch {
      failed++;
    }
  }
  if (failed > 0) throw new Error(`could not check ${String(failed)} of ${String(rows.length)} pending charges`);
}
