import { s } from '../../../shell/dom';
import type { Lantern } from '../../stigen/components/trail';
import { LIT_AT } from '../../stigen/components/trail';

/**
 * Klocktornet as a picture (docs/PLAN-KLOCKAN.md, KL3): a tower with a clock
 * at the top and a window for every part, from the day at the foot to five
 * minutes at a time at the top. A window lights when its part sits, as
 * Stigen's lanterns do. A drawing, never a control.
 */
const W = 160;
const H = 300;
/** The windows from the foot up: two side by side, then the last one alone under the clock. */
const WINDOWS: [number, number][] = [
  [52, 250],
  [92, 250],
  [52, 205],
  [92, 205],
  [52, 160],
  [92, 160],
  [72, 118],
];

export function towerArt(parts: Lantern[]): SVGSVGElement {
  const svg = s('svg', { class: 'tower-svg', viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });
  let markup =
    // The roof, the body and the door.
    `<path class="tw-roof" d="M24 64 L80 8 L136 64 Z"/>` +
    `<rect class="tw-body" x="34" y="62" width="92" height="232" rx="4"/>` +
    `<path class="tw-door" d="M66 294 V276 a14 14 0 0 1 28 0 V294 Z"/>` +
    // The clock, ten past ten as on a clock in a shop window.
    `<circle class="tw-face" cx="80" cy="84" r="17"/>` +
    `<line class="tw-hand" x1="80" y1="84" x2="80" y2="72"/>` +
    `<line class="tw-hand" x1="80" y1="84" x2="${80 + 9 * Math.sin((10.17 / 12) * 2 * Math.PI)}" y2="${84 - 9 * Math.cos((10.17 / 12) * 2 * Math.PI)}"/>`;
  parts.slice(0, WINDOWS.length).forEach((part, i) => {
    const [x, y] = WINDOWS[i]!;
    const cls = !part.open ? 'closed' : part.known >= LIT_AT ? 'lit' : part.known > 0 ? 'started' : 'open';
    markup += `<rect class="tw-window ${cls}" x="${x}" y="${y}" width="16" height="22" rx="8"/>`;
  });
  svg.innerHTML = markup;
  return svg;
}
