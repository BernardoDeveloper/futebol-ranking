import type { Api, Player } from '../api';
import { h } from '../dom';
import { errorText } from './ranking';

const VALUES = Array.from({ length: 10 }, (_, i) => i + 1);

/** The signed-in player rates every other player from 1 to 10 (R3.1), or clears a rating with "—" (R3.6). */
export function ratingsView(api: Api, me: Player): HTMLElement {
  const root = h('section', { class: 'card' }, h('p', { class: 'muted' }, 'Carregando…'));

  function row(player: Player, current: number | undefined): HTMLElement {
    const status = h('span', { class: 'status', role: 'status' });
    let saved = current;
    const select = h(
      'select',
      {
        name: player.id,
        'aria-label': `Nota de ${player.name}`,
        onchange: () => {
          const value = select.value === '' ? undefined : Number(select.value);
          if (value === saved) return;
          select.disabled = true;
          status.textContent = 'Salvando…';
          const saving =
            value === undefined ? api.clearRating(me.id, player.id) : api.rate(me.id, player.id, value);
          saving.then(
            () => {
              saved = value;
              status.textContent = 'Salvo';
              select.disabled = false;
            },
            (error: unknown) => {
              select.value = saved === undefined ? '' : String(saved);
              status.textContent = errorText(error);
              select.disabled = false;
            },
          );
        },
      },
      h('option', { value: '', selected: current === undefined }, '—'),
      ...VALUES.map((v) => h('option', { value: String(v), selected: v === current }, v)),
    );
    select.value = current === undefined ? '' : String(current);
    return h('li', { class: 'rating-row' }, h('span', { class: 'name' }, player.name), select, status);
  }

  Promise.all([api.players(), api.myRatings()]).then(
    ([players, ratings]) => {
      const others = players.filter((p) => p.id !== me.id);
      root.replaceChildren(
        h('h2', {}, 'Avaliar'),
        h('p', { class: 'muted' }, 'Dê uma nota de 1 a 10 para cada jogador, ou deixe em — enquanto não souber. Só você vê as suas notas; você pode mudá-las quando quiser.'),
        others.length
          ? h('ul', { class: 'rating-list' }, ...others.map((p) => row(p, ratings.get(p.id))))
          : h('p', { class: 'muted' }, 'Ainda não há outros jogadores.'),
      );
    },
    (error: unknown) => {
      root.replaceChildren(h('p', { class: 'message error' }, errorText(error)));
    },
  );
  return root;
}
