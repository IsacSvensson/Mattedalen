import type { ItemState } from '../../engine';
import { s } from '../dom';

/** Growth stages on the map: frö → planta → buske → träd. */
export type Stage = 'locked' | 'soil' | 'seed' | 'sprout' | 'bush' | 'tree';

export const STAGE_LABEL: Record<Stage, string> = {
  locked: 'inte upplåst än',
  soil: 'tom jord',
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
 */
export function plantSprite(): SVGSVGElement {
  const soil = () => s('ellipse', { cx: 20, cy: 33, rx: 13, ry: 4.5, fill: 'var(--soil)' });
  const symbol = (id: Stage, ...children: SVGElement[]) => s('symbol', { id: `plant-${id}`, viewBox: '0 0 40 40' }, ...children);
  return s(
    'svg',
    { width: 0, height: 0, style: 'position:absolute', 'aria-hidden': 'true' },
    s(
      'defs',
      null,
      symbol('locked', s('ellipse', { cx: 20, cy: 33, rx: 11, ry: 3.5, fill: 'var(--soil-locked)' })),
      symbol('soil', soil()),
      symbol('seed', soil(), s('ellipse', { cx: 20, cy: 29.5, rx: 3.2, ry: 2.4, fill: 'var(--seed)' })),
      symbol(
        'sprout',
        soil(),
        s('path', { d: 'M20 31 V20', stroke: 'var(--stem)', 'stroke-width': 2.2, 'stroke-linecap': 'round' }),
        s('path', { d: 'M20 23 C14 23 12 18 12 16 C17 16 20 19 20 23 Z', fill: 'var(--leaf)' }),
        s('path', { d: 'M20 21 C26 21 28 16 28 14 C23 14 20 17 20 21 Z', fill: 'var(--leaf-light)' }),
      ),
      symbol(
        'bush',
        soil(),
        s('circle', { cx: 14, cy: 25, r: 7, fill: 'var(--leaf)' }),
        s('circle', { cx: 26, cy: 25, r: 7, fill: 'var(--leaf)' }),
        s('circle', { cx: 20, cy: 19, r: 8.5, fill: 'var(--leaf-light)' }),
        s('circle', { cx: 17, cy: 17, r: 2, fill: 'var(--berry)' }),
        s('circle', { cx: 24, cy: 23, r: 2, fill: 'var(--berry)' }),
      ),
      symbol(
        'tree',
        soil(),
        s('rect', { x: 18, y: 20, width: 4, height: 12, rx: 1.5, fill: 'var(--trunk)' }),
        s('circle', { cx: 20, cy: 14, r: 11, fill: 'var(--leaf)' }),
        s('circle', { cx: 15, cy: 11, r: 6, fill: 'var(--leaf-light)' }),
        s('circle', { cx: 14, cy: 16, r: 2.2, fill: 'var(--flower)' }),
        s('circle', { cx: 25, cy: 10, r: 2.2, fill: 'var(--flower)' }),
        s('circle', { cx: 24, cy: 18, r: 2.2, fill: 'var(--flower)' }),
      ),
    ),
  );
}

export function plantIcon(stage: Stage, extraClass = ''): SVGSVGElement {
  return s('svg', { class: `plant plant-${stage} ${extraClass}`, viewBox: '0 0 40 40', 'aria-hidden': 'true' }, s('use', { href: `#plant-${stage}` }));
}
