import type { Profile } from '../../storage';
import type { AppContext } from '../../shell/app';
import { icon } from '../../shell/components/icons';
import type { Place, PlaceOnMap } from '../../shell/place';
import { engineFor, loadProgress } from '../../shell/play';
import { litCount, trail } from './components/trail';
import { pathIsOpen } from './isOpen';
import { lanterns, MOOD_TEXT, pathMood } from './logic';
import { CLOSED_TEXT } from './opening';
import { pack, pathDeps, pathHeld } from './pack';
import { pathParentSection } from './parent';
import { showPath } from './screens/path';

/** Stigen: the numbers to 100, on the path between the brook and the garden. */
export const stigen: Place = {
  id: 'stigen',
  name: 'Stigen',
  pack,
  open: (ctx, profile) => showPath(ctx, profile),
  isOpen: (ctx, profile) => pathIsOpen(ctx, profile),
  closedText: CLOSED_TEXT,
  onMap: pathOnMap,
  parentSection: (ctx, profile, save) => pathParentSection(ctx, profile, save),
};

async function pathOnMap(ctx: AppContext, profile: Profile): Promise<PlaceOnMap> {
  const deps = pathDeps(ctx);
  const engine = engineFor(profile, deps);
  const { states, meta } = await loadProgress(profile, deps, engine);
  const open = await pathIsOpen(ctx, profile);
  const mood = pathMood(states, engine.dailyDone(meta));
  const lights = lanterns(pack, states, new Set(engine.unlockedUnits(states, meta, undefined, await pathHeld(ctx, profile))));
  const lit = litCount(lights);
  return {
    spot: 'place-path',
    mood: open ? mood : 'closed',
    moodText: open ? MOOD_TEXT[mood] : CLOSED_TEXT,
    moodIcon: icon(!open ? 'steps' : mood === 'asleep' ? 'moon' : 'lantern'),
    // The path on the map: small posts, and a light for each open part.
    art: trail(lights, 'mini'),
    nameIcon: mood === 'asleep' ? icon('moon') : null,
    sunflowers: 0,
    landscapeText: lit ? `På stigen lyser ${lit} av ${lights.length} lyktor.` : null,
    go: { label: 'Gå till stigen', icon: 'lantern' },
    due: engine.dueCount(states),
  };
}
