import type { Api, Manipulation, Player } from '../api';
import { copyText } from '../clipboard';
import { h } from '../dom';
import { formatAverage, rankingText, type RankingRow } from '../ranking';

/**
 * The ranking table, who is at the game, and the "Copiar" button (R4.1–R4.5), plus
 * "Manipular" on the player's own row (specs/manipulados R1.1–R1.3, R1.9).
 */
export function rankingView(
  api: Api,
  me: Player,
  copy: (text: string) => Promise<boolean> = copyText,
  pollMs = 3000,
): HTMLElement {
  const root = h('section', { class: 'card' }, h('p', { class: 'muted' }, 'Carregando…'));
  const pix = h('div', { class: 'pix' });

  function manipulatedTag(): HTMLElement {
    return h('span', { class: 'tag' }, 'Manipulado');
  }

  // The Pix panel; polls while it is on screen, and stops once the tab is left.
  function manipulateButton(): HTMLButtonElement {
    const button: HTMLButtonElement = h(
      'button',
      {
        type: 'button',
        class: 'small',
        onclick: () => {
          button.disabled = true;
          api.manipulate().then(shown, (error: unknown) => {
            button.disabled = false;
            pix.replaceChildren(h('p', { class: 'message error' }, errorText(error)));
          });
        },
      },
      'Manipular',
    );

    function paid(): void {
      button.replaceWith(manipulatedTag());
      pix.replaceChildren(h('p', { class: 'message' }, 'Pago! Você está manipulado: veja a aba Manipulados.'));
    }

    function shown(state: Manipulation): void {
      if (state.status === 'paid') {
        paid();
        return;
      }
      if (state.status === 'none') {
        button.disabled = false;
        pix.replaceChildren(h('p', { class: 'message' }, 'O Pix expirou. Toque em Manipular para gerar outro.'));
        return;
      }
      const status = h('p', { class: 'status', role: 'status' }, 'Aguardando pagamento…');
      const code = h('textarea', { readonly: true, rows: '3', 'aria-label': 'Pix copia e cola' }, state.brCode);
      pix.replaceChildren(
        h('h3', {}, 'Manipular por R$ 2,00'),
        h('p', { class: 'muted' }, 'Pague o Pix e você sobe 3 pontos na lista Manipulados. Só pela resenha: o ranking oficial e o Copiar não mudam.'),
        h('img', { src: state.qrCode, alt: 'QR code do Pix', width: '200', height: '200' }),
        code,
        h(
          'button',
          {
            type: 'button',
            onclick: () => {
              void copy(state.brCode).then((ok) => {
                if (ok) status.textContent = 'Código copiado. Aguardando pagamento…';
                else code.select();
              });
            },
          },
          'Copiar código Pix',
        ),
        status,
      );
      setTimeout(poll, pollMs);
    }

    function poll(): void {
      if (!root.isConnected) return;
      api.checkManipulation().then(shown, () => {
        setTimeout(poll, pollMs);
      });
    }

    return button;
  }

  function render(rows: RankingRow[], manipulated: boolean): void {
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
            h(
              'td',
              {},
              row.name,
              row.player_id === me.id ? (manipulated ? manipulatedTag() : manipulateButton()) : null,
            ),
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
      pix,
      rows.length ? table : h('p', { class: 'muted' }, 'Nenhum jogador cadastrado ainda.'),
    );
  }

  // The joke must never cost the official ranking, so a failure to read it counts as not manipulated.
  Promise.all([api.ranking(), api.isManipulated().catch(() => false)]).then(
    ([rows, manipulated]) => {
      render(rows, manipulated);
    },
    (error: unknown) => {
      root.replaceChildren(h('p', { class: 'message error' }, errorText(error)));
    },
  );
  return root;
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
