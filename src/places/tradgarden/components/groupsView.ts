import { h } from '../../../shell/dom';
import { numberLine } from '../../../shell/components/numberLine';
import { basketIcon, berry } from './shareBuilder';

/**
 * "Lika stora grupper" as a picture: baskets with the same number of berries
 * in each (3 baskets with 4), read as 4 + 4 + 4 and as 3 × 4. Empty baskets
 * show that 3 groups of 0 are 0.
 */
export function groupsView(groups: number, each: number): HTMLElement {
  return h(
    'div',
    { class: 'share-builder groups-view', role: 'img', 'aria-label': `${groups} korgar med ${each} i varje` },
    h(
      'div',
      { class: 'share-baskets', style: `--n:${groups}` },
      Array.from({ length: groups }, () =>
        h('span', { class: 'share-basket still' }, h('span', { class: 'basket-berries', 'aria-hidden': 'true' }, Array.from({ length: each }, berry)), basketIcon()),
      ),
    ),
  );
}

/** Hopping in steps on the number line (2, 4, 6, 8), as long as it stays within 20; otherwise none. */
export function skipView(stops: number[]): HTMLElement | null {
  if (Math.max(...stops) > 20) return null;
  return numberLine({ stops });
}
