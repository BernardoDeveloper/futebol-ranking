import { describe, expect, it } from 'vitest';
import { required, supabaseKeys } from '../../supabase/functions/_shared/env';

const from = (vars: Record<string, string>) => (name: string): string | undefined => vars[name];

describe('supabaseKeys', () => {
  it('prefers the new publishable and secret keys', () => {
    const keys = supabaseKeys(
      from({
        SUPABASE_URL: 'https://x.supabase.co',
        SUPABASE_PUBLISHABLE_KEYS: '{"default":"sb_publishable_a"}',
        SUPABASE_SECRET_KEYS: '{"default":"sb_secret_b"}',
        SUPABASE_ANON_KEY: 'legacy-anon',
        SUPABASE_SERVICE_ROLE_KEY: 'legacy-service',
      }),
    );
    expect(keys).toEqual({ url: 'https://x.supabase.co', publishable: 'sb_publishable_a', secret: 'sb_secret_b' });
  });

  it('takes the first key of a map without a default', () => {
    const keys = supabaseKeys(
      from({ SUPABASE_URL: 'u', SUPABASE_PUBLISHABLE_KEYS: '{"web":"sb_publishable_w"}', SUPABASE_SECRET_KEYS: '{"edge":"sb_secret_e"}' }),
    );
    expect(keys).toMatchObject({ publishable: 'sb_publishable_w', secret: 'sb_secret_e' });
  });

  it('falls back to the legacy keys when the new ones are absent or unreadable', () => {
    const keys = supabaseKeys(
      from({ SUPABASE_URL: 'u', SUPABASE_PUBLISHABLE_KEYS: 'not json', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service' }),
    );
    expect(keys).toMatchObject({ publishable: 'anon', secret: 'service' });
  });

  it('names the missing secret', () => {
    expect(() => supabaseKeys(from({ SUPABASE_URL: 'u', SUPABASE_ANON_KEY: 'anon' }))).toThrow('missing secret SUPABASE_SERVICE_ROLE_KEY');
    expect(() => required(from({}), 'ABACATEPAY_API_KEY')).toThrow('missing secret ABACATEPAY_API_KEY');
  });
});
