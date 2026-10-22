// Deno glue for `abacatepay-webhook`, deployed with --no-verify-jwt: AbacatePay sends no
// Supabase JWT, the ?webhookSecret= check in ../_shared/http.ts is the gate.
import { createClient } from '@supabase/supabase-js';
import { abacatePay } from '../_shared/abacatepay.ts';
import { required, supabaseKeys } from '../_shared/env.ts';
import { webhookHandler } from '../_shared/http.ts';
import { reconcile } from '../_shared/manipulation.ts';
import { supabaseStore } from '../_shared/store.ts';

const get = (name: string): string | undefined => Deno.env.get(name);
const keys = supabaseKeys(get);
const admin = createClient(keys.url, keys.secret, { auth: { persistSession: false, autoRefreshToken: false } });
const store = supabaseStore(null, admin);
const gateway = abacatePay(required(get, 'ABACATEPAY_API_KEY'));

Deno.serve(webhookHandler({ secret: required(get, 'ABACATEPAY_WEBHOOK_SECRET'), reconcile: () => reconcile(store, gateway) }));
