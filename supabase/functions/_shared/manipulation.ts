import type { Gateway, Pix } from './abacatepay.ts';

export const PRICE_CENTS = 0;
export const PIX_EXPIRES_IN = 0;

export interface Manipulation {
  id: string;
  status: 'pending' | 'paid' | 'expired';
  charge_id: string | null;
  br_code: string | null;
  qr_code: string | null;
  expires_at: string | null;
}

export interface Store {
  begin(): Promise<Manipulation>;
  mine(): Promise<Manipulation | null>;
  pending(): Promise<Manipulation[]>;
  attach(id: string, pix: Pix): Promise<void>;
  settle(id: string, status: 'paid' | 'expired'): Promise<void>;
}

export type View = { status: 'none' } | { status: 'paid' } | { status: 'pending'; brCode: string; qrCode: string; expiresAt: string };

export function start(_store: Store, _gateway: Gateway): Promise<View> {
  return Promise.reject(new Error('not implemented'));
}
export function check(_store: Store, _gateway: Gateway): Promise<View> {
  return Promise.reject(new Error('not implemented'));
}
export function reconcile(_store: Store, _gateway: Gateway): Promise<void> {
  return Promise.reject(new Error('not implemented'));
}
