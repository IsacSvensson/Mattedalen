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

/* The arch on the map, in its own units: from bank to bank over the valley's brook. */
/** How many parts are laid, for words beside the picture. */
export const laidCount = (stones: BridgeStone[]) => stones.filter((x) => x.open && x.known >= LAID_AT).length;
