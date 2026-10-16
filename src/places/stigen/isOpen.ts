import type { Profile } from '../../storage';
import type { AppContext } from '../../shell/app';
import { loadProgress } from '../../shell/play';
import { pathOpens } from './opening';
import { pathDeps } from './pack';

/** Whether Stigen is open to the child (see `opening.ts`). Once open, it stays open. */
export async function pathIsOpen(ctx: AppContext, profile: Profile): Promise<boolean> {
  if (profile.settings.pathOpen) return true;
  const states = (await loadProgress(profile, pathDeps(ctx))).states;
  const brookPlace = ctx.places.find((p) => p.pack.id === 'addition');
  const brook = brookPlace ? { pack: brookPlace.pack, states: (await loadProgress(profile, { store: ctx.store, pack: brookPlace.pack })).states } : undefined;
  if (!pathOpens({ pathStates: states, brook, openedByAdult: false })) return false;
  // A fact that slips back at the brook must not close a place the child could already go to.
  const stored = (await ctx.store.getProfile(profile.id)) ?? profile;
  await ctx.store.saveProfile({ ...stored, settings: { ...stored.settings, pathOpen: true } });
  profile.settings.pathOpen = true;
  return true;
}
