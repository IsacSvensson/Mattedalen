import type { Profile } from '../../storage';
import type { AppContext } from '../../shell/app';
import { icon } from '../../shell/components/icons';
import { plantIcon } from '../../shell/components/plant';
import type { Place, PlaceOnMap } from '../../shell/place';
import { engineFor, loadProgress } from '../../shell/play';
import { bridge, laidCount } from './components/bridge';
import { bridgeStones, brookMood, MOOD_TEXT, type BrookMood } from './logic';
import { brookDeps, pack } from './pack';
import { brookParentSection } from './parent';
import { showBrook } from './screens/brook';

/** Bäcken: addition and subtraction within 20 on the stones over the brook, and the equal sign. */
export const backen: Place = {
  id: 'backen',
  name: 'Bäcken',
  pack,
  open: (ctx, profile) => showBrook(ctx, profile),
  onMap: brookOnMap,
  parentSection: (ctx, profile) => brookParentSection(ctx, profile),
};

async function brookOnMap(ctx: AppContext, profile: Profile): Promise<PlaceOnMap> {
  const deps = brookDeps(ctx);
  const engine = engineFor(profile, deps);
  const { states, meta } = await loadProgress(profile, deps, engine);
  const mood = brookMood(states, engine.dailyDone(meta));
  const stones = bridgeStones(pack, states, new Set(engine.unlockedUnits(states, meta)));
  const laid = laidCount(stones);
  return {
    spot: 'place-brook',
    mood,
    moodText: MOOD_TEXT[mood],
    moodIcon: moodIcon(mood),
    // The small bridge: one block per part, filled as much as sits.
    art: bridge(stones, 'mini'),
    nameIcon: mood === 'asleep' ? icon('moon') : null,
    sunflowers: 0,
    landscapeText: laid ? `Bron över bäcken har ${laid} av ${stones.length} stenar på plats.` : null,
    go: { label: 'Gå till bäcken', icon: 'steps' },
    due: engine.dueCount(states),
  };
}

function moodIcon(mood: BrookMood): Element {
  if (mood === 'new') return plantIcon('seed');
  return icon(mood === 'asleep' ? 'moon' : 'drop');
}
