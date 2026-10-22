// Deno glue for `manipular`; the logic is in ../_shared, tested in Node.
import { createClient } from '@supabase/supabase-js';
import { abacatePay } from '../_shared/abacatepay.ts';
import { manipularHandler } from '../_shared/http.ts';
import { supabaseStore } from '../_shared/store.ts';

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing secret ${name}`);
  return value;
}

const url = env('SUPABASE_URL');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), options);

Deno.serve(
  manipularHandler({
    gateway: abacatePay(env('ABACATEPAY_API_KEY')),
    store: (authorization) =>
      supabaseStore(createClient(url, env('SUPABASE_ANON_KEY'), { ...options, global: { headers: { Authorization: authorization } } }), admin),
  }),
);
