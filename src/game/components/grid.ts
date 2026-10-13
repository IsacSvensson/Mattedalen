import type { ItemId, ItemState } from '../../engine';
import { factId, formatFact, MAX_FACTOR, MIN_FACTOR } from '../../content/multiplication';
import { h } from '../dom';
import { plantIcon, STAGE_LABEL, stageFor, type Stage } from './plant';

export interface GridOptions {
  states: Record<ItemId, ItemState>;
  /** Units whose facts are part of the game and unlocked. */
  unlockedItemIds: Set<ItemId>;
  /** Facts that just grew; they get a small animation. */
  highlight?: Set<ItemId>;
  onSelect?: (info: { a: number; b: number; stage: Stage }) => void;
}

/**
 * The map: the 10×10 multiplication grid as a garden bed. Row a, column b
 * holds a × b, so 3 × 7 and 7 × 3 mirror each other across the diagonal.
 */
export function gardenGrid({ states, unlockedItemIds, highlight, onSelect }: GridOptions): HTMLElement {
  const cells: HTMLElement[] = [h('div', { class: 'grid-corner', 'aria-hidden': 'true' }, '×')];
  for (let b = MIN_FACTOR; b <= MAX_FACTOR; b++) cells.push(h('div', { class: 'grid-head', 'aria-hidden': 'true' }, b));
  for (let a = MIN_FACTOR; a <= MAX_FACTOR; a++) {
    cells.push(h('div', { class: 'grid-head', 'aria-hidden': 'true' }, a));
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
