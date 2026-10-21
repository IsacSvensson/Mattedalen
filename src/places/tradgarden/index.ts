import type { Profile } from '../../storage';
import type { AppContext } from '../../shell/app';
import { icon } from '../../shell/components/icons';
import { plantIcon } from '../../shell/components/plant';
import type { Place, PlaceScene } from '../../shell/place';
import { engineFor, loadProgress } from '../../shell/play';
import { gardenDeps, pack } from './pack';
import { GARDEN_ABOUT, gardenParentPage, gardenParentSettings, gardenParentSummary } from './parent';
import { gardenIsOpen } from './isOpen';
import { CLOSED_TEXT } from './opening';
import { gardenPicture, knownTables, showGarden, startGarden } from './screens/garden';
import { gardenMood, MOOD_TEXT, type PlaceMood } from './valley';

/** Trädgården: the multiplication table as a garden bed. */
export const tradgarden: Place = {
  id: 'tradgarden',
  name: 'Trädgården',
  pack,
  open: (ctx, profile) => showGarden(ctx, profile),
  start: (ctx, profile) => startGarden(ctx, profile),
  scene: gardenScene,
  isOpen: (ctx, profile) => gardenIsOpen(ctx, profile),
  closedText: CLOSED_TEXT,
  icon: () => plantIcon('tree'),
  about: GARDEN_ABOUT,
  where: 'i trädgården',
  parentPage: gardenParentPage,
  parentSummary: gardenParentSummary,
  parentSettings: gardenParentSettings,
};

async function gardenScene(ctx: AppContext, profile: Profile): Promise<PlaceScene> {
  const deps = gardenDeps(ctx);
  const engine = engineFor(profile, deps);
  const { states, meta } = await loadProgress(profile, deps, engine);
  const open = await gardenIsOpen(ctx, profile, states);
  const mood = gardenMood(states, engine.dailyDone(meta));
  const known = knownTables(pack, states).size;
  const picture = await gardenPicture(ctx, profile, { states, meta, engine });
  return {
    mood: open ? mood : 'closed',
    moodText: open ? MOOD_TEXT[mood] : CLOSED_TEXT,
    moodIcon: open ? moodIcon(mood) : icon('steps'),
    ...picture,
    // A closed garden has nothing waiting yet.
    line: open ? picture.line : null,
    nameIcon: mood === 'asleep' ? icon('moon') : null,
    // Whole areas: one sunflower on the hill per table the child knows, as in the garden.
    sunflowers: known,
    landscapeText: known ? `Solrosor på kullen: ${known}, en för varje tabell du kan.` : null,
    go: { label: 'Vattna trädgården', icon: 'can' },
    due: engine.dueCount(states),
  };
}

function moodIcon(mood: PlaceMood): Element {
  if (mood === 'new') return plantIcon('sprout');
  return icon(mood === 'asleep' ? 'moon' : 'drop');
}
