import { HOP_MS } from '../../../shell/components/numberLine';
import { h, prefersReducedMotion, s } from '../../../shell/dom';

/**
 * The empty number line ("tom tallinje"): a line with only the tens marked and
 * the numbers the child lands on. Hops are drawn to scale, so a hop of ten is
 * long and a hop of three short: 47 → 50 → 55 is +3 and +5 via the ten.
 * At the brook every number is a stone; up to 100 only the tens are.
 */
export interface EmptyLineOptions {
  /** Landing points, in order (e.g. [47, 50, 55]). Only the first is shown when `hops` is false. */
  stops: number[];
  hops?: boolean;
  animate?: boolean;
  onDone?: () => void;
}

const W = 360;
const PAD = 26;

export function emptyNumberLine({ stops, hops = true, animate = false, onDone }: EmptyLineOptions): HTMLElement {
  const lo = Math.floor(Math.min(...stops) / 10) * 10;
  let hi = Math.ceil(Math.max(...stops) / 10) * 10;
  if (hi === lo) hi += 10;
  const height = hops ? 104 : 62;
  const base = height - 30;
  const x = (n: number) => PAD + ((n - lo) / (hi - lo)) * (W - 2 * PAD);
  const shown = hops ? stops : stops.slice(0, 1);
  let markup = `<path class="el-line" d="M${PAD - 16} ${base} H${W - PAD + 16}"/>`;
  // The tens: a short mark and a quiet number, unless a landing point stands right beside it.
  for (let t = lo; t <= hi; t += 10) {
    markup += `<path class="el-ten" d="M${x(t)} ${base - 7} v14"/>`;
    const crowded = shown.some((n) => n !== t && Math.abs(x(n) - x(t)) < 20);
    if (!crowded && !shown.includes(t)) markup += `<text class="el-ten-label" x="${x(t)}" y="${base + 22}">${t}</text>`;
  }
  shown.forEach((n, i) => {
    markup +=
      `<circle class="el-stop${i === 0 ? ' start' : ''}" cx="${x(n)}" cy="${base}" r="${i === 0 ? 6 : 5}"/>` +
      `<text class="el-stop-label" x="${x(n)}" y="${base + 22}">${n}</text>`;
  });
  if (hops) {
    stops.slice(1).forEach((to, i) => {
      const from = stops[i] as number;
      const x1 = x(from);
      const x2 = x(to);
      const lift = Math.min(40, 10 + Math.abs(x2 - x1) * 0.28);
      const delay = animate && !prefersReducedMotion() ? i * HOP_MS : 0;
      const diff = to - from;
      markup +=
        `<path class="nl-hop el-hop${animate ? ' animate' : ''}" style="animation-delay:${delay}ms" pathLength="1" ` +
        `d="M${x1} ${base - 6} Q${(x1 + x2) / 2} ${base - 6 - lift * 2} ${x2} ${base - 6}"/>` +
        `<text class="nl-hop-label${animate ? ' animate' : ''}" style="animation-delay:${delay}ms" x="${(x1 + x2) / 2}" y="${base - 10 - lift}">` +
        `${diff > 0 ? '+' : '−'}${Math.abs(diff)}</text>`;
    });
  }
  const svg = s('svg', { class: 'empty-line-svg', viewBox: `0 0 ${W} ${height}`, 'aria-hidden': 'true' });
  svg.innerHTML = markup;
  if (onDone) setTimeout(onDone, animate && hops && !prefersReducedMotion() ? (stops.length - 1) * HOP_MS : 0);
  return h('div', { class: 'empty-line' }, svg);
}
