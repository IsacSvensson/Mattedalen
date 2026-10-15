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
 * The blocks are square cut stones, unlike the round numbered stepping stones
 * of the number line, which are a tool.
 */
export interface BridgeStone {
  title: string;
  open: boolean;
  /** Share of the part's facts that sit (fluent or better), 0–1. */
  known: number;
}

/** A part counts as laid when about as much sits as opens what comes after it. */
export const LAID_AT = 0.8;

export function bridge(stones: BridgeStone[], size: 'large' | 'mini' = 'large'): HTMLElement {
  // The mini bridge on the map is an arch of bigger blocks, so it reads at a glance.
  const mini = size === 'mini';
  const w = mini ? 30 : 40;
  const gap = 4;
  const arch = mini ? 22 : 0;
  const top = 14 + arch;
  const height = mini ? 96 : 64;
  const blockH = mini ? 30 : height - 30 - 14 + 10;
  const width = stones.length * (w + gap) + gap + 24;
  const svg = s('svg', { class: `bridge-svg ${size}`, viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' });
  let markup =
    `<rect class="br-water" x="0" y="${height - 26}" width="${width}" height="26" rx="10"/>` +
    `<path class="br-bank" d="M0 ${height - 30} H14 V${height} H0 Z"/>` +
    `<path class="br-bank" d="M${width - 14} ${height - 30} H${width} V${height} H${width - 14} Z"/>` +
    // The arch the blocks rest on, from bank to bank.
    (mini ? `<path class="br-arch" d="M14 ${height - 28} Q${width / 2} ${top - arch * 2 + blockH * 2} ${width - 14} ${height - 28}"/>` : '');
  stones.forEach((stone, i) => {
    if (!stone.open) return;
    const x = 12 + gap + i * (w + gap);
    // Along the arch: highest in the middle.
    const t = stones.length > 1 ? i / (stones.length - 1) : 0.5;
    const y = top - arch * Math.sin(Math.PI * t);
    const fill = Math.max(0, Math.min(1, stone.known));
    const laid = fill >= LAID_AT;
    markup +=
      `<rect class="br-slot${laid ? ' laid' : ''}" x="${x}" y="${y}" width="${w}" height="${blockH}" rx="6"/>` +
      (fill > 0
        ? `<rect class="br-fill${laid ? ' laid' : ''}" x="${x + 3}" y="${y + blockH - 3 - (blockH - 6) * fill}" width="${w - 6}" height="${(blockH - 6) * fill}" rx="4"/>`
        : '');
  });
  svg.innerHTML = markup;
  return h('span', { class: `bridge ${size}` }, svg);
}

/** How many parts are laid, for words beside the picture. */
export const laidCount = (stones: BridgeStone[]) => stones.filter((x) => x.open && x.known >= LAID_AT).length;
