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
    ).toEqual({ supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'key', allowedDomain: 'acme.com', pix: undefined });
  });

  it('R1.1 reads the Pix receiver only when key, name and city are all set', () => {
    const base = { VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' };
    expect(readConfig({ ...base, VITE_PIX_KEY: ' 12345678901 ', VITE_PIX_NAME: 'Bernardo', VITE_PIX_CITY: 'Sao Paulo' })?.pix).toEqual({
      key: '12345678901',
      name: 'Bernardo',
      city: 'Sao Paulo',
    });
    expect(readConfig({ ...base, VITE_PIX_KEY: '12345678901', VITE_PIX_NAME: 'Bernardo' })?.pix).toBeUndefined();
    expect(readConfig(base)?.pix).toBeUndefined();
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
