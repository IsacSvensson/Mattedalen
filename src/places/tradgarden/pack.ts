import { atLeast, systemClock, type ItemState } from '../../engine';
import { createMultiplicationPack, GROUP_TASKS, groupId, tableFocusId } from '../../content/multiplication';
import type { AppContext } from '../../shell/app';
import type { GameDeps } from '../../shell/play';

/** Trädgården's content: the multiplication table 1–10, and delat med growing on it. */
export const pack = createMultiplicationPack({ division: true });

/**
 * "Lika stora grupper" came after many children had started (docs/PLAN-HUNDRA.md).
 * A child who already knows ×2 (at least half of it fluent) knows what it is
 * about: its tasks count as known, so they do not stand before the next table.
 */
export function knowsGroupsAlready(states: Record<string, ItemState>): Record<string, ItemState> {
  const groups = GROUP_TASKS.map(groupId);
  if (groups.some((id) => states[id] && states[id]!.status !== 'new')) return states;
  const twos = pack.focusSets?.find((s) => s.id === tableFocusId(2))?.itemIds ?? [];
  const known = twos.filter((id) => atLeast(states[id]?.status ?? 'new', 'fluent')).length;
  if (known * 2 < twos.length) return states;
  const out = { ...states };
  for (const id of groups) if (out[id]) out[id] = { ...out[id]!, status: 'fluent', box: 2, introducedDay: out[id]!.introducedDay ?? systemClock.today() };
  return out;
}

/** Storage and pack for the engine, for one session or screen in the garden. */
export const gardenDeps = (ctx: AppContext): GameDeps => ({ store: ctx.store, pack, share: 1 / ctx.places.length, prepare: knowsGroupsAlready });
