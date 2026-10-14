/** Minimal DOM helpers: enough structure for a handful of screens without a framework. */

export type Child = Node | string | number | null | undefined | false | Child[];

type Handler = (ev: Event) => void;
export type Props = Record<string, unknown> & {
  class?: string;
  style?: string;
  dataset?: Record<string, string>;
};

function append(el: Element, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : String(c));
  }
}

function applyProps(el: Element, props: Props | undefined): void {
  if (!props) return;
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.setAttribute('class', String(value));
    else if (key === 'dataset') Object.assign((el as HTMLElement).dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value as Handler);
    else if (key === 'value' || key === 'disabled' || key === 'checked') (el as unknown as Record<string, unknown>)[key] = value;
    else el.setAttribute(key, value === true ? '' : String(value));
  }
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  applyProps(el, props ?? undefined);
  append(el, children);
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function s<K extends keyof SVGElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  applyProps(el, props ?? undefined);
  append(el, children);
  return el;
}

/** Wait helper for small UI pauses. */
export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
