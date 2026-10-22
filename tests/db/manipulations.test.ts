import type { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import { anon, as, freshDatabase, player, service, unconfirmed } from './harness';

const ANA = 'ana@acme.com';
const BRUNO = 'bruno@acme.com';
const CAIO = 'caio@acme.com';
const STRANGER = 'stranger@acme.com';

interface Row {
  id: string;
  player_id: string;
  status: string;
  charge_id: string | null;
}

let db: PGlite;
let ids: Record<string, string>;

function id(email: string): string {
  const value = ids[email];
  if (value === undefined) throw new Error(`no seeded player ${email}`);
  return value;
}

async function rate(rater: string, rated: string, value: number): Promise<void> {
  await db.query(`insert into ratings (rater_id, rated_id, value) values ($1, $2, $3)`, [id(rater), id(rated), value]);
}

async function start(email: string): Promise<Row> {
  const r = await as(db, player(email), (tx) =>
    tx.query<Row>(`select id, player_id, status, charge_id from start_manipulation()`),
  );
  const row = r.rows[0];
  if (!row) throw new Error('start_manipulation returned nothing');
  return row;
}

// What the Edge Function does with the service-role key once AbacatePay created the Pix.
async function attach(rowId: string, chargeId: string, expiresAt = `now() + interval '30 minutes'`): Promise<void> {
  await as(db, service, (tx) =>
    tx.query(
      `update manipulations set charge_id = $2, br_code = 'br', qr_code = 'qr', expires_at = ${expiresAt} where id = $1`,
      [rowId, chargeId],
    ),
  );
}

async function markPaid(rowId: string): Promise<void> {
  await as(db, service, (tx) =>
    tx.query(`update manipulations set status = 'paid', paid_at = now() where id = $1 and status = 'pending'`, [rowId]),
  );
}

async function statuses(): Promise<{ id: string; status: string }[]> {
  return (await db.query<{ id: string; status: string }>(`select id, status from manipulations order by created_at`)).rows;
}

beforeEach(async () => {
  db = await freshDatabase();
  const rows = await db.query<{ id: string; email: string }>(
    `insert into players (name, email) values ('Ana', $1), ('Bruno', $2), ('Caio', $3) returning id, email`,
    [ANA, BRUNO, CAIO],
  );
  ids = Object.fromEntries(rows.rows.map((r) => [r.email, r.id]));
});

describe('start_manipulation()', () => {
  it('R1.2 opens a pending manipulation for the calling player', async () => {
    const row = await start(ANA);
    expect(row).toMatchObject({ player_id: id(ANA), status: 'pending', charge_id: null });
  });

  it('R1.6 returns the same pending manipulation while its charge has not expired', async () => {
    const first = await start(ANA);
    await attach(first.id, 'pix_char_1');
    const again = await start(ANA);
    expect(again).toMatchObject({ id: first.id, charge_id: 'pix_char_1' });
    expect(await statuses()).toHaveLength(1);
  });

  it('R1.6 expires a pending manipulation whose charge has expired and opens a new one', async () => {
    const first = await start(ANA);
    await attach(first.id, 'pix_char_1', `now() - interval '1 minute'`);
    const again = await start(ANA);
    expect(again.id).not.toBe(first.id);
    expect(await statuses()).toEqual([
      { id: first.id, status: 'expired' },
      { id: again.id, status: 'pending' },
    ]);
  });

  it('R1.6 replaces a pending manipulation that never got a charge', async () => {
    const first = await start(ANA);
    const again = await start(ANA);
    expect(again.id).not.toBe(first.id);
    expect(await statuses()).toEqual([{ id: again.id, status: 'pending' }]);
  });

  it('R1.5 refuses a player who already has a paid manipulation', async () => {
    const first = await start(ANA);
    await attach(first.id, 'pix_char_1');
    await markPaid(first.id);
    await expect(start(ANA)).rejects.toThrow(/already manipulated/);
    expect(await statuses()).toEqual([{ id: first.id, status: 'paid' }]);
  });

  it('R1.8 refuses a session that is not a confirmed registered player', async () => {
    await expect(
      as(db, unconfirmed(ANA), (tx) => tx.query(`select * from start_manipulation()`)),
    ).rejects.toThrow();
    await expect(
      as(db, player(STRANGER), (tx) => tx.query(`select * from start_manipulation()`)),
    ).rejects.toThrow();
    await expect(as(db, anon, (tx) => tx.query(`select * from start_manipulation()`))).rejects.toThrow();
    expect(await statuses()).toEqual([]);
  });

  it('R1.5 allows at most one pending or paid manipulation per player', async () => {
    const first = await start(ANA);
    await expect(
      db.query(`insert into manipulations (player_id) values ($1)`, [first.player_id]),
    ).rejects.toThrow();
  });
});

describe('R1.8 manipulations row-level security', () => {
  it('lets a player read only their own manipulations', async () => {
    await start(ANA);
    await start(BRUNO);
    const visible = await as(db, player(ANA), (tx) => tx.query<{ player_id: string }>(`select player_id from manipulations`));
    expect(visible.rows).toEqual([{ player_id: id(ANA) }]);
    await expect(as(db, anon, (tx) => tx.query(`select * from manipulations`))).rejects.toThrow();
  });

  it('rejects a player creating, changing or deleting a manipulation, their own included', async () => {
    const row = await start(ANA);
    await expect(
      as(db, player(BRUNO), (tx) => tx.query(`insert into manipulations (player_id, status) values ($1, 'paid')`, [id(BRUNO)])),
    ).rejects.toThrow();
    await expect(
      as(db, player(ANA), (tx) => tx.query(`update manipulations set status = 'paid' where id = $1`, [row.id])),
    ).rejects.toThrow();
    await expect(
      as(db, player(ANA), (tx) => tx.query(`delete from manipulations where id = $1`, [row.id])),
    ).rejects.toThrow();
    expect(await statuses()).toEqual([{ id: row.id, status: 'pending' }]);
  });

  it('lets the service role attach a charge and mark it paid', async () => {
    const row = await start(ANA);
    await attach(row.id, 'pix_char_1');
    await markPaid(row.id);
    expect(await statuses()).toEqual([{ id: row.id, status: 'paid' }]);
  });
});

describe('manipulated_ranking()', () => {
  async function manipulate(email: string): Promise<void> {
    const row = await start(email);
    await attach(row.id, `pix_${email}`);
    await markPaid(row.id);
  }

  async function manipulatedRanking(email: string) {
    const r = await as(db, player(email), (tx) =>
      tx.query<{ name: string; average: string | null; manipulated: boolean }>(
        `select name, average::text as average, manipulated from manipulated_ranking()`,
      ),
    );
    return r.rows;
  }

  it('R2.1 adds 3 to the average rating of a player with a paid manipulation and reorders', async () => {
    await rate(ANA, BRUNO, 6);
    await rate(CAIO, BRUNO, 7); // Bruno 6.5
    await rate(BRUNO, ANA, 5); // Ana 5.0, manipulated 8.0
    await rate(ANA, CAIO, 9); // Caio 9.0
    await manipulate(ANA);
    expect(await manipulatedRanking(BRUNO)).toEqual([
      { name: 'Caio', average: '9.0', manipulated: false },
      { name: 'Ana', average: '8.0', manipulated: true },
      { name: 'Bruno', average: '6.5', manipulated: false },
    ]);
  });

  it('R2.2 gives an unrated manipulated player 3, and keeps other unrated players last', async () => {
    await rate(ANA, BRUNO, 2);
    await manipulate(CAIO);
    expect(await manipulatedRanking(ANA)).toEqual([
      { name: 'Caio', average: '3.0', manipulated: true },
      { name: 'Bruno', average: '2.0', manipulated: false },
      { name: 'Ana', average: null, manipulated: false },
    ]);
  });

  it('R2.1 ignores pending and expired manipulations', async () => {
    await rate(BRUNO, ANA, 5);
    const row = await start(ANA);
    await attach(row.id, 'pix_char_1');
    expect(await manipulatedRanking(BRUNO)).toContainEqual({ name: 'Ana', average: '5.0', manipulated: false });
  });

  it('R2.4 leaves the official ranking unchanged', async () => {
    await rate(BRUNO, ANA, 5);
    await manipulate(ANA);
    const r = await as(db, player(BRUNO), (tx) =>
      tx.query<{ average: string }>(`select average::text as average from ranking() where name = 'Ana'`),
    );
    expect(r.rows).toEqual([{ average: '5.0' }]);
  });

  it('R1.8 returns nothing to a session that is not a registered player', async () => {
    await manipulate(ANA);
    expect(await manipulatedRanking(STRANGER)).toEqual([]);
    await expect(as(db, anon, (tx) => tx.query(`select * from manipulated_ranking()`))).rejects.toThrow();
  });
});
