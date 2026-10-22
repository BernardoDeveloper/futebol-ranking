// Deno glue for `manipular`, deployed with --no-verify-jwt: the gateway's check does not
// support the project's asymmetric JWT keys. The player's JWT is still verified, by
// PostgREST, on every query the store makes with it; the logic is in ../_shared.
import { createClient } from '@supabase/supabase-js';
import { abacatePay } from '../_shared/abacatepay.ts';
import { required, supabaseKeys } from '../_shared/env.ts';
import { manipularHandler } from '../_shared/http.ts';
import { supabaseStore } from '../_shared/store.ts';

const get = (name: string): string | undefined => Deno.env.get(name);
const keys = supabaseKeys(get);
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(keys.url, keys.secret, options);

Deno.serve(
  manipularHandler({
    gateway: abacatePay(required(get, 'ABACATEPAY_API_KEY')),
    store: (authorization) =>
      supabaseStore(createClient(keys.url, keys.publishable, { ...options, global: { headers: { Authorization: authorization } } }), admin),
  }),
);
