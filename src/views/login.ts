import type { Api } from '../api';
import type { Config } from '../config';
import { h } from '../dom';
import { loginEmail } from '../email';

const CODE = /^\d{6,10}$/;

/** Two steps: the email, then the access code sent to it (R1.1, R1.2, R1.4). */
export function loginView(api: Api, config: Config): HTMLElement {
  const root = h('section', { class: 'card login' });
  const message = h('p', { class: 'message', role: 'status' });

  const fail = (error: unknown): void => {
    message.className = 'message error';
    message.textContent = error instanceof Error ? error.message : String(error);
  };

  function emailStep(): void {
    const domain = config.allowedDomain;
    const input = h('input', {
      name: 'email',
      type: domain ? 'text' : 'email',
      autocomplete: domain ? 'username' : 'email',
      placeholder: domain ? 'nome.sobrenome' : 'voce@empresa.com',
      required: true,
    });
    const button = h('button', { type: 'submit' }, 'Enviar código');
    const form = h(
      'form',
      {
        onsubmit: (event) => {
          event.preventDefault();
          const email = loginEmail(input.value, domain);
          if (!email) {
            fail(new Error(domain ? 'Digite o seu usuário do email.' : 'Digite um email válido.'));
            return;
          }
          button.disabled = true;
          message.className = 'message';
          message.textContent = 'Enviando…';
          api.requestCode(email).then(
            () => {
              codeStep(email);
            },
            (error: unknown) => {
              button.disabled = false;
              fail(error);
            },
          );
        },
      },
      h('label', {}, 'Email', h('span', { class: 'email-field' }, input, domain && h('span', { class: 'suffix' }, `@${domain}`))),
      button,
    );
    root.replaceChildren(h('h1', {}, 'Entrar'), h('p', {}, 'Vamos mandar um código de acesso para o seu email.'), form, message);
    input.focus();
  }

  function codeStep(email: string): void {
    const input = h('input', {
      name: 'code',
      inputmode: 'numeric',
      autocomplete: 'one-time-code',
      placeholder: '123456',
      maxlength: '10',
      required: true,
    });
    const button = h('button', { type: 'submit' }, 'Entrar');
    const form = h(
      'form',
      {
        onsubmit: (event) => {
          event.preventDefault();
          const code = input.value.replace(/\s/g, '');
          if (!CODE.test(code)) {
            fail(new Error('O código tem só números.'));
            return;
          }
          button.disabled = true;
          api.verifyCode(email, code).catch((error: unknown) => {
            button.disabled = false;
            fail(error);
          });
        },
      },
      h('label', {}, 'Código', input),
      button,
    );
    message.className = 'message';
    message.textContent = '';
    root.replaceChildren(
      h('h1', {}, 'Código de acesso'),
      h('p', {}, 'Enviamos um código para ', h('strong', {}, email), '.'),
      form,
      h('button', { type: 'button', class: 'link', onclick: emailStep }, 'Usar outro email'),
      message,
    );
    input.focus();
  }

  emailStep();
  return root;
}
