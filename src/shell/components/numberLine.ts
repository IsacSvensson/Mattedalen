import { h, prefersReducedMotion, s } from '../dom';

/**
 * The stepping stones over the brook: a linear, numbered number line with
 * stones of the same size at the same distance (Siegler & Ramani). The animal
 * hops between the landing points, 8 → 10 → 13, and each hop says how far it
 * goes (+2, +3). These stones are a tool; the bridge stones that show what the
 * child knows look different (square blocks, see bridge.ts).
 *
 * On narrow screens a window of 11 stones around the hops is shown instead of
 * all 21 (J7).
 */
export interface NumberLineOptions {
  /** Landing points, in order (e.g. [8, 10, 13]). Only the first is shown when `hops` is false. */
  stops: number[];
  /** Draw the hops between the stops (false: only mark where to start). */
  hops?: boolean;
  /** Animate the hops one after the other. */
  animate?: boolean;
  /** Called when the last hop has landed (right away when not animated). */
  onDone?: () => void;
}

const STONE = 36;
const MAX = 20;
const NARROW_WINDOW = 10;
/** Time per hop, ms. */
export const HOP_MS = 700;

/** Which numbers to show: all of 0–20, or a window of 11 around the hops on a narrow screen. */
export function visibleRange(stops: number[], narrow: boolean): [number, number] {
  if (!narrow) return [0, MAX];
  const lo = Math.min(...stops);
  const hi = Math.max(...stops);
  const mid = Math.round((lo + hi) / 2);
  let from = Math.max(0, mid - NARROW_WINDOW / 2);
  const to = Math.min(MAX, from + NARROW_WINDOW);
  from = Math.max(0, to - NARROW_WINDOW);
  return [Math.min(from, lo), Math.max(to, hi)];
}

const isNarrow = () => typeof matchMedia === 'function' && matchMedia('(max-width: 560px)').matches;

export function numberLine({ stops, hops = true, animate = false, onDone }: NumberLineOptions): HTMLElement {
  const [from, to] = visibleRange(stops, isNarrow());
  const count = to - from + 1;
  const width = count * STONE + 8;
  const height = hops ? 92 : 56;
  const base = height - 22;
  const x = (n: number) => 4 + (n - from) * STONE + STONE / 2;
  const svg = s('svg', { class: 'number-line-svg', viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' });
  const landing = new Set(hops ? stops : stops.slice(0, 1));

  let markup = `<rect class="nl-water" x="0" y="${base - 14}" width="${width}" height="30" rx="15"/>`;
  for (let n = from; n <= to; n++) {
    const on = landing.has(n);
    markup +=
      `<g class="nl-stone${on ? ' landing' : ''}${n === stops[0] ? ' start' : ''}">` +
      `<ellipse cx="${x(n)}" cy="${base}" rx="${on ? 16 : 14}" ry="${on ? 13 : 11}"/>` +
      `<text x="${x(n)}" y="${base + 5}">${n}</text></g>`;
  }
  if (hops) {
    stops.slice(1).forEach((to, i) => {
      const fromN = stops[i] as number;
      const x1 = x(fromN);
      const x2 = x(to);
      const lift = Math.min(34, 12 + Math.abs(x2 - x1) * 0.18);
      const delay = animate && !prefersReducedMotion() ? i * HOP_MS : 0;
      const diff = to - fromN;
      markup +=
        `<path class="nl-hop${delay || animate ? ' animate' : ''}" style="animation-delay:${delay}ms" pathLength="1" ` +
        `d="M${x1} ${base - 14} Q${(x1 + x2) / 2} ${base - 14 - lift * 2} ${x2} ${base - 14}"/>` +
        `<text class="nl-hop-label${animate ? ' animate' : ''}" style="animation-delay:${delay}ms" x="${(x1 + x2) / 2}" y="${base - 18 - lift}">` +
        `${diff > 0 ? '+' : '−'}${Math.abs(diff)}</text>`;
    });
  }
  svg.innerHTML = markup;
  const hopsCount = hops ? stops.length - 1 : 0;
  if (onDone) {
    const wait = animate && !prefersReducedMotion() ? hopsCount * HOP_MS : 0;
    setTimeout(onDone, wait);
  }
  return h('div', { class: 'number-line' }, svg);
}
