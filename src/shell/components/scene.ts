import { h, s } from '../dom';
import { icon } from './icons';

/**
 * The landscape band at the top of the child's screens: sky, sun (or moon),
 * two hills and – in the garden – one sunflower per table the child knows.
 *
 * The hills stretch with the screen (non-scaling outline), while the sun and
 * the sunflowers keep their shape and are placed on the hill's curve.
 */

const backHill = (x: number) => 0.6 + 0.07 * Math.sin(2 * Math.PI * (x * 1.1 + 0.15));
const frontHill = (x: number) => 0.8 + 0.055 * Math.sin(2 * Math.PI * (x * 0.9 + 0.55));

function hillPath(y: (x: number) => number, height: number): string {
  let d = `M0 ${height + 4}`;
  for (let i = 0; i <= 50; i++) d += ` L${i * 2} ${(y(i / 50) * height).toFixed(1)}`;
  return `${d} L100 ${height + 4} Z`;
}

const PETALS = Array.from({ length: 12 }, (_, i) => i * 30);

/** A sunflower head (petals and seed centre) centred on 0,0 with radius ~20. */
export function sunflowerHead(withSeeds = true): string {
  const petals = PETALS.map((r) => `<ellipse cx="0" cy="-12.5" rx="4.6" ry="7.6" transform="rotate(${r})" class="sf-petal"/>`).join('');
  const seeds = withSeeds
    ? '<circle cx="-3" cy="-2.5" r="1.3" class="sf-seed"/><circle cx="3" cy="-2.5" r="1.3" class="sf-seed"/><circle cx="0" cy="2.5" r="1.3" class="sf-seed"/><circle cx="-4.5" cy="2.5" r="1.1" class="sf-seed"/><circle cx="4.5" cy="2.5" r="1.1" class="sf-seed"/>'
    : '';
  return `${petals}<circle r="9.5" class="sf-centre"/>${seeds}`;
}

/** A whole sunflower on a stem (for the hill), 40 wide, `stem` tall below the head. */
function sunflowerPlant(stem: number): SVGSVGElement {
  const svg = s('svg', { class: 'scene-sunflower', viewBox: `-22 -22 44 ${44 + stem}`, 'aria-hidden': 'true' });
  svg.innerHTML =
    `<path d="M0 8V${22 + stem}" class="sf-stem"/>` +
    `<path d="M0 ${14 + stem * 0.6}c-4-6-10-7-14-5 2 5 8 8 14 5Z" class="sf-leaf"/>` +
    `<path d="M0 ${10 + stem * 0.35}c4-6 10-7 14-5-2 5-8 8-14 5Z" class="sf-leaf"/>` +
    sunflowerHead();
  return svg;
}

/** Spots for the sunflowers along the front hill (fraction of the width), in planting order. */
const SPOTS = [0.6, 0.74, 0.47, 0.87, 0.34, 0.95, 0.21, 0.67, 0.81, 0.08];

export interface SceneOptions {
  /** Height in px. */
  height: number;
  /** One sunflower per table the child knows (0–10). */
  sunflowers?: number;
  /** How many of the sunflowers have a harvest basket at their foot (tables whose delat med the child knows). */
  baskets?: number;
  sun?: boolean;
  cloud?: boolean;
}

export function scene({ height, sunflowers = 0, baskets = 0, sun = true, cloud = true }: SceneOptions): HTMLElement {
  const hills = s('svg', { class: 'scene-hills', viewBox: `0 0 100 ${height}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  hills.innerHTML =
    `<path d="${hillPath(backHill, height)}" class="hill-back"/>` +
    `<path d="${hillPath(frontHill, height)}" class="hill-front"/>` +
    // A soft band of shade along the foot of the front hill (no outline).
    `<path d="${hillPath((x) => frontHill(x) + 0.1, height)}" class="hill-shade"/>`;

  const flowers = SPOTS.slice(0, Math.max(0, Math.min(sunflowers, SPOTS.length))).map((x, i) => {
    const stem = 10 + ((i * 7) % 3) * 4;
    const el = sunflowerPlant(stem);
    // Sized by the head (--sf-head, set in CSS) and placed by fractions of the
    // band, so they stay on the hill when the band is made lower (landscape phones).
    const tall = (44 + stem) / 44;
    el.style.left = `${x * 100}%`;
    el.style.top = `calc(${(frontHill(x) * 100).toFixed(2)}% + 0.18 * var(--sf-head) - ${tall.toFixed(3)} * var(--sf-head))`;
    el.style.width = 'var(--sf-head)';
    el.style.height = `calc(${tall.toFixed(3)} * var(--sf-head))`;
    if (i >= baskets) return [el];
    // A harvest basket at the flower's foot, on the hill.
    const basket = icon('basket', 'scene-basket');
    basket.style.left = `${x * 100}%`;
    basket.style.top = `${(frontHill(x) * 100).toFixed(2)}%`;
    return [el, basket];
  });

  const sky = s('svg', { class: 'scene-sky', viewBox: '0 0 120 60', 'aria-hidden': 'true' });
  sky.innerHTML =
    (cloud ? '<path d="M8 40c0-8 14-10 18-4 4-7 18-6 18 4Z" class="cloud"/>' : '') +
    (sun
      ? `<g class="sun" transform="translate(94 26)"><circle r="14"/>${[0, 45, 90, 135, 180, 225, 270, 315]
          .map((r) => `<path d="M0 -20v-5" transform="rotate(${r})"/>`)
          .join('')}</g><path class="moon" d="M100 37a14 14 0 1 1-12-24 11 11 0 0 0 12 24Z"/>`
      : '');

  return h('div', { class: 'scene', style: `height:${height}px` }, sky, hills, flowers.flat());
}
