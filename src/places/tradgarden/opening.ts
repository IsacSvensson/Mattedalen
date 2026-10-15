import { atLeast, type ContentPack, type ItemId, type ItemState } from '../../engine';

/**
 * When Trädgården opens for a child. Multiplication starts from doubles (×2 is
 * doubling, after "Lika stora grupper"), so a new child starts at the brook,
 * and the garden opens
 *
 * - when the child already has progress in the garden (children who come from
 *   Gångerträdgården have it open from the start),
 * - when doubles sit at the brook, or
 * - when a grown-up opens it in the parent view.
 */

/** The brook's parts that open the garden. */
export const OPENS_AFTER = ['dubblor'] as const;

/** A part sits when about as much as opens what comes after it is fluent or better. */
export const SITS_AT = 0.8;

export const CLOSED_TEXT = 'Trädgården öppnar när du kan dubblorna vid bäcken.';

export interface GardenOpening {
  gardenStates: Record<ItemId, ItemState>;
  /** The brook's pack and progress, if the brook exists. */
  brook?: { pack: ContentPack; states: Record<ItemId, ItemState> };
  /** A grown-up has opened the garden. */
  openedByAdult: boolean;
}

export function gardenOpens({ gardenStates, brook, openedByAdult }: GardenOpening): boolean {
  if (openedByAdult) return true;
  if (Object.values(gardenStates).some((s) => s.status !== 'new')) return true;
  if (!brook) return true;
  return OPENS_AFTER.every((unitId) => {
    const unit = brook.pack.units.find((u) => u.id === unitId);
    if (!unit || !unit.itemIds.length) return true;
    const sits = unit.itemIds.filter((id) => {
      const s = brook.states[id];
      return s !== undefined && atLeast(s.status, 'fluent');
    }).length;
    return sits / unit.itemIds.length >= SITS_AT;
  });
}
