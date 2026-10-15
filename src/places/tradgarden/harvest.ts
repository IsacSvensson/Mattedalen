import { atLeast, type ItemId, type ItemState } from '../../engine';
import { divisionsOfTable, MAX_FACTOR, MIN_FACTOR } from '../../content/multiplication';

/**
 * Tables whose delat med the child knows: every division in the table's
 * squares (row and column of the bed) is at least fluent. They get a harvest
 * basket by their number on the bed, and at their sunflower on the hill.
 */
export function harvestTables(states: Record<ItemId, ItemState>): Set<number> {
  const out = new Set<number>();
  for (let t = MIN_FACTOR; t <= MAX_FACTOR; t++) {
    if (divisionsOfTable(t).every((id) => atLeast(states[id]?.status ?? 'new', 'fluent'))) out.add(t);
  }
  return out;
}
