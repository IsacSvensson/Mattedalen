import type { ItemId, ItemState } from '../../../engine';
import { divisionInSquare, factId, formatFact, MAX_FACTOR, MIN_FACTOR } from '../../../content/multiplication';
import { h, s } from '../../../shell/dom';
import { bears, BLOOM_LABEL, bloomFor, plantIcon, STAGE_LABEL, stageFor, type Bloom, type Stage } from '../../../shell/components/plant';
import { icon } from '../../../shell/components/icons';
import { sunflowerHead } from '../../../shell/components/scene';

export interface GridOptions {
  states: Record<ItemId, ItemState>;
  /** Units whose facts are part of the game and unlocked. */
  unlockedItemIds: Set<ItemId>;
  /** Facts that just grew; they get a small animation. */
  highlight?: Set<ItemId>;
  /** Tables the child knows completely: their numbers on the bed become sunflowers. */
  masteredTables?: Set<number>;
  /** Tables whose delat med the child knows completely: a harvest basket by their number. */
  harvestTables?: Set<number>;
  onSelect?: (info: { a: number; b: number; stage: Stage; bloom: Bloom }) => void;
}

/**
 * The map: the 10×10 multiplication grid as a garden bed. Row a, column b
 * holds a × b, so 3 × 7 and 7 × 3 mirror each other across the diagonal.
 * The square also holds the division ab ÷ b = a: its blossoms and fruit grow
 * on the plant (see `Bloom`).
 */
export function gardenGrid({ states, unlockedItemIds, highlight, masteredTables, harvestTables, onSelect }: GridOptions): HTMLElement {
  const head = (n: number) => {
    const basket = harvestTables?.has(n) ? h('span', { class: 'harvest-mark', title: `Hela delat med i ×${n} kan du!` }, icon('basket')) : null;
    if (masteredTables?.has(n)) return sunflowerLabel(n, basket);
    return h('div', { class: `grid-head${basket ? ' harvested' : ''}`, 'aria-hidden': 'true' }, n, basket);
  };
  const cells: HTMLElement[] = [h('div', { class: 'grid-corner', 'aria-hidden': 'true' }, '×')];
  for (let b = MIN_FACTOR; b <= MAX_FACTOR; b++) cells.push(head(b));
  for (let a = MIN_FACTOR; a <= MAX_FACTOR; a++) {
    cells.push(head(a));
    for (let b = MIN_FACTOR; b <= MAX_FACTOR; b++) {
      const id = factId(a, b);
      const stage = stageFor(states[id], unlockedItemIds.has(id));
      const division = divisionInSquare(a, b);
      const bloom = bears(stage) ? bloomFor(states[division]) : 'none';
      const grew = highlight?.has(id) || highlight?.has(division);
      cells.push(
        h(
          'button',
          {
            class: `grid-cell stage-${stage}${a === b ? ' diagonal' : ''}${grew ? ' grew' : ''}`,
            type: 'button',
            'aria-label': `${formatFact(a, b)}: ${STAGE_LABEL[stage]}${bloom !== 'none' ? ` med ${BLOOM_LABEL[bloom]}` : ''}`,
            onclick: () => onSelect?.({ a, b, stage, bloom }),
          },
          plantIcon(stage, '', bloom),
        ),
      );
    }
  }
  return h('div', { class: 'garden-grid', role: 'group', 'aria-label': 'Trädgården' }, cells);
}

/** A table number that has become a sunflower: the child knows every fact in it. */
function sunflowerLabel(n: number, basket: HTMLElement | null): HTMLElement {
  const flower = s('svg', { class: 'sunflower', viewBox: '-21 -21 42 42', 'aria-hidden': 'true' });
  flower.innerHTML = sunflowerHead(false);
  return h('div', { class: `grid-head mastered${basket ? ' harvested' : ''}`, title: `Hela ×${n} kan du!` }, flower, h('span', { 'aria-hidden': 'true' }, n), basket);
}
