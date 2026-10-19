import { vi } from 'vitest';
import type { Api, Player } from '../src/api';
import type { RankingRow } from '../src/ranking';

/** An in-memory Api for view tests; every method is a spy. */
export function fakeApi(state: { players?: Player[]; ratings?: Map<string, number>; ranking?: RankingRow[] } = {}) {
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
  } satisfies Api;
  return { api, signIn: (email: string | null) => listener?.(email) };
}

/** Lets pending promise callbacks run. */
export const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
