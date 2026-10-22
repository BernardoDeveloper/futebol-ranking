// The manipulation Store over Supabase. Reads and start_manipulation() run as the player,
// so the SQL's rules apply; the writes the player may not make run as the service role.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Pix } from './abacatepay.ts';
import type { Manipulation, Store } from './manipulation.ts';

const COLUMNS = 'id, status, charge_id, br_code, qr_code, expires_at';

function check(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/** `asPlayer` carries the caller's JWT; null for the webhook, which acts for nobody. */
export function supabaseStore(asPlayer: SupabaseClient | null, admin: SupabaseClient): Store {
  const player = (): SupabaseClient => {
    if (!asPlayer) throw new Error('no player session');
    return asPlayer;
  };
  return {
    async begin() {
      const { data, error } = await player().rpc('start_manipulation').select(COLUMNS).single();
      check(error);
      return data as Manipulation;
    },
    async mine() {
      const { data, error } = await player().from('manipulations').select(COLUMNS).neq('status', 'expired').maybeSingle();
      check(error);
      return data;
    },
    async pending() {
      const { data, error } = await admin.from('manipulations').select(COLUMNS).eq('status', 'pending').not('charge_id', 'is', null);
      check(error);
      return data ?? [];
    },
    async attach(id: string, pix: Pix) {
      const { data, error } = await admin
        .from('manipulations')
        .update({ charge_id: pix.id, br_code: pix.brCode, qr_code: pix.qrCode, expires_at: pix.expiresAt })
        .eq('id', id)
        .eq('status', 'pending')
        .is('charge_id', null)
        .select('id');
      check(error);
      // Another start replaced this row meanwhile: its Pix must not be shown, since nothing would record its payment.
      if (!data?.length) throw new Error('manipulation no longer pending; try again');
    },
    async settle(id, status) {
      const { error } = await admin
        .from('manipulations')
        .update({ status, paid_at: status === 'paid' ? new Date().toISOString() : null })
        .eq('id', id)
        .eq('status', 'pending');
      check(error);
    },
  };
}
