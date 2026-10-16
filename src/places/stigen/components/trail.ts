import { h, s } from '../../../shell/dom';

/**
 * Stigen: a sandy path with a post at every ten, 10 to 100, and a lantern for
 * every part ("del"). That is what the child knows, in a form of its own (the
 * brook has stones in its bridge, the garden its plants).
 *
 * - availability: an open part has a lantern on its post; a part that is not
 *   open yet has only the empty hook
 * - knowledge: the flame grows as more of the part sits, and the lantern is
 *   lit (with a warm glow) when about as much sits as opens what comes after
 *
 * The posts 20 to 90 carry the eight lanterns, in the parts' order. The path
 * starts at the post by 10 and ends at 100.
 */
export interface Lantern {
  title: string;
  open: boolean;
  /** Share of the part that sits (fluent or better), 0–1. */
  known: number;
}

/** A lantern is lit when about as much sits as opens the parts after it. */
export const LIT_AT = 0.8;

export const litCount = (lanterns: Lantern[]) => lanterns.filter((l) => l.open && l.known >= LIT_AT).length;

/** The part the child is on: the first open one that is not lit yet (or the last open one). */
export function currentPart(lanterns: Lantern[]): number {
  const at = lanterns.findIndex((l) => l.open && l.known < LIT_AT);
  if (at >= 0) return at;
  const open = lanterns.map((l, i) => (l.open ? i : -1)).filter((i) => i >= 0);
  return open.length ? open[open.length - 1]! : 0;
}

const POSTS = 10;

/**
 * The path, with the child's animal by the post of the part it is on (on
 * Stigen's own screen).
 */
export function trail(lanterns: Lantern[], walker?: Element): HTMLElement {
  const at = currentPart(lanterns);
  const el = h('div', { class: 'trail large' }, largeTrail(lanterns));
  if (walker) {
    // Between the post with the part's lantern and the next one.
    const x = postX(at + 1) + 25.5;
    el.append(h('span', { class: 'trail-walker', style: `left:${((100 * x) / W).toFixed(1)}%`, 'aria-hidden': 'true' }, walker));
  }
  return el;
}

const W = 520;
const H = 150;
const postX = (i: number) => 30 + i * 51;

function largeTrail(lanterns: Lantern[]): SVGSVGElement {
  const svg = s('svg', { class: 'trail-svg', viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });
  // The sandy path, a little uneven, from edge to edge.
  let markup = `<path class="tr-path" d="M-4 132 C 90 124, 170 138, 260 130 S 430 122, 524 130"/>`;
  for (let i = 0; i < POSTS; i++) {
    const x = postX(i);
    const lantern = i >= 1 && i <= lanterns.length ? lanterns[i - 1] : undefined;
    markup += `<rect class="tr-post" x="${x - 4}" y="46" width="8" height="86" rx="2"/>`;
    if (i >= 1 && i <= lanterns.length) {
      // The arm the lantern hangs from.
      markup += `<path class="tr-arm" d="M${x} 52 H${x + 17}"/>`;
      markup += lantern?.open ? lanternMarkup(x + 15, lantern.known) : `<path class="tr-hook" d="M${x + 15} 52 v5 a2.5 2.5 0 0 1 -5 0"/>`;
    }
    // The number on top of the post: the tens the path goes through.
    markup += `<rect class="tr-plate" x="${x - 15}" y="26" width="30" height="18" rx="4"/><text class="tr-number" x="${x}" y="39.5">${10 * (i + 1)}</text>`;
  }
  svg.innerHTML = markup;
  return svg;
}

/** A lantern hanging at (x, 52): roof, glass, base; the flame grows with what sits, and a lit one glows. */
function lanternMarkup(x: number, known: number): string {
  const fill = Math.max(0, Math.min(1, known));
  const lit = fill >= LIT_AT;
  const k = 0.45 + 0.55 * fill;
  return (
    (lit ? `<circle class="tr-glow" cx="${x}" cy="72" r="20"/>` : '') +
    `<path class="tr-hanger" d="M${x} 52 V58"/>` +
    `<path class="tr-roof" d="M${x - 9} 65 L${x} 57 L${x + 9} 65 Z"/>` +
    `<rect class="tr-glass${lit ? ' lit' : ''}" x="${x - 7}" y="65" width="14" height="17" rx="1.5"/>` +
    (fill > 0 ? `<path class="tr-flame${lit ? ' lit' : ''}" d="M${x} ${74 - 6 * k} c ${3 * k} ${4 * k}, ${3.6 * k} ${6 * k}, 0 ${8 * k} c ${-3.6 * k} ${-2 * k}, ${-3 * k} ${-4 * k}, 0 ${-8 * k} Z"/>` : '') +
    `<rect class="tr-base" x="${x - 8}" y="82" width="16" height="4" rx="1.5"/>`
  );
}
