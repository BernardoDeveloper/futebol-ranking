// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { h } from '../src/dom';

describe('h', () => {
  it('renders text children as text, never as markup', () => {
    const el = h('p', {}, '<img src=x onerror=alert(1)>');
    expect(el.children).toHaveLength(0);
    expect(el.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('sets attributes, toggles booleans, and skips empty children', () => {
    const el = h('input', { name: 'n', required: true, disabled: false });
    expect(el.getAttribute('name')).toBe('n');
    expect(el.hasAttribute('required')).toBe(true);
    expect(el.hasAttribute('disabled')).toBe(false);
    expect(h('div', {}, null, false, undefined, 'a', 1).textContent).toBe('a1');
  });

  it('wires on<event> props as listeners', () => {
    const onclick = vi.fn();
    h('button', { onclick }).click();
    expect(onclick).toHaveBeenCalledOnce();
  });
});
