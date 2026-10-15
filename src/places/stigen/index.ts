import type { Profile } from '../../storage';
import type { AppContext } from '../../shell/app';
import { icon } from '../../shell/components/icons';
import type { Place, PlaceOnMap } from '../../shell/place';
import { engineFor, loadProgress } from '../../shell/play';
import { litCount, trail } from './components/trail';
import { lanterns, MOOD_TEXT, pathMood } from './logic';
import { pack, pathDeps } from './pack';
import { pathParentSection } from './parent';
import { showPath } from './screens/path';

/** Stigen: the numbers to 100, on the path between the brook and the garden. */
export const stigen: Place = {
  id: 'stigen',
  name: 'Stigen',
  pack,
  open: (ctx, profile) => showPath(ctx, profile),
  onMap: pathOnMap,
  parentSection: (ctx, profile) => pathParentSection(ctx, profile),
};

async function pathOnMap(ctx: AppContext, profile: Profile): Promise<PlaceOnMap> {
  const deps = pathDeps(ctx);
  const engine = engineFor(profile, deps);
  const { states, meta } = await loadProgress(profile, deps, engine);
  const mood = pathMood(states, engine.dailyDone(meta));
  const lights = lanterns(pack, states, new Set(engine.unlockedUnits(states, meta)));
  const lit = litCount(lights);
  return {
    spot: 'place-path',
    mood,
    moodText: MOOD_TEXT[mood],
    moodIcon: icon(mood === 'asleep' ? 'moon' : 'lantern'),
    // The path on the map: small posts, and a light for each open part.
    art: trail(lights, 'mini'),
    nameIcon: mood === 'asleep' ? icon('moon') : null,
    sunflowers: 0,
    landscapeText: lit ? `På stigen lyser ${lit} av ${lights.length} lyktor.` : null,
    go: { label: 'Gå till stigen', icon: 'lantern' },
    due: engine.dueCount(states),
  };
}
