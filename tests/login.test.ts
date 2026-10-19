// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type { Config } from '../src/config';
import { loginView } from '../src/views/login';
import { fakeApi, settle } from './fake-api';

const config = (allowedDomain?: string): Config => ({ supabaseUrl: 'u', supabaseAnonKey: 'k', allowedDomain });

function submit(root: HTMLElement, name: string, value: string): void {
  const input = root.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (!input) throw new Error(`no input ${name}`);
  input.value = value;
  input.form?.dispatchEvent(new Event('submit', { cancelable: true }));
}

describe('loginView', () => {
  it('R1.1 R1.4 sends the access code to the typed name at the configured domain', async () => {
    const { api } = fakeApi();
    const root = loginView(api, config('acme.com'));
    expect(root.textContent).toContain('@acme.com');
    submit(root, 'email', 'Bernardo.GSilva');
    await settle();
    expect(api.requestCode).toHaveBeenCalledWith('bernardo.gsilva@acme.com');
    expect(root.querySelector('input[name="code"]')).not.toBeNull();
  });

  it('R1.2 verifies the code for the same email', async () => {
    const { api } = fakeApi();
    const root = loginView(api, config());
    submit(root, 'email', 'ana@acme.com');
    await settle();
    submit(root, 'code', ' 123 456 ');
    await settle();
    expect(api.verifyCode).toHaveBeenCalledWith('ana@acme.com', '123456');
  });

  it('does not call the backend for an invalid email, and says why', () => {
    const { api } = fakeApi();
    const root = loginView(api, config());
    submit(root, 'email', 'not-an-email');
    expect(api.requestCode).not.toHaveBeenCalled();
    expect(root.querySelector('.message.error')?.textContent).toBe('Digite um email válido.');
  });

  it('shows the backend\'s refusal and stays on the email step', async () => {
    const { api } = fakeApi();
    api.requestCode.mockRejectedValueOnce(new Error('Este email não está cadastrado.'));
    const root = loginView(api, config('acme.com'));
    submit(root, 'email', 'stranger');
    await settle();
    expect(root.querySelector('.message.error')?.textContent).toBe('Este email não está cadastrado.');
    expect(root.querySelector('input[name="email"]')).not.toBeNull();
  });

  it('shows a rejected code', async () => {
    const { api } = fakeApi();
    api.verifyCode.mockRejectedValueOnce(new Error('Código inválido ou expirado.'));
    const root = loginView(api, config());
    submit(root, 'email', 'ana@acme.com');
    await settle();
    submit(root, 'code', '000000');
    await settle();
    expect(root.querySelector('.message.error')?.textContent).toBe('Código inválido ou expirado.');
  });
});
