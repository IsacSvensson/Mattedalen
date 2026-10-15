import { h, s } from '../../../shell/dom';

/**
 * The hundred chart ("hundraplattan"): 1 to 100 in ten rows of ten. A hop of
 * ten is one step straight down (or up), and a hop of one a step to the side,
 * so 26 + 30 is three steps down: 26, 36, 46, 56.
 */
const CELL = 26;

export function hundredChart(stops: number[]): HTMLElement {
  const size = 10 * CELL + 2;
  const pos = (n: number) => ({ x: 1 + ((n - 1) % 10) * CELL + CELL / 2, y: 1 + Math.floor((n - 1) / 10) * CELL + CELL / 2 });
  const on = new Set(stops);
  const first = stops[0];
  const last = stops[stops.length - 1];
  let markup = '';
  let numbers = '';
  for (let n = 1; n <= 100; n++) {
    const { x, y } = pos(n);
    const cls = n === last ? ' end' : n === first ? ' start' : on.has(n) ? ' stop' : '';
    markup += `<rect class="hc-cell${cls}${n % 10 === 0 ? ' ten' : ''}" x="${x - CELL / 2}" y="${y - CELL / 2}" width="${CELL}" height="${CELL}"/>`;
    numbers += `<text class="hc-number${cls}" x="${x}" y="${y + 4}">${n}</text>`;
  }
  // The way from stop to stop, under the numbers.
  stops.slice(1).forEach((to, i) => {
    const a = pos(stops[i]!);
    const b = pos(to);
    markup += `<path class="hc-hop" d="M${a.x} ${a.y} L${b.x} ${b.y}"/>`;
  });
  markup += numbers;
  const svg = s('svg', { class: 'hundred-chart-svg', viewBox: `0 0 ${size} ${size}`, 'aria-hidden': 'true' });
  svg.innerHTML = markup;
  return h('div', { class: 'hundred-chart' }, svg);
}
