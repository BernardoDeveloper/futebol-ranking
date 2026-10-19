export interface Config {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Where set, players type only the part of their email before the `@` (R1.4). */
  allowedDomain: string | undefined;
}

/** Reads the build-time settings; null when Supabase is not configured. */
export function readConfig(env: Record<string, unknown>): Config | null {
  const text = (key: string): string => {
    const value = env[key];
    return typeof value === 'string' ? value.trim() : '';
  };
  const supabaseUrl = text('VITE_SUPABASE_URL');
  const supabaseAnonKey = text('VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return { supabaseUrl, supabaseAnonKey, allowedDomain: text('VITE_ALLOWED_EMAIL_DOMAIN') || undefined };
}
