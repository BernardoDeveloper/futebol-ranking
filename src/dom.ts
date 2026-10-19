type Child = Node | string | number | null | undefined | false;
type Prop = string | boolean | ((event: Event) => void) | undefined;

/**
 * Builds an element. Text children become text nodes, never HTML, so names typed by
 * players cannot inject markup. `on<event>` props add listeners; booleans toggle attributes.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, Prop> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'function') {
      element.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) {
      element.setAttribute(key, '');
    } else if (typeof value === 'string') {
      element.setAttribute(key, value);
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    element.append(typeof child === 'object' ? child : String(child));
  }
  return element;
}
