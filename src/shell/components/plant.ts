import { hasBeenFluent, type ItemState } from '../../engine';
import { s } from '../dom';

/** Growth stages on the map: frö → planta → buske → träd. */
export type Stage = 'locked' | 'soil' | 'seed' | 'sprout' | 'bush' | 'tree';

export const STAGE_LABEL: Record<Stage, string> = {
  locked: 'äng, inte upplåst än',
  soil: 'grävd jord, väntar på ett frö',
  seed: 'frö',
  sprout: 'planta',
  bush: 'buske',
  tree: 'träd',
};

export const STAGE_ORDER: Stage[] = ['locked', 'soil', 'seed', 'sprout', 'bush', 'tree'];

/**
 * Delat med on a bush or tree (docs/PLAN-DELAT-MED.md): blossoms while the
 * square's division is practised, small green fruit (kart) once it sits,
 * ripe fruit once it is automatic. Drawn on top of the plant, so the plant
 * still says only how well the multiplication is known.
 */
export type Bloom = 'none' | 'blossom' | 'kart' | 'fruit';

export const BLOOM_LABEL: Record<Exclude<Bloom, 'none'>, string> = {
  blossom: 'blommor',
  kart: 'kart',
  fruit: 'mogen frukt',
};

export function bloomFor(state: ItemState | undefined): Bloom {
  if (!state || state.status === 'new') return 'none';
  if (state.status === 'learning') return 'blossom';
  return state.status === 'fluent' ? 'kart' : 'fruit';
}

/** Blossoms and fruit grow only on a bush or a tree. */
export const bears = (stage: Stage) => stage === 'bush' || stage === 'tree';

export function stageFor(state: ItemState | undefined, unitUnlocked: boolean): Stage {
  if (!state || state.status === 'new') return unitUnlocked ? 'soil' : 'locked';
  // A seed only until it has grown once: a fact that has been a bush comes back as a sprout.
  if (state.status === 'learning') return state.box === 0 && !hasBeenFluent(state) ? 'seed' : 'sprout';
  return state.status === 'fluent' ? 'bush' : 'tree';
}

/**
 * SVG sprite with one symbol per stage, inserted once into the document and
 * referenced with <use>. Drawn inline so the app needs no image files.
 *
 * Only the plant says how well a fact is known; whether the square is open
 * (meadow or dug earth) is shown by the cell behind it (see the garden CSS).
 */
export function plantSprite(): SVGSVGElement {
  const outline = { stroke: 'var(--ink)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
  const furrow = (d: string) => s('path', { d, stroke: 'var(--furrow)', 'stroke-width': 2, 'stroke-linecap': 'round', fill: 'none' });
  const symbol = (id: Stage, ...children: SVGElement[]) => s('symbol', { id: `plant-${id}`, viewBox: '0 0 40 40' }, ...children);
  return s(
    'svg',
    { width: 0, height: 0, style: 'position:absolute', 'aria-hidden': 'true' },
    s(
      'defs',
      null,
      // Meadow: not open yet. A tuft of grass, nothing planted.
      symbol(
        'locked',
        s('path', { d: 'M17 30c-.5-4-2-6.5-4.5-8M19.5 30c0-5 .8-8.5 2.5-11M22 30c.8-3 2.5-5 5-6', stroke: 'var(--tuft)', 'stroke-width': 2.2, 'stroke-linecap': 'round', fill: 'none' }),
      ),
      // Dug earth: open, waiting for a seed.
      symbol('soil', furrow('M10 31h20M13 25h14')),
      symbol('seed', furrow('M9 32h22'), s('ellipse', { cx: 20, cy: 25.5, rx: 5.2, ry: 4, fill: 'var(--seed)', ...outline })),
      symbol(
        'sprout',
        s('path', { d: 'M20 32V21', stroke: 'var(--ink)', 'stroke-width': 2.4, 'stroke-linecap': 'round' }),
        s('path', { d: 'M20 24c-6 0-8-5-8-7 5 0 8 3 8 7Z', fill: 'var(--leaf)', ...outline }),
        s('path', { d: 'M20 22c6 0 8-5 8-7-5 0-8 3-8 7Z', fill: 'var(--leaf-light)', ...outline }),
      ),
      symbol(
        'bush',
        s('path', { d: 'M11 31a6.5 6.5 0 0 1-1.5-11.5A9 9 0 0 1 20 9a9 9 0 0 1 10.5 10.5A6.5 6.5 0 0 1 29 31Z', fill: 'var(--leaf-light)', ...outline }),
        s('path', { d: 'M15 22.5c2 1.5 4 1.5 6 0M22 16c1.2.8 2.5.8 3.5 0', stroke: 'var(--leaf)', 'stroke-width': 1.6, 'stroke-linecap': 'round', fill: 'none' }),
      ),
      symbol(
        'tree',
        s('path', { d: 'M18 33V22h4v11Z', fill: 'var(--trunk)', ...outline }),
        s('circle', { cx: 20, cy: 15, r: 10.5, fill: 'var(--leaf)', ...outline }),
        s('path', { d: 'M14 15c1.5 1.2 3.5 1.2 5 0M21 10c1.2 1 3 1 4.2 0', stroke: '#3f7f3a', 'stroke-width': 1.6, 'stroke-linecap': 'round', fill: 'none' }),
      ),
      ...(['bush', 'tree'] as const).flatMap((on) => (['blossom', 'kart', 'fruit'] as const).map((bloom) => bloomSymbol(on, bloom))),
    ),
  );
}

/** Where blossoms and fruit sit: on the bush's leaves, or in the tree's crown. */
const SPOTS: Record<'bush' | 'tree', [number, number][]> = {
  bush: [
    [15, 22],
    [23.5, 16.5],
    [25, 25],
  ],
  tree: [
    [15, 13],
    [24, 10.5],
    [23.5, 19],
  ],
};

/** Shapes differ, not just colours: five-petalled white flowers, small green balls, red berries or apples with a stem. */
function bloomSymbol(on: 'bush' | 'tree', bloom: Exclude<Bloom, 'none'>): SVGElement {
  const ink = { stroke: 'var(--ink)', 'stroke-width': 1.1, 'stroke-linejoin': 'round' };
  const one = ([x, y]: [number, number]): SVGElement[] => {
    if (bloom === 'blossom') {
      const petals = [0, 72, 144, 216, 288].map((deg) => {
        const r = (deg * Math.PI) / 180;
        return s('circle', { cx: x + Math.sin(r) * 1.7, cy: y - Math.cos(r) * 1.7, r: 1.45, fill: 'var(--blossom)', ...ink, 'stroke-width': 0.8 });
      });
      return [...petals, s('circle', { cx: x, cy: y, r: 1.1, fill: 'var(--flower)' })];
    }
    if (bloom === 'kart') return [s('circle', { cx: x, cy: y, r: 2, fill: 'var(--kart)', ...ink, 'stroke-width': 1.3 })];
    if (on === 'bush') return [s('circle', { cx: x, cy: y, r: 2.5, fill: 'var(--berry)', ...ink }), s('circle', { cx: x - 0.8, cy: y - 0.8, r: 0.6, fill: '#fff', opacity: 0.8 })];
    return [
      s('path', { d: `M${x} ${y - 2.2}l.8-1.6`, stroke: 'var(--trunk)', 'stroke-width': 1.1, 'stroke-linecap': 'round' }),
      s('circle', { cx: x, cy: y, r: 2.7, fill: 'var(--apple)', ...ink }),
      s('circle', { cx: x - 0.9, cy: y - 0.9, r: 0.65, fill: '#fff', opacity: 0.8 }),
    ];
  };
  return s('symbol', { id: `bloom-${on}-${bloom}`, viewBox: '0 0 40 40' }, ...SPOTS[on].flatMap(one));
}

export function plantIcon(stage: Stage, extraClass = '', bloom: Bloom = 'none'): SVGSVGElement {
  const shown = bears(stage) && bloom !== 'none';
  return s(
    'svg',
    { class: `plant plant-${stage}${shown ? ` bloom-${bloom}` : ''} ${extraClass}`, viewBox: '0 0 40 40', 'aria-hidden': 'true' },
    s('use', { href: `#plant-${stage}` }),
    shown ? s('use', { href: `#bloom-${stage}-${bloom}`, class: 'bloom' }) : null,
  );
}

/** A bush with blossoms, kart or fruit: delat med as the child sees it. */
export function bloomIcon(bloom: Exclude<Bloom, 'none'>, on: 'bush' | 'tree' = 'bush'): SVGSVGElement {
  return plantIcon(on, '', bloom);
}
