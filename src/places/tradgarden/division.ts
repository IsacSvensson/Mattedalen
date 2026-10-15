import { atLeast, type FocusSet, type ItemId, type ItemState } from '../../engine';
import { divisionsOfTable, focusTable, MAX_FACTOR, MIN_FACTOR } from '../../content/multiplication';
import { pack } from './pack';

/** Delat med in the garden, without the DOM: harvest baskets and practising one table. */

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

/**
 * "Öva en tabell" with the table's delat med, once it is open: divisions the
 * child has met, and those in division parts that are open (they still wait
 * for their family to sit, as always). Divisions of parts that are not open
 * stay out, so "Dela lika" still comes first.
 */
export function focusWithDivisions(set: FocusSet, states: Record<ItemId, ItemState>, unlockedUnitIds: readonly string[]): FocusSet {
  const table = focusTable(set.id);
  if (table === null) return set;
  const open = new Set(pack.units.filter((u) => unlockedUnitIds.includes(u.id)).flatMap((u) => u.itemIds));
  const divisions = divisionsOfTable(table).filter((id) => (states[id] && states[id]!.status !== 'new') || open.has(id));
  return divisions.length ? { ...set, itemIds: [...set.itemIds, ...divisions] } : set;
}
