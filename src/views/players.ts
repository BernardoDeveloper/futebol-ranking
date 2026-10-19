import type { Api, Player } from '../api';
import type { Config } from '../config';
import { h } from '../dom';
import { loginEmail } from '../email';
import { errorText } from './ranking';

/** Admins register and remove players (R2.1, R2.2). */
export function playersView(api: Api, config: Config, me: Player): HTMLElement {
  const root = h('section', { class: 'card' });
  const message = h('p', { class: 'message', role: 'status' });
  const list = h('ul', { class: 'player-list' });
  const domain = config.allowedDomain;

  const say = (text: string, error = false): void => {
    message.className = error ? 'message error' : 'message';
    message.textContent = text;
  };

  const nameInput = h('input', { name: 'name', placeholder: 'Nome', required: true, autocomplete: 'off' });
  const emailInput = h('input', {
    name: 'email',
    type: domain ? 'text' : 'email',
    placeholder: domain ? 'nome.sobrenome' : 'email@empresa.com',
    required: true,
    autocomplete: 'off',
  });
  const addButton = h('button', { type: 'submit' }, 'Cadastrar');
  const form = h(
    'form',
    {
      class: 'add-player',
      onsubmit: (event) => {
        event.preventDefault();
        const name = nameInput.value.trim();
        const email = loginEmail(emailInput.value, domain);
        if (!name || !email) {
          say(name ? 'Email inválido.' : 'Digite o nome.', true);
          return;
        }
        addButton.disabled = true;
        api.addPlayer(name, email).then(
          () => {
            form.reset();
            say(`${name} cadastrado.`);
            addButton.disabled = false;
            void load();
          },
          (error: unknown) => {
            say(errorText(error), true);
            addButton.disabled = false;
          },
        );
      },
    },
    h('label', {}, 'Nome', nameInput),
    h('label', {}, 'Email', h('span', { class: 'email-field' }, emailInput, domain && h('span', { class: 'suffix' }, `@${domain}`))),
    addButton,
  );

  function item(player: Player): HTMLElement {
    const remove = h('button', { type: 'button', class: 'danger' }, 'Remover');
    let armed = false;
    remove.addEventListener('click', () => {
      // Two clicks instead of confirm(): removing also deletes every rating of the player.
      if (!armed) {
        armed = true;
        remove.textContent = 'Confirmar remoção';
        return;
      }
      remove.disabled = true;
      api.removePlayer(player.id).then(
        () => {
          say(`${player.name} removido.`);
          void load();
        },
        (error: unknown) => {
          say(errorText(error), true);
          remove.disabled = false;
        },
      );
    });
    return h(
      'li',
      {},
      h('span', { class: 'name' }, player.name, player.is_admin && h('span', { class: 'badge' }, 'admin')),
      h('span', { class: 'muted email' }, player.email),
      player.id === me.id ? null : remove,
    );
  }

  async function load(): Promise<void> {
    try {
      const players = await api.players();
      list.replaceChildren(...players.map(item));
    } catch (error) {
      say(errorText(error), true);
    }
  }

  root.replaceChildren(h('h2', {}, 'Jogadores'), form, message, list);
  void load();
  return root;
}
