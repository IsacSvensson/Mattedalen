import type { ItemState } from '../../engine';
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

export function stageFor(state: ItemState | undefined, unitUnlocked: boolean): Stage {
  if (!state || state.status === 'new') return unitUnlocked ? 'soil' : 'locked';
  if (state.status === 'learning') return state.box === 0 ? 'seed' : 'sprout';
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
        s('circle', { cx: 15.5, cy: 22, r: 2.2, fill: 'var(--berry)' }),
        s('circle', { cx: 23, cy: 17, r: 2.2, fill: 'var(--berry)' }),
        s('circle', { cx: 25, cy: 25, r: 2.2, fill: 'var(--berry)' }),
      ),
      symbol(
        'tree',
        s('path', { d: 'M18 33V22h4v11Z', fill: 'var(--trunk)', ...outline }),
        s('circle', { cx: 20, cy: 15, r: 10.5, fill: 'var(--leaf)', ...outline }),
        s('circle', { cx: 15.5, cy: 13, r: 2.2, fill: 'var(--flower)', ...outline, 'stroke-width': 1.2 }),
        s('circle', { cx: 24, cy: 11, r: 2.2, fill: 'var(--flower)', ...outline, 'stroke-width': 1.2 }),
        s('circle', { cx: 23, cy: 19, r: 2.2, fill: 'var(--flower)', ...outline, 'stroke-width': 1.2 }),
      ),
    ),
  );
}

export function plantIcon(stage: Stage, extraClass = ''): SVGSVGElement {
  return s('svg', { class: `plant plant-${stage} ${extraClass}`, viewBox: '0 0 40 40', 'aria-hidden': 'true' }, s('use', { href: `#plant-${stage}` }));
}
