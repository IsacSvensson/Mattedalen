import type { ItemId, ItemState } from '../../engine';
import type { Profile } from '../../storage';
import type { AppContext } from '../../shell/app';
import { loadProgress } from '../../shell/play';
import { gardenOpens } from './opening';
import { gardenDeps } from './pack';

/** Whether the garden is open to the child (see `opening.ts`). */
export async function gardenIsOpen(ctx: AppContext, profile: Profile, gardenStates?: Record<ItemId, ItemState>): Promise<boolean> {
  if (profile.settings.gardenOpen) return true;
  const states = gardenStates ?? (await loadProgress(profile, gardenDeps(ctx))).states;
  if (Object.values(states).some((s) => s.status !== 'new')) return true;
  const brookPlace = ctx.places.find((p) => p.pack.id === 'addition');
  const brook = brookPlace ? { pack: brookPlace.pack, states: (await loadProgress(profile, { store: ctx.store, pack: brookPlace.pack })).states } : undefined;
  return gardenOpens({ gardenStates: states, brook, openedByAdult: false });
}

