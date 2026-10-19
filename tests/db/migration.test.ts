import type { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import { anon, as, freshDatabase, player, unconfirmed } from './harness';

const ADMIN = 'admin@acme.com';
const ANA = 'ana@acme.com';
const BRUNO = 'bruno@acme.com';
const CAIO = 'caio@acme.com';
const STRANGER = 'stranger@acme.com';

let db: PGlite;
let ids: Record<string, string>;

// Seeds as the database owner, the way the first admin is bootstrapped in the SQL editor.
async function seed(): Promise<void> {
  const rows = await db.query<{ id: string; email: string }>(
    `insert into players (name, email, is_admin) values
       ('Admin', $1, true), ('Ana', $2, false), ('Bruno', $3, false), ('Caio', $4, false)
     returning id, email`,
    [ADMIN, ANA, BRUNO, CAIO],
  );
  ids = Object.fromEntries(rows.rows.map((r) => [r.email, r.id]));
}

function id(email: string): string {
  const value = ids[email];
  if (value === undefined) throw new Error(`no seeded player ${email}`);
  return value;
}

async function rate(rater: string, rated: string, value: number): Promise<void> {
  await as(db, player(rater), (tx) =>
    tx.query(
      `insert into ratings (rater_id, rated_id, value) values ($1, $2, $3)
       on conflict (rater_id, rated_id) do update set value = excluded.value`,
      [id(rater), id(rated), value],
    ),
  );
}

async function count(sql: string, params: unknown[] = []): Promise<number> {
  const r = await db.query<{ n: number }>(`select count(*)::int as n from (${sql}) q`, params);
  return r.rows[0]?.n ?? 0;
}

beforeEach(async () => {
  db = await freshDatabase();
  await seed();
});

describe('R1.3 account creation is limited to registered players', () => {
  it('refuses to create an auth account for an unregistered email', async () => {
    await expect(db.query(`insert into auth.users (email) values ($1)`, [STRANGER])).rejects.toThrow();
  });

  it('creates the account for a registered email, whatever its case', async () => {
    await db.query(`insert into auth.users (email) values ($1)`, ['Ana@Acme.com']);
    expect(await count(`select 1 from auth.users`)).toBe(1);
  });
});

describe('R1.3 R1.7 accounts change only within the allowlist, and never keep a password', () => {
  const storedPassword = async (): Promise<string | null | undefined> =>
    (await db.query<{ p: string | null }>(`select encrypted_password as p from auth.users`)).rows[0]?.p;

  it('creates the account an access-code login makes, discarding the temporary password GoTrue sets', async () => {
    await db.query(`insert into auth.users (email, encrypted_password) values ($1, '$2a$10$randomhash')`, [ANA]);
    expect(await storedPassword()).toBe('');
  });

  it('discards a password given to an existing account', async () => {
    await db.query(`insert into auth.users (email) values ($1)`, [ANA]);
    await db.query(`update auth.users set encrypted_password = 'attacker-hash'`);
    expect(await storedPassword()).toBe('');
  });

  it('refuses moving an account to an unregistered email', async () => {
    await db.query(`insert into auth.users (email) values ($1)`, [ANA]);
    await expect(db.query(`update auth.users set email = $1`, [STRANGER])).rejects.toThrow();
  });
});

describe('R1.5 sessions that are not a player see nothing', () => {
  it('returns nothing to an account whose email is not yet confirmed', async () => {
    await rate(ANA, BRUNO, 8);
    const seen = await as(db, unconfirmed(CAIO), async (tx) => ({
      players: (await tx.query(`select * from players`)).rows.length,
      ratings: (await tx.query(`select * from ratings`)).rows.length,
      ranking: (await tx.query(`select * from ranking()`)).rows.length,
    }));
    expect(seen).toEqual({ players: 0, ratings: 0, ranking: 0 });
  });

  it('identifies the session by its account, not by an email claim it carries', async () => {
    const caio = await as(db, player(CAIO), async (tx) =>
      (await tx.query<{ sub: string }>(`select auth.uid()::text as sub`)).rows[0]?.sub,
    );
    // Caio's account presenting a token whose email claim says Ana.
    const forged = await db.transaction(async (tx) => {
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ role: 'authenticated', email: ANA, sub: caio }),
      ]);
      await tx.exec(`set local role authenticated`);
      return (await tx.query<{ id: string | null }>(`select current_player_id() as id`)).rows[0]?.id;
    });
    expect(forged).toBe(id(CAIO));
  });

  it('returns no players, ratings, or ranking to an authenticated non-player', async () => {
    await rate(ANA, BRUNO, 8);
    const seen = await as(db, player(STRANGER), async (tx) => ({
      players: (await tx.query(`select * from players`)).rows.length,
      ratings: (await tx.query(`select * from ratings`)).rows.length,
      ranking: (await tx.query(`select * from ranking()`)).rows.length,
    }));
    expect(seen).toEqual({ players: 0, ratings: 0, ranking: 0 });
  });

  it('denies the anonymous role outright', async () => {
    await expect(as(db, anon, (tx) => tx.query(`select * from players`))).rejects.toThrow();
    await expect(as(db, anon, (tx) => tx.query(`select * from ratings`))).rejects.toThrow();
    await expect(as(db, anon, (tx) => tx.query(`select * from ranking()`))).rejects.toThrow();
  });

  it('lets a player see the team', async () => {
    const n = await as(db, player(ANA), async (tx) => (await tx.query(`select * from players`)).rows.length);
    expect(n).toBe(4);
  });
});

describe('R2 player management', () => {
  it('R2.1 lets an admin register a player', async () => {
    await as(db, player(ADMIN), (tx) =>
      tx.query(`insert into players (name, email) values ('Duda', 'duda@acme.com')`),
    );
    expect(await count(`select 1 from players where email = 'duda@acme.com'`)).toBe(1);
  });

  it('R2.2 removing a player removes every rating given or received by them', async () => {
    await rate(ANA, BRUNO, 8);
    await rate(BRUNO, ANA, 6);
    await rate(CAIO, ANA, 7);
    await as(db, player(ADMIN), (tx) => tx.query(`delete from players where id = $1`, [id(BRUNO)]));
    expect(await count(`select 1 from players where id = $1`, [id(BRUNO)])).toBe(0);
    expect(await count(`select 1 from ratings`)).toBe(1);
  });

  it('R2.3 rejects a non-admin creating a player', async () => {
    await expect(
      as(db, player(ANA), (tx) => tx.query(`insert into players (name, email) values ('X', 'x@acme.com')`)),
    ).rejects.toThrow();
  });

  it('R2.3 a non-admin cannot change or remove a player', async () => {
    await as(db, player(ANA), async (tx) => {
      await tx.query(`update players set name = 'Hacked', is_admin = true where id = $1`, [id(BRUNO)]);
      await tx.query(`update players set is_admin = true where id = $1`, [id(ANA)]);
      await tx.query(`delete from players where id = $1`, [id(CAIO)]);
    });
    const r = await db.query<{ name: string; is_admin: boolean }>(
      `select name, is_admin from players where email in ($1, $2, $3) order by name`,
      [ANA, BRUNO, CAIO],
    );
    expect(r.rows).toEqual([
      { name: 'Ana', is_admin: false },
      { name: 'Bruno', is_admin: false },
      { name: 'Caio', is_admin: false },
    ]);
  });

  it('R2.5 rejects changing a player\'s email, admins included', async () => {
    await expect(
      as(db, player(ADMIN), (tx) => tx.query(`update players set email = 'me-too@acme.com' where id = $1`, [id(BRUNO)])),
    ).rejects.toThrow();
    await as(db, player(ADMIN), (tx) => tx.query(`update players set name = 'Bruno S.' where id = $1`, [id(BRUNO)]));
    expect(await count(`select 1 from players where name = 'Bruno S.' and email = $1`, [BRUNO])).toBe(1);
  });

  it('R2.5 an admin cannot change a player\'s id either', async () => {
    await expect(
      as(db, player(ADMIN), (tx) => tx.query(`update players set id = gen_random_uuid() where id = $1`, [id(BRUNO)])),
    ).rejects.toThrow();
  });

  it('R2.6 an admin cannot remove themselves', async () => {
    await as(db, player(ADMIN), (tx) => tx.query(`delete from players where id = $1`, [id(ADMIN)]));
    expect(await count(`select 1 from players where id = $1`, [id(ADMIN)])).toBe(1);
  });

  it('rejects a name spanning lines, which would break the copied ranking', async () => {
    await expect(
      as(db, player(ADMIN), (tx) => tx.query(`insert into players (name, email) values ($1, 'x@acme.com')`, ['Ana\nBruno - 10'])),
    ).rejects.toThrow();
  });

  it('R2.4 rejects an email that already belongs to a player', async () => {
    await expect(
      as(db, player(ADMIN), (tx) => tx.query(`insert into players (name, email) values ('Ana 2', $1)`, [ANA])),
    ).rejects.toThrow();
  });

  it('R2.4 rejects a differently-cased duplicate email', async () => {
    await expect(
      as(db, player(ADMIN), (tx) => tx.query(`insert into players (name, email) values ('Ana 2', 'ANA@acme.com')`)),
    ).rejects.toThrow();
  });
});

describe('R3 ratings', () => {
  it('R3.1 accepts whole numbers from 1 to 10 and rejects anything outside', async () => {
    await rate(ANA, BRUNO, 1);
    await rate(ANA, CAIO, 10);
    await expect(rate(ANA, BRUNO, 0)).rejects.toThrow();
    await expect(rate(ANA, BRUNO, 11)).rejects.toThrow();
  });

  it('R3.2 rating someone again replaces the previous rating', async () => {
    await rate(ANA, BRUNO, 4);
    await rate(ANA, BRUNO, 9);
    const r = await db.query<{ value: number }>(`select value from ratings`);
    expect(r.rows).toEqual([{ value: 9 }]);
  });

  it('R3.3 rejects saving a rating in another player\'s name', async () => {
    await expect(
      as(db, player(ANA), (tx) =>
        tx.query(`insert into ratings (rater_id, rated_id, value) values ($1, $2, 10)`, [id(BRUNO), id(CAIO)]),
      ),
    ).rejects.toThrow();
  });

  it('R3.3 cannot change or delete another player\'s rating, nor reassign one\'s own', async () => {
    await rate(BRUNO, CAIO, 3);
    await rate(ANA, CAIO, 5);
    await as(db, player(ANA), async (tx) => {
      await tx.query(`update ratings set value = 10 where rater_id = $1`, [id(BRUNO)]);
      await tx.query(`delete from ratings where rater_id = $1`, [id(BRUNO)]);
    });
    await expect(
      as(db, player(ANA), (tx) =>
        tx.query(`update ratings set rater_id = $1 where rater_id = $2`, [id(ADMIN), id(ANA)]),
      ),
    ).rejects.toThrow();
    const r = await db.query<{ rater_id: string; value: number }>(
      `select rater_id, value from ratings order by value`,
    );
    expect(r.rows).toEqual([
      { rater_id: id(BRUNO), value: 3 },
      { rater_id: id(ANA), value: 5 },
    ]);
  });

  it('R3.4 rejects a player rating themselves', async () => {
    await expect(rate(ANA, ANA, 10)).rejects.toThrow();
  });

  it('R3.5 a rating is visible only to the player who gave it, admins included', async () => {
    await rate(ANA, BRUNO, 8);
    const visible = async (email: string): Promise<number> =>
      as(db, player(email), async (tx) => (await tx.query(`select * from ratings`)).rows.length);
    expect(await visible(ANA)).toBe(1);
    expect(await visible(BRUNO)).toBe(0);
    expect(await visible(ADMIN)).toBe(0);
  });
});

describe('R4.1 ranking', () => {
  it('orders by average rating rounded to one decimal, unrated players last', async () => {
    await rate(ANA, BRUNO, 7);
    await rate(CAIO, BRUNO, 8); // Bruno 7.5
    await rate(BRUNO, ANA, 9);
    await rate(CAIO, ANA, 9);
    await rate(ADMIN, ANA, 8); // Ana 8.666… -> 8.7
    const r = await as(db, player(CAIO), (tx) =>
      tx.query<{ name: string; average: string | null; ratings_count: number }>(
        `select name, average::text as average, ratings_count from ranking()`,
      ),
    );
    expect(r.rows).toEqual([
      { name: 'Ana', average: '8.7', ratings_count: 3 },
      { name: 'Bruno', average: '7.5', ratings_count: 2 },
      { name: 'Admin', average: null, ratings_count: 0 },
      { name: 'Caio', average: null, ratings_count: 0 },
    ]);
  });

  it('R3.6 stops counting a rating its rater cleared', async () => {
    await rate(ANA, BRUNO, 2);
    await rate(CAIO, BRUNO, 8);
    await as(db, player(ANA), (tx) =>
      tx.query(`delete from ratings where rater_id = $1 and rated_id = $2`, [id(ANA), id(BRUNO)]),
    );
    const r = await as(db, player(CAIO), (tx) =>
      tx.query<{ name: string; average: string | null; ratings_count: number }>(
        `select name, average::text as average, ratings_count from ranking() where name = 'Bruno'`,
      ),
    );
    expect(r.rows).toEqual([{ name: 'Bruno', average: '8.0', ratings_count: 1 }]);
  });
});
