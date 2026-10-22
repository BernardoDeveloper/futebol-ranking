import { describe, expect, it, vi } from 'vitest';
import type { Gateway, NewPix, Pix } from '../../supabase/functions/_shared/abacatepay';
import {
  check,
  PIX_EXPIRES_IN,
  PRICE_CENTS,
  reconcile,
  start,
  type Manipulation,
  type Store,
} from '../../supabase/functions/_shared/manipulation';

const PIX: Pix = { id: 'pix_char_1', brCode: '000201…', qrCode: 'data:image/png;base64,AA==', expiresAt: '2026-10-22T13:00:00Z' };

function row(overrides: Partial<Manipulation> = {}): Manipulation {
  return { id: 'm-1', status: 'pending', charge_id: null, br_code: null, qr_code: null, expires_at: null, ...overrides };
}

const attached = (overrides: Partial<Manipulation> = {}): Manipulation =>
  row({ charge_id: PIX.id, br_code: PIX.brCode, qr_code: PIX.qrCode, expires_at: PIX.expiresAt, ...overrides });

// An in-memory store over a list of rows, standing in for Postgres and the SQL functions.
function fakeStore(rows: Manipulation[], begin: () => Promise<Manipulation> = () => Promise.resolve(rows[0] ?? row())) {
  const store = {
    begin: vi.fn(begin),
    mine: vi.fn(() => Promise.resolve(rows.find((r) => r.status !== 'expired') ?? null)),
    pending: vi.fn(() => Promise.resolve(rows.filter((r) => r.status === 'pending' && r.charge_id !== null))),
    attach: vi.fn((id: string, pix: Pix) => {
      const r = rows.find((x) => x.id === id);
      if (r) Object.assign(r, { charge_id: pix.id, br_code: pix.brCode, qr_code: pix.qrCode, expires_at: pix.expiresAt });
      return Promise.resolve();
    }),
    settle: vi.fn((id: string, status: 'paid' | 'expired') => {
      const r = rows.find((x) => x.id === id && x.status === 'pending');
      if (r) r.status = status;
      return Promise.resolve();
    }),
  } satisfies Store;
  return store;
}

function fakeGateway(statuses: Record<string, string> = {}) {
  return {
    createPix: vi.fn((_pix: NewPix) => Promise.resolve(PIX)),
    checkPix: vi.fn((id: string) => {
      const status = statuses[id];
      return status ? Promise.resolve(status) : Promise.reject(new Error(`AbacatePay: HTTP 500`));
    }),
  } satisfies Gateway;
}

describe('start', () => {
  it('R1.2 creates a R$ 2,00 Pix for a new manipulation and attaches it', async () => {
    const rows = [row()];
    const store = fakeStore(rows);
    const gateway = fakeGateway();
    expect(await start(store, gateway)).toEqual({ status: 'pending', brCode: PIX.brCode, qrCode: PIX.qrCode, expiresAt: PIX.expiresAt });
    expect(PRICE_CENTS).toBe(200);
    expect(gateway.createPix).toHaveBeenCalledWith(
      expect.objectContaining({ externalId: 'm-1', amount: 200, expiresIn: PIX_EXPIRES_IN }),
    );
    expect(store.attach).toHaveBeenCalledWith('m-1', PIX);
  });

  it('R1.6 returns the pending charge it already has, creating none', async () => {
    const gateway = fakeGateway();
    const view = await start(fakeStore([attached()]), gateway);
    expect(view).toMatchObject({ status: 'pending', brCode: PIX.brCode });
    expect(gateway.createPix).not.toHaveBeenCalled();
  });

  it('R1.5 creates no charge for a player already manipulated', async () => {
    const gateway = fakeGateway();
    const store = fakeStore([], () => Promise.reject(new Error('already manipulated')));
    expect(await start(store, gateway)).toEqual({ status: 'paid' });
    expect(gateway.createPix).not.toHaveBeenCalled();
  });

  describe('R1.4 a pending charge past its expiry is settled from AbacatePay before anything new', () => {
    const late = (): Manipulation => attached({ expires_at: '2020-01-01T00:00:00Z' });

    it('counts a payment AbacatePay confirmed after the local expiry', async () => {
      const rows = [late()];
      const store = fakeStore(rows);
      const gateway = fakeGateway({ [PIX.id]: 'PAID' });
      expect(await start(store, gateway)).toEqual({ status: 'paid' });
      expect(store.settle).toHaveBeenCalledWith('m-1', 'paid');
      expect(gateway.createPix).not.toHaveBeenCalled();
    });

    it('opens a new Pix once AbacatePay says the old one expired', async () => {
      const rows = [late()];
      const fresh = row({ id: 'm-2' });
      const store = fakeStore(rows);
      store.begin.mockResolvedValueOnce(rows[0] ?? row()).mockResolvedValueOnce(fresh);
      rows.push(fresh);
      const gateway = fakeGateway({ [PIX.id]: 'EXPIRED' });
      expect(await start(store, gateway)).toMatchObject({ status: 'pending' });
      expect(store.settle).toHaveBeenCalledWith('m-1', 'expired');
      expect(gateway.createPix).toHaveBeenCalledWith(expect.objectContaining({ externalId: 'm-2' }));
    });

    it('keeps showing the old Pix while AbacatePay still has it pending', async () => {
      const gateway = fakeGateway({ [PIX.id]: 'PENDING' });
      expect(await start(fakeStore([late()]), gateway)).toMatchObject({ status: 'pending', brCode: PIX.brCode });
      expect(gateway.createPix).not.toHaveBeenCalled();
    });
  });

  it('passes on any other refusal from the database', async () => {
    const store = fakeStore([], () => Promise.reject(new Error('not a registered player')));
    await expect(start(store, fakeGateway())).rejects.toThrow('not a registered player');
  });
});

describe('check', () => {
  it('R1.4 marks the pending manipulation paid only when AbacatePay says PAID', async () => {
    const rows = [attached()];
    const store = fakeStore(rows);
    expect(await check(store, fakeGateway({ [PIX.id]: 'PAID' }))).toEqual({ status: 'paid' });
    expect(store.settle).toHaveBeenCalledWith('m-1', 'paid');
  });

  it('R1.3 keeps showing the charge while AbacatePay says PENDING', async () => {
    const store = fakeStore([attached()]);
    expect(await check(store, fakeGateway({ [PIX.id]: 'PENDING' }))).toMatchObject({ status: 'pending', brCode: PIX.brCode });
    expect(store.settle).not.toHaveBeenCalled();
  });

  it('R1.4 expires the manipulation when its charge expired or was cancelled', async () => {
    for (const status of ['EXPIRED', 'CANCELLED']) {
      const store = fakeStore([attached()]);
      expect(await check(store, fakeGateway({ [PIX.id]: status }))).toEqual({ status: 'none' });
      expect(store.settle).toHaveBeenCalledWith('m-1', 'expired');
    }
  });

  it('R1.4 does not count refunded, disputed or unknown states as paid', async () => {
    for (const status of ['REFUNDED', 'UNDER_DISPUTE', 'APPROVED', 'FAILED']) {
      const store = fakeStore([attached()]);
      await check(store, fakeGateway({ [PIX.id]: status }));
      expect(store.settle).not.toHaveBeenCalledWith('m-1', 'paid');
    }
  });

  it('answers without asking AbacatePay when there is nothing pending', async () => {
    const gateway = fakeGateway();
    expect(await check(fakeStore([]), gateway)).toEqual({ status: 'none' });
    expect(await check(fakeStore([attached({ status: 'paid' })]), gateway)).toEqual({ status: 'paid' });
    expect(await check(fakeStore([row()]), gateway)).toEqual({ status: 'none' });
    expect(gateway.checkPix).not.toHaveBeenCalled();
  });
});

describe('reconcile', () => {
  it('R1.4 settles every pending charge from what AbacatePay reports', async () => {
    const rows = [
      attached({ id: 'm-1', charge_id: 'c1' }),
      attached({ id: 'm-2', charge_id: 'c2' }),
      attached({ id: 'm-3', charge_id: 'c3' }),
    ];
    const store = fakeStore(rows);
    await reconcile(store, fakeGateway({ c1: 'PAID', c2: 'PENDING', c3: 'EXPIRED' }));
    expect(rows.map((r) => r.status)).toEqual(['paid', 'pending', 'expired']);
  });

  it('settles the rest when one check fails, then fails so the webhook is retried', async () => {
    const rows = [attached({ id: 'm-1', charge_id: 'broken' }), attached({ id: 'm-2', charge_id: 'c2' })];
    await expect(reconcile(fakeStore(rows), fakeGateway({ c2: 'PAID' }))).rejects.toThrow(/1 of 2/);
    expect(rows.map((r) => r.status)).toEqual(['pending', 'paid']);
  });
});
