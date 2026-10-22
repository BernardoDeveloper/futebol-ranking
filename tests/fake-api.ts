import { vi } from 'vitest';
import type { Api, Manipulation, Player } from '../src/api';
import type { ManipulatedRow, RankingRow } from '../src/ranking';

/** An in-memory Api for view tests; every method is a spy. */
export function fakeApi(
  state: {
    players?: Player[];
    ratings?: Map<string, number>;
    ranking?: RankingRow[];
    manipulated?: ManipulatedRow[];
    isManipulated?: boolean;
    /** What manipulate() returns, and checkManipulation() returns in turn, one reply per call. */
    manipulation?: Manipulation;
    checks?: Manipulation[];
  } = {},
) {
  let listener: ((email: string | null) => void) | undefined;
  const players = state.players ?? [];
  const api = {
    requestCode: vi.fn((_email: string) => Promise.resolve()),
    verifyCode: vi.fn((_email: string, _code: string) => Promise.resolve()),
    signOut: vi.fn(() => {
      listener?.(null);
      return Promise.resolve();
    }),
    onSessionChange: vi.fn((callback: (email: string | null) => void) => {
      listener = callback;
    }),
    players: vi.fn(() => Promise.resolve([...players])),
    addPlayer: vi.fn((name: string, email: string) => {
      players.push({ id: `id-${email}`, name, email, is_admin: false });
      return Promise.resolve();
    }),
    removePlayer: vi.fn((_id: string) => Promise.resolve()),
    myRatings: vi.fn(() => Promise.resolve(new Map(state.ratings ?? []))),
    rate: vi.fn((_rater: string, _rated: string, _value: number) => Promise.resolve()),
    clearRating: vi.fn((_rater: string, _rated: string) => Promise.resolve()),
    ranking: vi.fn(() => Promise.resolve(state.ranking ?? [])),
    manipulate: vi.fn(() => Promise.resolve<Manipulation>(state.manipulation ?? { status: 'none' })),
    checkManipulation: vi.fn(() => Promise.resolve<Manipulation>(state.checks?.shift() ?? { status: 'none' })),
    isManipulated: vi.fn(() => Promise.resolve(state.isManipulated ?? false)),
    manipulatedRanking: vi.fn(() => Promise.resolve(state.manipulated ?? [])),
  } satisfies Api;
  return { api, signIn: (email: string | null) => listener?.(email) };
}

/** Lets pending promise callbacks run. */
export const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
