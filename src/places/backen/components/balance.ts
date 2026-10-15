import type { Equality } from '../../../content/addition';
import { h, s } from '../../../shell/dom';

/**
 * Vågen: the two sides of an equality on a level scale. The equal sign means
 * "as much on both sides". The scale is drawn level and never tips, so it does
 * not give away whether a statement is true.
 */
export function balance(e: Equality): HTMLElement {
  const side = (xs: (number | null)[]) => xs.map((x) => (x === null ? '?' : String(x))).join(' + ');
  const svg = s('svg', { class: 'balance-svg', viewBox: '0 0 240 120', 'aria-hidden': 'true' });
  svg.innerHTML =
    '<path class="bal-post" d="M120 30 V104 M96 108 H144"/>' +
    '<path class="bal-beam" d="M36 30 H204"/>' +
    '<circle class="bal-pivot" cx="120" cy="30" r="6"/>' +
    '<path class="bal-string" d="M44 30 L32 62 M44 30 L56 62 M196 30 L184 62 M196 30 L208 62"/>' +
    '<path class="bal-pan" d="M18 62 H70 Q66 78 44 78 Q22 78 18 62 Z"/>' +
    '<path class="bal-pan" d="M170 62 H222 Q218 78 196 78 Q174 78 170 62 Z"/>';
  return h(
    'div',
    { class: 'balance' },
    svg,
    h('span', { class: 'bal-side left' }, side(e.left)),
    h('span', { class: 'bal-side right' }, side(e.right)),
  );
}
