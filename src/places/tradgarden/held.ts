import { systemClock, type Engine, type ItemId, type ItemState, type LearnerMeta } from '../../engine';
import type { Profile } from '../../storage';
import type { AppContext } from '../../shell/app';
import { loadProgress } from '../../shell/play';
import { heldTables, tablesWaiting } from './waits';

/** Per child: the day each table could first have opened (see `heldTables`). */
export const readyKey = (profileId: string) => `tableReady:${profileId}`;

export interface GardenWaits {
  /** Tables held today (for the engine). */
  held: string[];
  /** Tables that would open now, but wait for Stigen: what the garden and the parent view tell. */
  waitingNow: string[];
}

/**
 * The garden's tables that wait for Stigen today, worked out from the child's
 * progress on Stigen (`TABLES_WAIT`). Without Stigen in the valley, nothing waits.
 */
export async function gardenWaits(
  ctx: AppContext,
  profile: Profile,
  progress: { states: Record<ItemId, ItemState>; meta: LearnerMeta },
  engine: Engine,
): Promise<GardenWaits> {
  const path = ctx.places.find((p) => p.pack.id === 'hundred');
  if (!path) return { held: [], waitingNow: [] };
  const pathStates = (await loadProgress(profile, { store: ctx.store, pack: path.pack })).states;
  const waiting = tablesWaiting(path.pack, pathStates, { pack: engine.pack, states: progress.states });
  if (!waiting.length) return { held: [], waitingNow: [] };
  const could = new Set(engine.unlockedUnits(progress.states, progress.meta));
  const ready = (await ctx.store.getSetting<Record<string, string>>(readyKey(profile.id))) ?? {};
  const out = heldTables(waiting, could, ready, systemClock.today());
  if (out.changed) await ctx.store.setSetting(readyKey(profile.id), out.ready);
  const open = new Set(engine.unlockedUnits(progress.states, progress.meta, undefined, out.held));
  return { held: out.held, waitingNow: [...could].filter((u) => !open.has(u)) };
}
