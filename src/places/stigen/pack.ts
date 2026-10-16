import { createHundredPack } from '../../content/hundred';
import type { AppContext } from '../../shell/app';
import type { Profile } from '../../storage';
import { loadProgress, type GameDeps } from '../../shell/play';
import { pathWaiting } from './opening';

/** Stigen's content: the numbers to 100. */
export const pack = createHundredPack();

/** Stigen's parts that wait for the brook today (`BROOK_PREREQUISITES`). */
export async function pathHeld(ctx: AppContext, profile: Profile): Promise<string[]> {
  const brook = ctx.places.find((p) => p.pack.id === 'addition');
  if (!brook) return [];
  return pathWaiting(brook.pack, (await loadProgress(profile, { store: ctx.store, pack: brook.pack })).states);
}

/** Storage and pack for the engine, with this place's share of the daily session. */
export const pathDeps = (ctx: AppContext): GameDeps => ({ store: ctx.store, pack, share: 1 / ctx.places.length, held: (profile) => pathHeld(ctx, profile) });
