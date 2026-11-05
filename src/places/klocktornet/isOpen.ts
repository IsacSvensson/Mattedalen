import type { Profile } from '../../storage';
import type { AppContext } from '../../shell/app';
import { loadProgress } from '../../shell/play';
import { towerOpens } from './opening';
import { towerDeps } from './pack';

/** Whether Klocktornet is open to the child (see `opening.ts`). Once open, it stays open. */
export async function towerIsOpen(ctx: AppContext, profile: Profile): Promise<boolean> {
  if (profile.settings.towerOpen) return true;
  const states = (await loadProgress(profile, towerDeps(ctx))).states;
  const brookPlace = ctx.places.find((p) => p.pack.id === 'addition');
  const brook = brookPlace ? { pack: brookPlace.pack, states: (await loadProgress(profile, { store: ctx.store, pack: brookPlace.pack })).states } : undefined;
  if (!towerOpens({ towerStates: states, brook, openedByAdult: false })) return false;
  // A sum that slips back at the brook must not close a place the child could already go to.
  const stored = (await ctx.store.getProfile(profile.id)) ?? profile;
  await ctx.store.saveProfile({ ...stored, settings: { ...stored.settings, towerOpen: true } });
  profile.settings.towerOpen = true;
  return true;
}
