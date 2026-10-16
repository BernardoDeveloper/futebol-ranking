import type { Api } from '../api';
import { copyText } from '../clipboard';
import { h } from '../dom';
import { formatAverage, rankingText, type RankingRow } from '../ranking';

/** The ranking table and its "Copiar" button (R4.1, R4.2, R4.3). */
export function rankingView(api: Api, copy: (text: string) => Promise<boolean> = copyText): HTMLElement {
  const root = h('section', { class: 'card' }, h('p', { class: 'muted' }, 'Carregando…'));

  function render(rows: RankingRow[]): void {
    const status = h('span', { class: 'status', role: 'status' });
    const fallback = h('div');
    const text = rankingText(rows);
    const button = h(
      'button',
      {
        type: 'button',
        onclick: () => {
          void copy(text).then((ok) => {
            if (ok) {
              status.textContent = 'Copiado!';
              fallback.replaceChildren();
              return;
            }
            status.textContent = 'Não deu para copiar. Selecione o texto abaixo:';
            const area = h('textarea', { readonly: true, rows: String(Math.min(rows.length, 20)) }, text);
            fallback.replaceChildren(area);
            area.select();
          });
        },
      },
      'Copiar',
    );
    const table = h(
      'table',
      {},
      h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Jogador'), h('th', {}, 'Média'), h('th', {}, 'Avaliações'))),
      h(
        'tbody',
        {},
        ...rows.map((row, index) =>
          h(
            'tr',
            {},
            h('td', {}, row.average === null ? '' : index + 1),
            h('td', {}, row.name),
            h('td', { class: 'num' }, formatAverage(row.average)),
            h('td', { class: 'num' }, row.ratings_count),
          ),
        ),
      ),
    );
    root.replaceChildren(
      h('div', { class: 'toolbar' }, h('h2', {}, 'Ranking'), button),
      status,
      fallback,
      rows.length ? table : h('p', { class: 'muted' }, 'Nenhum jogador cadastrado ainda.'),
    );
  }

  api.ranking().then(render, (error: unknown) => {
    root.replaceChildren(h('p', { class: 'message error' }, errorText(error)));
  });
  return root;
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
