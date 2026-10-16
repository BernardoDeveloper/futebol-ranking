import type { Api, Player } from './api';
import type { Config } from './config';
import { h } from './dom';
import { loginView } from './views/login';
import { playersView } from './views/players';
import { errorText, rankingView } from './views/ranking';
import { ratingsView } from './views/ratings';

interface Tab {
  label: string;
  view: () => HTMLElement;
}

/** Shows the login while signed out, the app while signed in (R1.6: "Sair" ends the session). */
export function mountApp(root: HTMLElement, api: Api, config: Config): void {
  let generation = 0;

  const signOutButton = (): HTMLElement =>
    h(
      'button',
      {
        type: 'button',
        class: 'link',
        onclick: () => {
          api.signOut().catch((error: unknown) => {
            root.append(h('p', { class: 'message error' }, errorText(error)));
          });
        },
      },
      'Sair',
    );

  function shell(me: Player): HTMLElement {
    const tabs: Tab[] = [
      { label: 'Ranking', view: () => rankingView(api) },
      { label: 'Avaliar', view: () => ratingsView(api, me) },
    ];
    if (me.is_admin) tabs.push({ label: 'Jogadores', view: () => playersView(api, config, me) });

    const content = h('main');
    const buttons = tabs.map((tab) =>
      h('button', { type: 'button', role: 'tab', onclick: () => { show(tab); } }, tab.label),
    );
    function show(tab: Tab): void {
      buttons.forEach((b, i) => {
        b.setAttribute('aria-selected', String(tabs[i] === tab));
      });
      content.replaceChildren(tab.view());
    }
    const first = tabs[0];
    if (first) show(first);

    return h(
      'div',
      { class: 'shell' },
      h('header', {}, h('strong', {}, 'Ranking do Futebol'), h('span', { class: 'who' }, me.name, signOutButton())),
      h('nav', { role: 'tablist' }, ...buttons),
      content,
    );
  }

  async function render(email: string | null): Promise<void> {
    const mine = ++generation;
    if (email === null) {
      root.replaceChildren(loginView(api, config));
      return;
    }
    root.replaceChildren(h('p', { class: 'muted center' }, 'Carregando…'));
    try {
      const players = await api.players();
      if (mine !== generation) return;
      const me = players.find((p) => p.email === email.toLowerCase());
      root.replaceChildren(
        me
          ? shell(me)
          : h(
              'section',
              { class: 'card' },
              h('p', {}, `O email ${email} não é de um jogador cadastrado.`),
              signOutButton(),
            ),
      );
    } catch (error) {
      if (mine !== generation) return;
      root.replaceChildren(h('section', { class: 'card' }, h('p', { class: 'message error' }, errorText(error)), signOutButton()));
    }
  }

  api.onSessionChange((email) => {
    void render(email);
  });
}
