// The project's URL and API keys as the Edge runtime provides them. Projects on the new
// API keys get SUPABASE_PUBLISHABLE_KEYS / SUPABASE_SECRET_KEYS (JSON maps of name to
// key); older ones only the legacy SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY JWTs.

export interface SupabaseKeys {
  url: string;
  /** Sent as apikey alongside the player's JWT. */
  publishable: string;
  /** The service role: bypasses row-level security. */
  secret: string;
}

type Get = (name: string) => string | undefined;

function fromMap(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const map = JSON.parse(raw) as unknown;
    if (typeof map !== 'object' || map === null) return undefined;
    const keys = map as Record<string, unknown>;
    const key = keys.default ?? Object.values(keys)[0];
    return typeof key === 'string' && key !== '' ? key : undefined;
  } catch {
    return undefined;
  }
}

export function required(get: Get, name: string): string {
  const value = get(name);
  if (!value) throw new Error(`missing secret ${name}`);
  return value;
}

/** Prefers the new keys, falling back to the legacy ones; throws naming what is missing. */
export function supabaseKeys(get: Get): SupabaseKeys {
  return {
    url: required(get, 'SUPABASE_URL'),
    publishable: fromMap(get('SUPABASE_PUBLISHABLE_KEYS')) ?? required(get, 'SUPABASE_ANON_KEY'),
    secret: fromMap(get('SUPABASE_SECRET_KEYS')) ?? required(get, 'SUPABASE_SERVICE_ROLE_KEY'),
  };
}
