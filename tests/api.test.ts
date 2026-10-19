import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { addPlayerError, requestCodeError, supabaseApi } from '../src/api';
import type { Database } from '../src/database';

interface Call {
  path: string;
  args: unknown[];
}

// Records every call made through supabase-js's fluent API and resolves to `result`.
function fakeClient(result: { data?: unknown; error?: unknown } = {}) {
  const calls: Call[] = [];
  const settled = { data: result.data ?? null, error: result.error ?? null };
  const chain = (path: string): unknown =>
    new Proxy(() => undefined, {
      get(_target, key) {
        if (key === 'then') {
          return (resolve: (v: unknown) => void) => {
            resolve(settled);
          };
        }
        return chain(`${path}.${String(key)}`);
      },
      apply(_target, _this, args: unknown[]) {
        calls.push({ path, args });
        return chain(path);
      },
    });
  return { client: chain('client') as SupabaseClient<Database>, calls };
}

describe('supabaseApi', () => {
  it('R1.1 asks Supabase to email an access code, creating the account on first login', async () => {
    const { client, calls } = fakeClient();
    await supabaseApi(client).requestCode('ana@acme.com');
    expect(calls).toContainEqual({
      path: 'client.auth.signInWithOtp',
      args: [{ email: 'ana@acme.com', options: { shouldCreateUser: true } }],
    });
  });

  it('R1.1 explains a refusal for an unregistered email', async () => {
    const { client } = fakeClient({ error: { message: 'Database error saving new user', status: 500 } });
    await expect(supabaseApi(client).requestCode('x@acme.com')).rejects.toThrow(/não está cadastrado/);
  });

  it('R1.2 verifies the access code as an email OTP', async () => {
    const { client, calls } = fakeClient();
    await supabaseApi(client).verifyCode('ana@acme.com', '123456');
    expect(calls).toContainEqual({
      path: 'client.auth.verifyOtp',
      args: [{ email: 'ana@acme.com', token: '123456', type: 'email' }],
    });
  });

  it('R1.2 reports a wrong access code', async () => {
    const { client } = fakeClient({ error: { message: 'Token has expired or is invalid', status: 403 } });
    await expect(supabaseApi(client).verifyCode('ana@acme.com', '000000')).rejects.toThrow('Código inválido ou expirado.');
  });

  it('R1.6 signs out', async () => {
    const { client, calls } = fakeClient();
    await supabaseApi(client).signOut();
    expect(calls.map((c) => c.path)).toContain('client.auth.signOut');
  });

  it('R3.2 saves a rating as an upsert on the rater/rated pair', async () => {
    const { client, calls } = fakeClient();
    await supabaseApi(client).rate('a', 'b', 7);
    expect(calls).toContainEqual({
      path: 'client.from.upsert',
      args: [{ rater_id: 'a', rated_id: 'b', value: 7 }, { onConflict: 'rater_id,rated_id' }],
    });
  });

  it('R3.6 clears a rating by deleting the rater/rated pair', async () => {
    const { client, calls } = fakeClient();
    await supabaseApi(client).clearRating('a', 'b');
    expect(calls).toContainEqual({ path: 'client.from', args: ['ratings'] });
    expect(calls).toContainEqual({ path: 'client.from.delete.eq', args: ['rater_id', 'a'] });
    expect(calls).toContainEqual({ path: 'client.from.delete.eq.eq', args: ['rated_id', 'b'] });
  });

  it('indexes the signed-in player\'s ratings by rated player', async () => {
    const { client } = fakeClient({ data: [{ rated_id: 'b', value: 7 }] });
    expect(await supabaseApi(client).myRatings()).toEqual(new Map([['b', 7]]));
  });

  it('R4.1 reads the ranking from the ranking() function', async () => {
    const rows = [{ player_id: 'a', name: 'Ana', average: 8, ratings_count: 1 }];
    const { client, calls } = fakeClient({ data: rows });
    expect(await supabaseApi(client).ranking()).toEqual(rows);
    expect(calls).toContainEqual({ path: 'client.rpc', args: ['ranking'] });
  });

  it('R2.2 removes a player by id', async () => {
    const { client, calls } = fakeClient();
    await supabaseApi(client).removePlayer('p1');
    expect(calls).toContainEqual({ path: 'client.from.delete.eq', args: ['id', 'p1'] });
  });

  it('R2.4 explains a duplicate email when registering', async () => {
    const { client } = fakeClient({ error: { message: 'duplicate key', code: '23505' } });
    await expect(supabaseApi(client).addPlayer('Ana', 'ana@acme.com')).rejects.toThrow('Já existe um jogador com este email.');
  });
});

describe('error messages', () => {
  it('requestCodeError distinguishes rate limiting from an unregistered email', () => {
    expect(requestCodeError({ message: 'x', status: 429 })).toMatch(/Aguarde/);
    expect(requestCodeError({ message: 'Database error saving new user' })).toMatch(/não está cadastrado/);
    expect(requestCodeError({ message: 'boom', status: 400 })).toMatch(/boom/);
  });

  it('requestCodeError does not blame registration for an unrelated server failure', () => {
    expect(requestCodeError({ message: 'Error sending magic link email', status: 500 })).not.toMatch(/cadastrado/);
  });

  it('addPlayerError explains duplicates and missing permission', () => {
    expect(addPlayerError({ message: '', code: '23505' })).toMatch(/Já existe/);
    expect(addPlayerError({ message: '', code: '42501' })).toMatch(/Só admins/);
  });
});
