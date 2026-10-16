import { h, s } from '../../../shell/dom';

/**
 * The bridge over the brook: one block per part ("del") of Bäcken, which is
 * what the child knows.
 *
 * - availability: an open part has its place in the bridge (an outlined
 *   block); a part that is not open yet is still water
 * - knowledge: how full the block is (the share of the part that sits)
 * - whole area: when every block is full, the bridge reaches the other bank
 *
 * The blocks are cut stones, unlike the round numbered stepping stones of the
 * number line, which are a tool. They lie in a row from bank to bank.
 */
export interface BridgeStone {
  title: string;
  open: boolean;
  /** Share of the part's facts that sit (fluent or better), 0–1. */
  known: number;
}

/** A part counts as laid when about as much sits as opens what comes after it. */
export const LAID_AT = 0.8;

export function bridge(stones: BridgeStone[]): HTMLElement {
  return h('span', { class: 'bridge large' }, straightBridge(stones));
}

/** On the brook's own screen: a row of blocks from bank to bank over the water. */
function straightBridge(stones: BridgeStone[]): SVGSVGElement {
  const w = 40;
  const gap = 4;
  const top = 14;
  const height = 64;
  const blockH = height - 30 - 14 + 10;
  const width = stones.length * (w + gap) + gap + 24;
  const svg = s('svg', { class: 'bridge-svg large', viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' });
  let markup =
    `<rect class="br-water" x="0" y="${height - 26}" width="${width}" height="26" rx="10"/>` +
    `<path class="br-bank" d="M0 ${height - 30} H14 V${height} H0 Z"/>` +
    `<path class="br-bank" d="M${width - 14} ${height - 30} H${width} V${height} H${width - 14} Z"/>`;
  stones.forEach((stone, i) => {
    if (!stone.open) return;
    const x = 12 + gap + i * (w + gap);
    const fill = Math.max(0, Math.min(1, stone.known));
    const laid = fill >= LAID_AT;
    markup +=
      `<rect class="br-slot${laid ? ' laid' : ''}" x="${x}" y="${top}" width="${w}" height="${blockH}" rx="6"/>` +
      (fill > 0
        ? `<rect class="br-fill${laid ? ' laid' : ''}" x="${x + 3}" y="${top + blockH - 3 - (blockH - 6) * fill}" width="${w - 6}" height="${(blockH - 6) * fill}" rx="4"/>`
        : '');
  });
  svg.innerHTML = markup;
  return svg;
}

/** On the valley's map: the bridge as a stone arch over the valley's own brook. */
export function archBridge(stones: BridgeStone[]): HTMLElement {
  return h('span', { class: 'bridge arch' }, archSvg(stones));
}

/* The arch on the map, in its own units: from bank to bank over the valley's brook. */
const ARCH_W = 200;
const ARCH_H = 68;
/** The ground line: where the arch and its piers stand. */
const BASE = 58;
/** Half the angle the arch spans (a segmental arch, flatter than a half circle). */
const HALF = (62 * Math.PI) / 180;
const R_OUT = (ARCH_W / 2 - 12) / Math.sin(HALF);
const R_IN = R_OUT - 20;
const CX = ARCH_W / 2;
const CY = BASE + R_OUT * Math.cos(HALF);

const at = (angle: number, r: number) => `${(CX + r * Math.cos(angle)).toFixed(1)} ${(CY - r * Math.sin(angle)).toFixed(1)}`;

/** One stone of the arch between two angles, from the inner arc out to radius `r`. */
function voussoir(a: number, b: number, r: number): string {
  return `M${at(a, r)} A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${at(b, r)} L${at(b, R_IN)} A${R_IN.toFixed(1)} ${R_IN.toFixed(1)} 0 0 0 ${at(a, R_IN)} Z`;
}

/**
 * On the valley's map: a stone arch over the brook, one stone per part. An open part has
 * its place in the arch (outlined), filled from the inside as much as sits; a
 * part not open yet is a gap. Until every stone is laid, the wooden centering
 * the arch is built on stands underneath. The bridge's shade lies on the water.
 */
function archSvg(stones: BridgeStone[]): SVGSVGElement {
  const svg = s('svg', { class: 'bridge-svg arch', viewBox: `0 0 ${ARCH_W} ${ARCH_H}`, 'aria-hidden': 'true' });
  const n = Math.max(1, stones.length);
  const step = (2 * HALF) / n;
  const gap = 0.012;
  const done = stones.every((x) => x.open && x.known >= LAID_AT);
  let markup = `<ellipse class="br-shade" cx="${CX}" cy="${BASE + 3}" rx="20" ry="3.5"/>`;
  if (!done) {
    // The centering: a wooden arc on two struts, under where the stones go.
    const r = R_IN - 2.5;
    const leg = (angle: number) => {
      const [x, y] = at(angle, r).split(' ');
      return `M${x} ${y}V${BASE + 2}`;
    };
    markup +=
      `<path class="br-centering" d="M${at(Math.PI / 2 + HALF * 0.92, r)} A${r} ${r} 0 0 1 ${at(Math.PI / 2 - HALF * 0.92, r)}"/>` +
      `<path class="br-centering" d="${leg(Math.PI / 2 + HALF * 0.55)} ${leg(Math.PI / 2 - HALF * 0.55)}"/>`;
  }
  stones.forEach((stone, i) => {
    if (!stone.open) return;
    const a = Math.PI / 2 + HALF - i * step - gap;
    const b = Math.PI / 2 + HALF - (i + 1) * step + gap;
    const fill = Math.max(0, Math.min(1, stone.known));
    const laid = fill >= LAID_AT;
    markup +=
      `<path class="br-slot${laid ? ' laid' : ''}" d="${voussoir(a, b, R_OUT)}"/>` +
      (fill > 0 && !laid ? `<path class="br-fill" d="${voussoir(a, b, R_IN + (R_OUT - R_IN) * fill)}"/>` : '');
  });
  // The piers the arch stands on, one on each bank.
  const pier = (x: number) => `<rect class="br-pier" x="${x}" y="${BASE - 7}" width="26" height="15" rx="4"/>`;
  markup += pier(4) + pier(ARCH_W - 30);
  svg.innerHTML = markup;
  return svg;
}

/** How many parts are laid, for words beside the picture. */
export const laidCount = (stones: BridgeStone[]) => stones.filter((x) => x.open && x.known >= LAID_AT).length;
