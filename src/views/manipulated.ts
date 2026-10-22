import type { Api } from '../api';
import { h } from '../dom';
import { formatAverage, type ManipulatedRow } from '../ranking';
import { errorText } from './ranking';

/** The Manipulados joke list: the ranking with +3 for whoever paid (specs/manipulados R2.1, R2.3). */
export function manipulatedView(api: Api): HTMLElement {
  const root = h('section', { class: 'card' }, h('p', { class: 'muted' }, 'Carregando…'));

  function render(rows: ManipulatedRow[]): void {
    const table = h(
      'table',
      {},
      h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Jogador'), h('th', {}, 'Nota'))),
      h(
        'tbody',
        {},
        ...rows.map((row, index) =>
          h(
            'tr',
            {},
            h('td', {}, row.average === null ? '' : index + 1),
            h('td', {}, row.name, row.manipulated ? h('span', { class: 'tag' }, 'Manipulado') : null),
            h('td', { class: 'num' }, formatAverage(row.average)),
          ),
        ),
      ),
    );
    root.replaceChildren(
      h('h2', {}, 'Manipulados'),
      h(
        'p',
        { class: 'muted' },
        'Só pela resenha: quem pagou o Pix de R$ 2,00 sobe 3 pontos aqui. O ranking oficial e o Copiar não mudam.',
      ),
      rows.length ? table : h('p', { class: 'muted' }, 'Nenhum jogador cadastrado ainda.'),
    );
  }

  api.manipulatedRanking().then(render, (error: unknown) => {
    root.replaceChildren(h('p', { class: 'message error' }, errorText(error)));
  });
  return root;
}
