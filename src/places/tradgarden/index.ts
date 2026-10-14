import type { Profile } from '../../storage';
import type { AppContext } from '../../shell/app';
import { icon } from '../../shell/components/icons';
import { plantIcon } from '../../shell/components/plant';
import { h } from '../../shell/dom';
import type { Place, PlaceOnMap } from '../../shell/place';
import { engineFor, loadProgress } from '../../shell/play';
import { gardenDeps, pack } from './pack';
import { gardenParentSection } from './parent';
import { knownTables, showGarden } from './screens/garden';
import { showPlacementOffer } from './screens/placement';
import { gardenMood, miniBed, MOOD_TEXT, type PlaceMood } from './valley';

/** Trädgården: the multiplication table as a garden bed. The valley's first place. */
export const tradgarden: Place = {
  id: 'tradgarden',
  name: 'Trädgården',
  pack,
  open: (ctx, profile) => showGarden(ctx, profile),
  welcome: (ctx, profile) => showPlacementOffer(ctx, profile),
  onMap: gardenOnMap,
  parentSection: gardenParentSection,
};

async function gardenOnMap(ctx: AppContext, profile: Profile): Promise<PlaceOnMap> {
  const deps = gardenDeps(ctx);
  const engine = engineFor(profile, deps);
  const { states, meta } = await loadProgress(profile, deps, engine);
  const mood = gardenMood(states, engine.dailyDone(meta));
  const known = knownTables(pack, states).size;
  return {
    spot: 'place-garden',
    mood,
    moodText: MOOD_TEXT[mood],
    moodIcon: moodIcon(mood),
    // The small bed: the child's furthest grown plants.
    art: h('span', { class: 'mini-bed', 'aria-hidden': 'true' }, miniBed(states).map((stage) => h('span', { class: 'mini-cell' }, stage === 'soil' ? null : plantIcon(stage)))),
    nameIcon: mood === 'asleep' ? icon('moon') : null,
    // Whole areas: one sunflower on the hill per table the child knows, as in the garden.
    sunflowers: known,
    landscapeText: known ? `Solrosor på kullen: ${known}, en för varje tabell du kan.` : null,
    go: { label: 'Gå till trädgården', icon: 'can' },
  };
}

function moodIcon(mood: PlaceMood): Element {
  if (mood === 'new') return plantIcon('sprout');
  return icon(mood === 'asleep' ? 'moon' : 'drop');
}
