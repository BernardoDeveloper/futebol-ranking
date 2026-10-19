// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import type { Player } from '../src/api';
import type { Config } from '../src/config';
import { COPY_PROMPT, type RankingRow } from '../src/ranking';
import { playersView } from '../src/views/players';
import { rankingView } from '../src/views/ranking';
import { ratingsView } from '../src/views/ratings';
import { fakeApi, settle } from './fake-api';

const ana: Player = { id: 'a', name: 'Ana', email: 'ana@acme.com', is_admin: true };
const bruno: Player = { id: 'b', name: 'Bruno', email: 'bruno@acme.com', is_admin: false };
const caio: Player = { id: 'c', name: 'Caio', email: 'caio@acme.com', is_admin: false };
const config: Config = { supabaseUrl: 'u', supabaseAnonKey: 'k', allowedDomain: 'acme.com' };

const ranking: RankingRow[] = [
  { player_id: 'a', name: 'Ana', average: 8.7, ratings_count: 3 },
  { player_id: 'b', name: 'Bruno', average: '7.5', ratings_count: 2 },
  { player_id: 'c', name: 'Caio', average: null, ratings_count: 0 },
];

const button = (root: HTMLElement, label: string): HTMLButtonElement => {
  const found = [...root.querySelectorAll('button')].find((b) => b.textContent === label);
  if (!found) throw new Error(`no button "${label}"`);
  return found;
};

const copied = (lines: string): string => `${COPY_PROMPT}\n\n${lines}`;

const checkboxes = (root: HTMLElement): HTMLInputElement[] => [
  ...root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
];

function toggle(box: HTMLInputElement | undefined): void {
  if (!box) throw new Error('no checkbox');
  box.checked = !box.checked;
  box.dispatchEvent(new Event('change'));
}

describe('rankingView', () => {
  it('R4.1 lists every player in ranking order with average rating and number of ratings', async () => {
    const { api } = fakeApi({ ranking });
    const root = rankingView(api);
    await settle();
    const rows = [...root.querySelectorAll('tbody tr')].map((tr) =>
      [...tr.querySelectorAll('td:not(.pick)')].map((td) => td.textContent),
    );
    expect(rows).toEqual([
      ['1', 'Ana', '8.7', '3'],
      ['2', 'Bruno', '7.5', '2'],
      ['', 'Caio', 'sem nota', '0'],
    ]);
  });

  it('R4.2 "Copiar" copies "<name> - <average rating>" lines in ranking order', async () => {
    const { api } = fakeApi({ ranking });
    const copy = vi.fn((_text: string) => Promise.resolve(true));
    const root = rankingView(api, copy);
    await settle();
    button(root, 'Copiar').click();
    await settle();
    expect(copy).toHaveBeenCalledWith(copied('Ana - 8.7\nBruno - 7.5\nCaio - sem nota'));
    expect(root.querySelector('.status')?.textContent).toBe('Copiado!');
  });

  it('R4.3 shows the text for manual copying when the clipboard fails', async () => {
    const { api } = fakeApi({ ranking });
    const root = rankingView(api, () => Promise.resolve(false));
    await settle();
    button(root, 'Copiar').click();
    await settle();
    expect(root.querySelector('textarea')?.value).toBe(copied('Ana - 8.7\nBruno - 7.5\nCaio - sem nota'));
  });

  it('R4.4 offers a checkbox per player, all checked when the ranking opens', async () => {
    const { api } = fakeApi({ ranking });
    const root = rankingView(api);
    await settle();
    const boxes = checkboxes(root);
    expect(boxes.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Selecionar todos',
      'Ana vai jogar',
      'Bruno vai jogar',
      'Caio vai jogar',
    ]);
    expect(boxes.every((b) => b.checked)).toBe(true);
  });

  it('R4.2 R4.4 "Copiar" copies only the selected players, in ranking order', async () => {
    const { api } = fakeApi({ ranking });
    const copy = vi.fn((_text: string) => Promise.resolve(true));
    const root = rankingView(api, copy);
    await settle();
    toggle(checkboxes(root)[2]);
    button(root, 'Copiar').click();
    await settle();
    expect(copy).toHaveBeenCalledWith(copied('Ana - 8.7\nCaio - sem nota'));
    expect(checkboxes(root)[0]?.indeterminate).toBe(true);
  });

  it('R4.4 the check-all checkbox unchecks and checks every player at once', async () => {
    const { api } = fakeApi({ ranking });
    const copy = vi.fn((_text: string) => Promise.resolve(true));
    const root = rankingView(api, copy);
    await settle();
    const [all] = checkboxes(root);
    toggle(all);
    expect(checkboxes(root).slice(1).some((b) => b.checked)).toBe(false);
    toggle(checkboxes(root)[1]);
    toggle(all);
    expect(checkboxes(root).every((b) => b.checked)).toBe(true);
    button(root, 'Copiar').click();
    await settle();
    expect(copy).toHaveBeenCalledWith(copied('Ana - 8.7\nBruno - 7.5\nCaio - sem nota'));
  });

  it('R4.5 disables "Copiar" while no player is selected', async () => {
    const { api } = fakeApi({ ranking });
    const root = rankingView(api);
    await settle();
    const [all] = checkboxes(root);
    toggle(all);
    expect(button(root, 'Copiar').disabled).toBe(true);
    toggle(checkboxes(root)[3]);
    expect(button(root, 'Copiar').disabled).toBe(false);
    expect(all?.checked).toBe(false);
  });

  it('R4.3 R4.4 shows only the selected players for manual copying when the clipboard fails', async () => {
    const { api } = fakeApi({ ranking });
    const root = rankingView(api, () => Promise.resolve(false));
    await settle();
    toggle(checkboxes(root)[1]);
    button(root, 'Copiar').click();
    await settle();
    expect(root.querySelector('textarea')?.value).toBe(copied('Bruno - 7.5\nCaio - sem nota'));
  });

  it('clears the copied text when the selection changes, so it is never stale', async () => {
    const { api } = fakeApi({ ranking });
    const root = rankingView(api, () => Promise.resolve(false));
    await settle();
    button(root, 'Copiar').click();
    await settle();
    toggle(checkboxes(root)[1]);
    expect(root.querySelector('textarea')).toBeNull();
    expect(root.querySelector('.status')?.textContent).toBe('');
  });

  it('shows a load failure', async () => {
    const { api } = fakeApi();
    api.ranking.mockRejectedValueOnce(new Error('offline'));
    const root = rankingView(api);
    await settle();
    expect(root.querySelector('.message.error')?.textContent).toBe('offline');
  });
});

describe('ratingsView', () => {
  it('R3.1 R3.6 offers no rating and 1 to 10 for every player except oneself, preselecting the current rating', async () => {
    const { api } = fakeApi({ players: [ana, bruno, caio], ratings: new Map([['b', 6]]) });
    const root = ratingsView(api, ana);
    await settle();
    const selects = [...root.querySelectorAll('select')];
    expect(selects.map((s) => s.name)).toEqual(['b', 'c']);
    expect(selects[0]?.value).toBe('6');
    expect(selects[1]?.value).toBe('');
    expect([...(selects[0]?.options ?? [])].filter((o) => !o.disabled).map((o) => o.value)).toEqual(
      ['', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    );
  });

  it('R3.6 clears the rating when the signed-in player picks no rating', async () => {
    const { api } = fakeApi({ players: [ana, bruno], ratings: new Map([['b', 6]]) });
    const root = ratingsView(api, ana);
    await settle();
    const select = root.querySelector('select');
    if (!select) throw new Error('no select');
    select.value = '';
    select.dispatchEvent(new Event('change'));
    await settle();
    expect(api.clearRating).toHaveBeenCalledWith('a', 'b');
    expect(api.rate).not.toHaveBeenCalled();
    expect(root.querySelector('.status')?.textContent).toBe('Salvo');
  });

  it('puts no rating back when saving fails after a rating was cleared', async () => {
    const { api } = fakeApi({ players: [ana, bruno], ratings: new Map([['b', 6]]) });
    api.rate.mockRejectedValueOnce(new Error('denied'));
    const root = ratingsView(api, ana);
    await settle();
    const select = root.querySelector('select');
    if (!select) throw new Error('no select');
    select.value = '';
    select.dispatchEvent(new Event('change'));
    await settle();
    select.value = '9';
    select.dispatchEvent(new Event('change'));
    await settle();
    expect(select.value).toBe('');
    expect(root.querySelector('.status')?.textContent).toBe('denied');
  });

  it('R3.6 does nothing when no rating is picked for a player not yet rated', async () => {
    const { api } = fakeApi({ players: [ana, bruno] });
    const root = ratingsView(api, ana);
    await settle();
    const select = root.querySelector('select');
    if (!select) throw new Error('no select');
    select.value = '';
    select.dispatchEvent(new Event('change'));
    await settle();
    expect(api.clearRating).not.toHaveBeenCalled();
  });

  it('puts the previous rating back when clearing fails', async () => {
    const { api } = fakeApi({ players: [ana, bruno], ratings: new Map([['b', 6]]) });
    api.clearRating.mockRejectedValueOnce(new Error('denied'));
    const root = ratingsView(api, ana);
    await settle();
    const select = root.querySelector('select');
    if (!select) throw new Error('no select');
    select.value = '';
    select.dispatchEvent(new Event('change'));
    await settle();
    expect(select.value).toBe('6');
    expect(root.querySelector('.status')?.textContent).toBe('denied');
  });

  it('R3.1 saves a rating given by the signed-in player when it changes', async () => {
    const { api } = fakeApi({ players: [ana, bruno] });
    const root = ratingsView(api, ana);
    await settle();
    const select = root.querySelector('select');
    if (!select) throw new Error('no select');
    select.value = '9';
    select.dispatchEvent(new Event('change'));
    await settle();
    expect(api.rate).toHaveBeenCalledWith('a', 'b', 9);
    expect(root.querySelector('.status')?.textContent).toBe('Salvo');
  });

  it('puts the previous rating back when saving fails', async () => {
    const { api } = fakeApi({ players: [ana, bruno], ratings: new Map([['b', 4]]) });
    api.rate.mockRejectedValueOnce(new Error('denied'));
    const root = ratingsView(api, ana);
    await settle();
    const select = root.querySelector('select');
    if (!select) throw new Error('no select');
    select.value = '9';
    select.dispatchEvent(new Event('change'));
    await settle();
    expect(select.value).toBe('4');
    expect(root.querySelector('.status')?.textContent).toBe('denied');
  });
});

describe('playersView', () => {
  function fill(root: HTMLElement, name: string, email: string): void {
    const field = (n: string): HTMLInputElement => {
      const el = root.querySelector<HTMLInputElement>(`input[name="${n}"]`);
      if (!el) throw new Error(`no input ${n}`);
      return el;
    };
    field('name').value = name;
    field('email').value = email;
    root.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
  }

  it('R2.1 registers a player with the name and the email at the configured domain', async () => {
    const { api } = fakeApi({ players: [ana] });
    const root = playersView(api, config, ana);
    await settle();
    fill(root, ' Duda ', 'duda.souza');
    await settle();
    expect(api.addPlayer).toHaveBeenCalledWith('Duda', 'duda.souza@acme.com');
    expect(root.querySelector('.player-list')?.textContent).toContain('Duda');
  });

  it('shows why registering failed', async () => {
    const { api } = fakeApi({ players: [ana] });
    api.addPlayer.mockRejectedValueOnce(new Error('Já existe um jogador com este email.'));
    const root = playersView(api, config, ana);
    await settle();
    fill(root, 'Ana', 'ana');
    await settle();
    expect(root.querySelector('.message.error')?.textContent).toBe('Já existe um jogador com este email.');
  });

  it('R2.2 removes a player only after a confirming second click, and never offers to remove oneself', async () => {
    const { api } = fakeApi({ players: [ana, bruno] });
    const root = playersView(api, config, ana);
    await settle();
    const items = root.querySelectorAll('.player-list li');
    expect(items[0]?.querySelector('button')).toBeNull();
    const remove = items[1]?.querySelector('button');
    if (!remove) throw new Error('no remove button');
    remove.click();
    expect(api.removePlayer).not.toHaveBeenCalled();
    remove.click();
    await settle();
    expect(api.removePlayer).toHaveBeenCalledWith('b');
  });
});
