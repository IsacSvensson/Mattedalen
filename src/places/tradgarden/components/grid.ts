import type { ItemId, ItemState } from '../../../engine';
import { factId, formatFact, MAX_FACTOR, MIN_FACTOR } from '../../../content/multiplication';
import { h, s } from '../../../shell/dom';
import { plantIcon, STAGE_LABEL, stageFor, type Stage } from '../../../shell/components/plant';
import { sunflowerHead } from '../../../shell/components/scene';

export interface GridOptions {
  states: Record<ItemId, ItemState>;
  /** Units whose facts are part of the game and unlocked. */
  unlockedItemIds: Set<ItemId>;
  /** Facts that just grew; they get a small animation. */
  highlight?: Set<ItemId>;
  /** Tables the child knows completely: their numbers on the bed become sunflowers. */
  masteredTables?: Set<number>;
  onSelect?: (info: { a: number; b: number; stage: Stage }) => void;
}

/**
 * The map: the 10×10 multiplication grid as a garden bed. Row a, column b
 * holds a × b, so 3 × 7 and 7 × 3 mirror each other across the diagonal.
 */
export function gardenGrid({ states, unlockedItemIds, highlight, masteredTables, onSelect }: GridOptions): HTMLElement {
  const head = (n: number) => (masteredTables?.has(n) ? sunflowerLabel(n) : h('div', { class: 'grid-head', 'aria-hidden': 'true' }, n));
  const cells: HTMLElement[] = [h('div', { class: 'grid-corner', 'aria-hidden': 'true' }, '×')];
  for (let b = MIN_FACTOR; b <= MAX_FACTOR; b++) cells.push(head(b));
  for (let a = MIN_FACTOR; a <= MAX_FACTOR; a++) {
    cells.push(head(a));
    for (let b = MIN_FACTOR; b <= MAX_FACTOR; b++) {
      const id = factId(a, b);
      const stage = stageFor(states[id], unlockedItemIds.has(id));
      const grew = highlight?.has(id);
      cells.push(
        h(
          'button',
          {
            class: `grid-cell stage-${stage}${a === b ? ' diagonal' : ''}${grew ? ' grew' : ''}`,
            type: 'button',
            'aria-label': `${formatFact(a, b)}: ${STAGE_LABEL[stage]}`,
            onclick: () => onSelect?.({ a, b, stage }),
          },
          plantIcon(stage),
        ),
      );
    }
  }
  return h('div', { class: 'garden-grid', role: 'group', 'aria-label': 'Trädgården' }, cells);
}

/** A table number that has become a sunflower: the child knows every fact in it. */
function sunflowerLabel(n: number): HTMLElement {
  const flower = s('svg', { class: 'sunflower', viewBox: '-21 -21 42 42', 'aria-hidden': 'true' });
  flower.innerHTML = sunflowerHead(false);
  return h('div', { class: 'grid-head mastered', title: `Hela ×${n} kan du!` }, flower, h('span', { 'aria-hidden': 'true' }, n));
}
