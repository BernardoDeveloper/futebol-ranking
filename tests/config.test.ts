import { describe, expect, it } from 'vitest';
import { readConfig } from '../src/config';

describe('readConfig', () => {
  it('reads the Supabase settings and the allowed domain', () => {
    expect(
      readConfig({
        VITE_SUPABASE_URL: ' https://x.supabase.co ',
        VITE_SUPABASE_ANON_KEY: 'key',
        VITE_ALLOWED_EMAIL_DOMAIN: 'acme.com',
      }),
    ).toEqual({ supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'key', allowedDomain: 'acme.com' });
  });

  it('leaves the domain unset when it is blank (R1.4 is optional)', () => {
    const config = readConfig({ VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k', VITE_ALLOWED_EMAIL_DOMAIN: ' ' });
    expect(config?.allowedDomain).toBeUndefined();
  });

  it('is null while Supabase is not configured', () => {
    expect(readConfig({})).toBeNull();
    expect(readConfig({ VITE_SUPABASE_URL: 'u' })).toBeNull();
  });
});
