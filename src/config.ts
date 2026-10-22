import type { PixReceiver } from './pix';

export interface Config {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Where set, players type only the part of their email before the `@` (R1.4). */
  allowedDomain: string | undefined;
  /** Where set, a player may pay the Manipulados Pix to this key (specs/manipulados R1.1). */
  pix: PixReceiver | undefined;
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
  const pix = { key: text('VITE_PIX_KEY'), name: text('VITE_PIX_NAME'), city: text('VITE_PIX_CITY') };
  return {
    supabaseUrl,
    supabaseAnonKey,
    allowedDomain: text('VITE_ALLOWED_EMAIL_DOMAIN') || undefined,
    pix: pix.key && pix.name && pix.city ? pix : undefined,
  };
}
