import { atLeast } from './status';
import type { ItemId, ItemState, Unit, UnitId } from './types';

export function sortedUnits(units: readonly Unit[]): Unit[] {
  return units.slice().sort((a, b) => a.order - b.order);
}

export function countAtLeast(unit: Unit, states: Record<ItemId, ItemState>, minStatus: ItemState['status']): number {
  let n = 0;
  for (const id of unit.itemIds) {
    const s = states[id];
    if (s && atLeast(s.status, minStatus)) n++;
  }
  return n;
}

/**
 * Items needed for "about `fraction`" of a unit. Rounds down so that small
 * units are not stricter than large ones (3 of 4, not 4 of 4, for 80 %).
 */
export function requiredCount(unit: Unit, fraction: number): number {
  return Math.max(1, Math.floor(fraction * unit.itemIds.length + 1e-9));
}

/**
 * Units unlock in order. Once unlocked a unit stays unlocked, even if the
 * learner later slips on the previous unit (relocking would feel like a
 * punishment). `relaxedFraction` lets pacing open the next unit a little
 * earlier for a learner who is above the target accuracy.
 */
export function computeUnlocked(
  units: readonly Unit[],
  states: Record<ItemId, ItemState>,
  previouslyUnlocked: readonly UnitId[],
  /** Lower fraction to use instead of the rule's (when the learner finds it too easy). */
  relaxedFraction?: number,
): UnitId[] {
  const out: UnitId[] = [];
  let prev: Unit | undefined;
  for (const unit of sortedUnits(units)) {
    let open = previouslyUnlocked.includes(unit.id);
    if (!open) {
      const rule = unit.unlockRule;
      if (rule.kind === 'always') open = true;
      else if (prev && out.includes(prev.id)) {
        const fraction = Math.min(rule.fraction, relaxedFraction ?? rule.fraction);
        open = countAtLeast(prev, states, rule.minStatus) >= requiredCount(prev, fraction);
      }
    }
    if (open) out.push(unit.id);
    prev = unit;
  }
  return out;
}
