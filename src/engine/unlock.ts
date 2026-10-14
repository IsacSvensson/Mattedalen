import { atLeast } from './status';
import type { ItemId, ItemState, Unit, UnitId } from './types';

export function sortedUnits(units: readonly Unit[]): Unit[] {
  return units.slice().sort((a, b) => a.order - b.order);
}

/** Items left out of practice (e.g. the untrained half of a pilot). */
export type Excluded = ReadonlySet<ItemId>;
const NONE: Excluded = new Set();

const counted = (unit: Unit, excluded: Excluded) => unit.itemIds.filter((id) => !excluded.has(id));

export function countAtLeast(unit: Unit, states: Record<ItemId, ItemState>, minStatus: ItemState['status'], excluded: Excluded = NONE): number {
  let n = 0;
  for (const id of counted(unit, excluded)) {
    const s = states[id];
    if (s && atLeast(s.status, minStatus)) n++;
  }
  return n;
}

/**
 * Items needed for "about `fraction`" of a unit. Rounds down so that small
 * units are not stricter than large ones (3 of 4, not 4 of 4, for 80 %).
 * Excluded items are not practised, so they are not counted either: a unit
 * with half its items held out can still open what comes after it.
 */
export function requiredCount(unit: Unit, fraction: number, excluded: Excluded = NONE): number {
  const n = counted(unit, excluded).length;
  if (n === 0) return 0;
  return Math.max(1, Math.floor(fraction * n + 1e-9));
}

/**
 * Units unlock in order: after the previous unit (`previous`) or after all
 * their prerequisites in a knowledge graph (`after`, which only refers to
 * earlier units). Once unlocked a unit stays unlocked, even if the learner
 * later slips on a prerequisite (relocking would feel like a punishment).
 * `relaxedFraction` lets pacing open units a little earlier for a learner who
 * is above the target accuracy.
 */
export function computeUnlocked(
  units: readonly Unit[],
  states: Record<ItemId, ItemState>,
  previouslyUnlocked: readonly UnitId[],
  /** Lower fraction to use instead of the rule's (when the learner finds it too easy). */
  relaxedFraction?: number,
  excluded: Excluded = NONE,
): UnitId[] {
  const out: UnitId[] = [];
  const byId = new Map(units.map((u) => [u.id, u]));
  const known = (unit: Unit | undefined, fraction: number, minStatus: ItemState['status']) =>
    unit !== undefined &&
    out.includes(unit.id) &&
    countAtLeast(unit, states, minStatus, excluded) >= requiredCount(unit, Math.min(fraction, relaxedFraction ?? fraction), excluded);
  let prev: Unit | undefined;
  for (const unit of sortedUnits(units)) {
    let open = previouslyUnlocked.includes(unit.id);
    if (!open) {
      const rule = unit.unlockRule;
      if (rule.kind === 'always') open = true;
      else if (rule.kind === 'previous') open = known(prev, rule.fraction, rule.minStatus);
      else open = rule.requires.every((id) => known(byId.get(id), rule.fraction, rule.minStatus));
    }
    if (open) out.push(unit.id);
    prev = unit;
  }
  return out;
}
