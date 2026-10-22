import type { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import { anon, as, freshDatabase, player, unconfirmed } from './harness';

const ADMIN = 'admin@acme.com';
const ANA = 'ana@acme.com';
const BRUNO = 'bruno@acme.com';
const CAIO = 'caio@acme.com';
const STRANGER = 'stranger@acme.com';

interface Row {
  id: string;
  player_id: string;
  status: string;
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
  const r = await as(db, player(email), (tx) => tx.query<Row>(`select id, player_id, status from start_manipulation()`));
  const row = r.rows[0];
  if (!row) throw new Error('start_manipulation returned nothing');
  return row;
}

async function decide(email: string, verb: 'confirm' | 'reject', rowId: string): Promise<void> {
  await as(db, player(email), (tx) => tx.query(`select ${verb}_manipulation($1)`, [rowId]));
}

async function rows(): Promise<{ id: string; status: string; decided_by: string | null; paid: boolean }[]> {
  const r = await db.query<{ id: string; status: string; decided_by: string | null; paid: boolean }>(
    `select id, status, decided_by, paid_at is not null as paid from manipulations order by created_at`,
  );
  return r.rows;
}

beforeEach(async () => {
  db = await freshDatabase();
  const seeded = await db.query<{ id: string; email: string }>(
    `insert into players (name, email, is_admin) values
       ('Admin', $1, true), ('Ana', $2, false), ('Bruno', $3, false), ('Caio', $4, false)
     returning id, email`,
    [ADMIN, ANA, BRUNO, CAIO],
  );
  ids = Object.fromEntries(seeded.rows.map((r) => [r.email, r.id]));
});

describe('start_manipulation()', () => {
  it('R1.2 opens a pending manipulation for the calling player', async () => {
    expect(await start(ANA)).toMatchObject({ player_id: id(ANA), status: 'pending' });
  });

  it('R1.6 returns the same pending manipulation instead of opening another', async () => {
    const first = await start(ANA);
    expect((await start(ANA)).id).toBe(first.id);
    expect(await rows()).toHaveLength(1);
  });

  it('R1.5 refuses a player who already has a paid manipulation', async () => {
    const first = await start(ANA);
    await decide(ADMIN, 'confirm', first.id);
    await expect(start(ANA)).rejects.toThrow(/already manipulated/);
    expect(await rows()).toHaveLength(1);
  });

  it('R1.7 opens a new manipulation once the previous one was rejected', async () => {
    const first = await start(ANA);
    await decide(ADMIN, 'reject', first.id);
    const again = await start(ANA);
    expect(again.id).not.toBe(first.id);
    expect((await rows()).map((r) => r.status)).toEqual(['rejected', 'pending']);
  });

  it('R1.8 refuses a session that is not a confirmed registered player', async () => {
    await expect(as(db, unconfirmed(ANA), (tx) => tx.query(`select * from start_manipulation()`))).rejects.toThrow();
    await expect(as(db, player(STRANGER), (tx) => tx.query(`select * from start_manipulation()`))).rejects.toThrow();
    await expect(as(db, anon, (tx) => tx.query(`select * from start_manipulation()`))).rejects.toThrow();
    expect(await rows()).toEqual([]);
  });
});

describe('confirm_manipulation() and reject_manipulation()', () => {
  it('R1.4 lets an admin confirm a pending manipulation, recording who confirmed', async () => {
    const row = await start(ANA);
    await decide(ADMIN, 'confirm', row.id);
    expect(await rows()).toEqual([{ id: row.id, status: 'paid', decided_by: id(ADMIN), paid: true }]);
  });

  it('R1.7 lets an admin reject a pending manipulation', async () => {
    const row = await start(ANA);
    await decide(ADMIN, 'reject', row.id);
    expect(await rows()).toEqual([{ id: row.id, status: 'rejected', decided_by: id(ADMIN), paid: false }]);
  });

  it('R1.8 rejects a player confirming or rejecting, their own manipulation included', async () => {
    const row = await start(ANA);
    for (const email of [ANA, BRUNO]) {
      await expect(decide(email, 'confirm', row.id)).rejects.toThrow();
      await expect(decide(email, 'reject', row.id)).rejects.toThrow();
    }
    await expect(as(db, anon, (tx) => tx.query(`select confirm_manipulation($1)`, [row.id]))).rejects.toThrow();
    expect((await rows())[0]?.status).toBe('pending');
  });

  it('decides only a pending manipulation: a paid one cannot be rejected, nor a rejected one confirmed', async () => {
    const paid = await start(ANA);
    await decide(ADMIN, 'confirm', paid.id);
    await expect(decide(ADMIN, 'reject', paid.id)).rejects.toThrow(/not pending/);
    const rejected = await start(BRUNO);
    await decide(ADMIN, 'reject', rejected.id);
    await expect(decide(ADMIN, 'confirm', rejected.id)).rejects.toThrow(/not pending/);
    expect((await rows()).map((r) => r.status)).toEqual(['paid', 'rejected']);
  });
});

describe('pending_manipulations()', () => {
  it('R1.10 lists every pending manipulation with the player name to an admin', async () => {
    const ana = await start(ANA);
    const bruno = await start(BRUNO);
    await decide(ADMIN, 'confirm', bruno.id);
    const r = await as(db, player(ADMIN), (tx) => tx.query<{ id: string; name: string }>(`select id, name from pending_manipulations()`));
    expect(r.rows).toEqual([{ id: ana.id, name: 'Ana' }]);
  });

  it('R1.8 returns nothing to a player who is not an admin', async () => {
    await start(ANA);
    const r = await as(db, player(BRUNO), (tx) => tx.query(`select * from pending_manipulations()`));
    expect(r.rows).toEqual([]);
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

  it('rejects anyone writing manipulations directly, admins included', async () => {
    const row = await start(ANA);
    for (const email of [ANA, ADMIN]) {
      await expect(
        as(db, player(email), (tx) => tx.query(`insert into manipulations (player_id, status) values ($1, 'paid')`, [id(email)])),
      ).rejects.toThrow();
      await expect(
        as(db, player(email), (tx) => tx.query(`update manipulations set status = 'paid' where id = $1`, [row.id])),
      ).rejects.toThrow();
      await expect(as(db, player(email), (tx) => tx.query(`delete from manipulations where id = $1`, [row.id]))).rejects.toThrow();
    }
    expect((await rows())[0]?.status).toBe('pending');
  });

  it('R1.5 allows at most one pending or paid manipulation per player', async () => {
    const row = await start(ANA);
    await expect(db.query(`insert into manipulations (player_id) values ($1)`, [row.player_id])).rejects.toThrow();
  });
});

describe('manipulated_ranking()', () => {
  async function manipulate(email: string): Promise<void> {
    await decide(ADMIN, 'confirm', (await start(email)).id);
  }

  async function manipulatedRanking(email: string) {
    const r = await as(db, player(email), (tx) =>
      tx.query<{ name: string; average: string | null; manipulated: boolean }>(
        `select name, average::text as average, manipulated from manipulated_ranking()`,
      ),
    );
    return r.rows;
  }

  it('R2.1 adds 3 to the average rating of a player with a confirmed manipulation and reorders', async () => {
    await rate(ANA, BRUNO, 6);
    await rate(CAIO, BRUNO, 7); // Bruno 6.5
    await rate(BRUNO, ANA, 5); // Ana 5.0, manipulated 8.0
    await rate(ANA, CAIO, 9); // Caio 9.0
    await manipulate(ANA);
    expect((await manipulatedRanking(BRUNO)).filter((r) => r.name !== 'Admin')).toEqual([
      { name: 'Caio', average: '9.0', manipulated: false },
      { name: 'Ana', average: '8.0', manipulated: true },
      { name: 'Bruno', average: '6.5', manipulated: false },
    ]);
  });

  it('R2.2 gives an unrated manipulated player 3', async () => {
    await manipulate(CAIO);
    expect(await manipulatedRanking(ANA)).toContainEqual({ name: 'Caio', average: '3.0', manipulated: true });
  });

  it('R2.1 ignores pending and rejected manipulations', async () => {
    await rate(BRUNO, ANA, 5);
    await start(ANA);
    const caio = await start(CAIO);
    await decide(ADMIN, 'reject', caio.id);
    const ranking = await manipulatedRanking(BRUNO);
    expect(ranking).toContainEqual({ name: 'Ana', average: '5.0', manipulated: false });
    expect(ranking).toContainEqual({ name: 'Caio', average: null, manipulated: false });
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
  });
});
