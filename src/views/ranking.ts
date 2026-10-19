import type { Api } from '../api';
import { copyText } from '../clipboard';
import { h } from '../dom';
import { formatAverage, rankingText, type RankingRow } from '../ranking';

/** The ranking table, who is at the game, and the "Copiar" button (R4.1–R4.5). */
export function rankingView(api: Api, copy: (text: string) => Promise<boolean> = copyText): HTMLElement {
  const root = h('section', { class: 'card' }, h('p', { class: 'muted' }, 'Carregando…'));

  function render(rows: RankingRow[]): void {
    const status = h('span', { class: 'status', role: 'status' });
    const fallback = h('div');
    const selected = new Set(rows.map((row) => row.player_id));
    const button = h(
      'button',
      {
        type: 'button',
        onclick: () => {
          const chosen = rows.filter((row) => selected.has(row.player_id));
          const text = rankingText(chosen);
          void copy(text).then((ok) => {
            if (ok) {
              status.textContent = 'Copiado!';
              fallback.replaceChildren();
              return;
            }
            status.textContent = 'Não deu para copiar. Selecione o texto abaixo:';
            const area = h('textarea', { readonly: true, rows: String(Math.min(chosen.length + 2, 20)) }, text);
            fallback.replaceChildren(area);
            area.select();
          });
        },
      },
      'Copiar',
    );
    const all = h('input', {
      type: 'checkbox',
      checked: true,
      'aria-label': 'Selecionar todos',
      onchange: () => {
        for (const [id, box] of boxes) {
          box.checked = all.checked;
          if (all.checked) selected.add(id);
          else selected.delete(id);
        }
        changed();
      },
    });
    const boxes = new Map(
      rows.map((row) => {
        const box = h('input', {
          type: 'checkbox',
          checked: true,
          'aria-label': `${row.name} vai jogar`,
          onchange: () => {
            if (box.checked) selected.add(row.player_id);
            else selected.delete(row.player_id);
            changed();
          },
        });
        return [row.player_id, box] as const;
      }),
    );
    function changed(): void {
      all.checked = selected.size === rows.length;
      all.indeterminate = selected.size > 0 && selected.size < rows.length;
      button.disabled = selected.size === 0;
      status.textContent = '';
      fallback.replaceChildren();
    }
    button.disabled = selected.size === 0;
    const table = h(
      'table',
      {},
      h(
        'thead',
        {},
        h('tr', {}, h('th', { class: 'pick' }, all), h('th', {}, '#'), h('th', {}, 'Jogador'), h('th', {}, 'Média'), h('th', {}, 'Avaliações')),
      ),
      h(
        'tbody',
        {},
        ...rows.map((row, index) =>
          h(
            'tr',
            {},
            h('td', { class: 'pick' }, boxes.get(row.player_id)),
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
      ...(rows.length ? [h('p', { class: 'muted' }, 'Desmarque quem não vai jogar: o Copiar leva só os marcados.')] : []),
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
