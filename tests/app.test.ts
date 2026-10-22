// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type { Player } from '../src/api';
import { mountApp } from '../src/app';
import type { Config } from '../src/config';
import { fakeApi, settle } from './fake-api';

const admin: Player = { id: 'a', name: 'Ana', email: 'ana@acme.com', is_admin: true };
const bruno: Player = { id: 'b', name: 'Bruno', email: 'bruno@acme.com', is_admin: false };
const config: Config = { supabaseUrl: 'u', supabaseAnonKey: 'k', allowedDomain: undefined };

const tabs = (root: HTMLElement): string[] => [...root.querySelectorAll('[role="tab"]')].map((t) => t.textContent);

function mount(players: Player[]) {
  const root = document.createElement('div');
  const fake = fakeApi({ players });
  mountApp(root, fake.api, config);
  return { root, ...fake };
}

describe('mountApp', () => {
  it('shows the login while signed out', async () => {
    const { root, signIn } = mount([admin]);
    signIn(null);
    await settle();
    expect(root.querySelector('input[name="email"]')).not.toBeNull();
  });

  it('shows Ranking, Avaliar and Manipulados to a player, opening on the ranking', async () => {
    const { root, signIn } = mount([admin, bruno]);
    signIn('Bruno@acme.com');
    await settle();
    expect(tabs(root)).toEqual(['Ranking', 'Avaliar', 'Manipulados']);
    expect(root.querySelector('h2')?.textContent).toBe('Ranking');
  });

  it('R2.1 adds the Jogadores tab for an admin', async () => {
    const { root, signIn } = mount([admin, bruno]);
    signIn('ana@acme.com');
    await settle();
    expect(tabs(root)).toEqual(['Ranking', 'Avaliar', 'Manipulados', 'Jogadores']);
  });

  it('keeps the open tab when Supabase re-announces the same session', async () => {
    const { root, api, signIn } = mount([admin, bruno]);
    signIn('bruno@acme.com');
    await settle();
    [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((t) => t.textContent === 'Avaliar')?.click();
    await settle();
    signIn('bruno@acme.com');
    await settle();
    expect(root.querySelector('h2')?.textContent).toBe('Avaliar');
    expect(api.players).toHaveBeenCalledTimes(2); // shell once, ratings tab once
  });

  it('R1.6 "Sair" ends the session and returns to the login', async () => {
    const { root, api, signIn } = mount([admin]);
    signIn('ana@acme.com');
    await settle();
    [...root.querySelectorAll('button')].find((b) => b.textContent === 'Sair')?.click();
    await settle();
    expect(api.signOut).toHaveBeenCalledOnce();
    expect(root.querySelector('input[name="email"]')).not.toBeNull();
  });

  it('R1.5 tells a session that is not a player so, offering only to sign out', async () => {
    const { root, signIn } = mount([admin]);
    signIn('stranger@acme.com');
    await settle();
    expect(root.textContent).toContain('não é de um jogador cadastrado');
    expect(tabs(root)).toEqual([]);
  });
});
