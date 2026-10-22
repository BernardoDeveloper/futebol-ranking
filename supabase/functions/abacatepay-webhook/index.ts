// Deno glue for `abacatepay-webhook`, deployed with --no-verify-jwt: AbacatePay sends no
// Supabase JWT, the ?webhookSecret= check in ../_shared/http.ts is the gate.
import { createClient } from '@supabase/supabase-js';
import { abacatePay } from '../_shared/abacatepay.ts';
import { webhookHandler } from '../_shared/http.ts';
import { reconcile } from '../_shared/manipulation.ts';
import { supabaseStore } from '../_shared/store.ts';

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing secret ${name}`);
  return value;
}

const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const store = supabaseStore(null, admin);
const gateway = abacatePay(env('ABACATEPAY_API_KEY'));

Deno.serve(webhookHandler({ secret: env('ABACATEPAY_WEBHOOK_SECRET'), reconcile: () => reconcile(store, gateway) }));
