import { describe, expect, it } from 'vitest';
import { as, freshDatabase, player } from './harness';

describe('Supabase stub', () => {
  it('exposes the session email through auth.jwt() as the authenticated role', async () => {
    const db = await freshDatabase({ migrate: false });
    const row = await as(db, player('ana@acme.com'), async (tx) => {
      const r = await tx.query<{ email: string; role: string }>(
        `select auth.jwt() ->> 'email' as email, current_user as role`,
      );
      return r.rows[0];
    });
    expect(row).toEqual({ email: 'ana@acme.com', role: 'authenticated' });
  });
});
