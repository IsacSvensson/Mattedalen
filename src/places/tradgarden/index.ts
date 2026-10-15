import type { Profile } from '../../storage';
import type { AppContext } from '../../shell/app';
import { icon } from '../../shell/components/icons';
import { plantIcon } from '../../shell/components/plant';
import { h, s } from '../../shell/dom';
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
    // The small bed: the child's furthest grown plants in dug earth, and new
    // seeds waiting in their packet until the first one is planted.
    art: h(
      'span',
      { class: 'mini-bed', 'aria-hidden': 'true' },
      miniBed(states).map((stage) => h('span', { class: 'mini-cell' }, plantIcon(stage))),
      mood === 'new' ? seedPacket() : null,
    ),
    nameIcon: mood === 'asleep' ? icon('moon') : null,
    // Whole areas: one sunflower on the hill per table the child knows, as in the garden.
    sunflowers: known,
    landscapeText: known ? `Solrosor på kullen: ${known}, en för varje tabell du kan.` : null,
    go: { label: 'Gå till trädgården', icon: 'can' },
  };
}

/** A paper packet of seeds with a sprout drawn on it. */
function seedPacket(): SVGSVGElement {
  const svg = s('svg', { class: 'seed-packet', viewBox: '0 0 24 30', 'aria-hidden': 'true' });
  svg.innerHTML =
    '<path d="M4 8h16l-1.2 19.5H5.2Z" class="sp-bag"/>' +
    '<path d="M4 8l2.2-4.5h11.6L20 8Z" class="sp-fold"/>' +
    '<path d="M12 24v-6.5" class="sp-stem"/>' +
    '<path d="M12 19.5c-3.8 0-5-2.8-5-4.3 3.4 0 5 2 5 4.3Z" class="sp-leaf"/>' +
    '<path d="M12 18.5c3.8 0 5-2.8 5-4.3-3.4 0-5 2-5 4.3Z" class="sp-leaf light"/>';
  return svg;
}

function moodIcon(mood: PlaceMood): Element {
  if (mood === 'new') return plantIcon('sprout');
  return icon(mood === 'asleep' ? 'moon' : 'drop');
}
