import type { ContentPack, ItemId, ItemState } from '../../engine';
import { partSits, waitingParts } from '../../shell/parts';

/**
 * When Klocktornet opens for a child (docs/PLAN-KLOCKAN.md, KL4): when small
 * sums sit at the brook, so a new child starts with the numbers; or when the
 * child already has progress in the tower, or a grown-up opens it. Inside,
 * five minutes at a time waits for whole tens on Stigen (counting in fives to 60).
 */
export const TOWER_OPENS_AFTER = ['sma'] as const;

export const CLOSED_TEXT = 'Klocktornet öppnar när du kan små summor vid bäcken.';

/** The tower's parts that wait for a part on Stigen. */
export const STIGEN_PREREQUISITES: Record<string, readonly string[]> = { femmin: ['tiotal'] };

export interface TowerOpening {
  towerStates: Record<ItemId, ItemState>;
  brook?: { pack: ContentPack; states: Record<ItemId, ItemState> };
  openedByAdult: boolean;
}

export function towerOpens({ towerStates, brook, openedByAdult }: TowerOpening): boolean {
  if (openedByAdult) return true;
  if (Object.values(towerStates).some((s) => s.status !== 'new')) return true;
  if (!brook) return true;
  return TOWER_OPENS_AFTER.every((unitId) => partSits(brook.pack, brook.states, unitId));
}

/** The tower's parts that wait for Stigen right now. */
export function towerWaiting(stigen: ContentPack | undefined, stigenStates: Record<ItemId, ItemState>): string[] {
  return stigen ? waitingParts(STIGEN_PREREQUISITES, stigen, stigenStates) : [];
}
