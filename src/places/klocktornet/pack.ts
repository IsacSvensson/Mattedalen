import { createClockPack } from '../../content/clock';
import type { AppContext } from '../../shell/app';
import { loadProgress, type GameDeps } from '../../shell/play';
import type { Profile } from '../../storage';
import { towerWaiting } from './opening';

/** Klocktornet's content: reading the clock (docs/PLAN-KLOCKAN.md). */
export const pack = createClockPack();

/** The tower's parts that wait for Stigen today: five minutes at a time waits for whole tens. */
export async function towerHeld(ctx: AppContext, profile: Profile): Promise<string[]> {
  const stigen = ctx.places.find((p) => p.pack.id === 'hundred');
  if (!stigen) return [];
  return towerWaiting(stigen.pack, (await loadProgress(profile, { store: ctx.store, pack: stigen.pack })).states);
}

/** Storage and pack for the engine, with this place's share of the daily session. */
export const towerDeps = (ctx: AppContext): GameDeps => ({
  store: ctx.store,
  pack,
  share: 1 / Math.max(1, ctx.places.length),
  held: (profile) => towerHeld(ctx, profile),
});
