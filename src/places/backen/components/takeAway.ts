import { h, s } from '../../../shell/dom';

/**
 * Minus as taking away (docs/PLAN-PLUSFORST.md): `x` stones in rows of ten,
 * and the last `y` of them hop away and stay faint and crossed out. With
 * reduced motion they are faint and crossed out from the start.
 */
export function takeAway(x: number, y: number): HTMLElement {
  const per = Math.min(10, Math.max(1, x));
  const rows = Math.max(1, Math.ceil(x / 10));
  const cell = 28;
  const svg = s('svg', { class: 'take-away-svg', viewBox: `0 0 ${per * cell} ${rows * cell}`, 'aria-hidden': 'true' });
  let markup = '';
  for (let i = 0; i < x; i++) {
    const cx = (i % 10) * cell + cell / 2;
    const cy = Math.floor(i / 10) * cell + cell / 2;
    const gone = i >= x - y;
    markup += `<g class="ta-stone${gone ? ' gone' : ''}"><circle cx="${cx}" cy="${cy}" r="10"/>${
      gone ? `<path class="ta-cross" d="M${cx - 7} ${cy - 7}l14 14M${cx + 7} ${cy - 7}l-14 14"/>` : ''
    }</g>`;
  }
  svg.innerHTML = markup;
  // As big as the stones on the number line, however few they are.
  return h('div', { class: 'take-away', style: `--per: ${per}` }, svg);
}
