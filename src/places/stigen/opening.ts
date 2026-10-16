import { BROOK_PREREQUISITES } from '../../content/hundred';
import type { ContentPack, ItemId, ItemState } from '../../engine';
import { partSits, waitingParts } from '../../shell/parts';

/**
 * When Stigen opens for a child, and which of its parts wait for the brook.
 *
 * Stigen opens when the brook's parts in `PATH_OPENS_AFTER` sit (or when the
 * child already has progress on Stigen, or a grown-up opens it). Simulated
 * children showed that opening it earlier, beside the brook's own bridge over
 * the ten, takes too much of the day from the brook and the garden
 * (docs/PLAN-HUNDRA.md, Fynd från H5). Inside, each
 * part waits for what it builds on at the brook (`BROOK_PREREQUISITES`): going
 * over the ten on Stigen waits for going over the ten at the brook.
 */
export const PATH_OPENS_AFTER = ['overtio'] as const;

export const CLOSED_TEXT = 'Stigen öppnar när du kan gå över tiotalet vid bäcken.';

export interface PathOpening {
  pathStates: Record<ItemId, ItemState>;
  brook?: { pack: ContentPack; states: Record<ItemId, ItemState> };
  openedByAdult: boolean;
  /** The brook's parts to wait for (the default is `PATH_OPENS_AFTER`). */
  after?: readonly string[];
}

export function pathOpens({ pathStates, brook, openedByAdult, after = PATH_OPENS_AFTER }: PathOpening): boolean {
  if (openedByAdult) return true;
  if (Object.values(pathStates).some((s) => s.status !== 'new')) return true;
  if (!brook) return true;
  return after.every((unitId) => partSits(brook.pack, brook.states, unitId));
}

/** Stigen's parts that wait for the brook right now. */
export function pathWaiting(brook: ContentPack | undefined, brookStates: Record<ItemId, ItemState>): string[] {
  return brook ? waitingParts(BROOK_PREREQUISITES as Record<string, readonly string[]>, brook, brookStates) : [];
}
