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
  if (!gardenOpens({ gardenStates: states, brook, openedByAdult: false })) return false;
  // Once open, the garden stays open: a fact that slips back at the brook must
  // not close a place the child could already go to.
  const stored = (await ctx.store.getProfile(profile.id)) ?? profile;
  await ctx.store.saveProfile({ ...stored, settings: { ...stored.settings, gardenOpen: true } });
  profile.settings.gardenOpen = true;
  return true;
}

