import { atLeast, type ContentPack, type ItemId, type ItemState } from '../engine';

/** A part sits when about as much as opens what comes after it is fluent or better. */
export const SITS_AT = 0.8;

/** Whether a part ("del") of a pack sits for a child; a part the pack does not have counts as sitting. */
export function partSits(pack: ContentPack, states: Record<ItemId, ItemState>, unitId: string): boolean {
  const unit = pack.units.find((u) => u.id === unitId);
  if (!unit || !unit.itemIds.length) return true;
  const sits = unit.itemIds.filter((id) => {
    const s = states[id];
    return s !== undefined && atLeast(s.status, 'fluent');
  }).length;
  return sits / unit.itemIds.length >= SITS_AT;
}

/**
 * Parts of one place that wait for parts of another (`heldUnitIds`): each
 * part waits until every part it names sits at the other place.
 */
export function waitingParts(waits: Record<string, readonly string[]>, other: ContentPack, otherStates: Record<ItemId, ItemState>): string[] {
  return Object.entries(waits)
    .filter(([, needs]) => needs.some((id) => !partSits(other, otherStates, id)))
    .map(([unitId]) => unitId);
}
