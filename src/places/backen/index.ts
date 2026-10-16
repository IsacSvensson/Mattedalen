import type { Profile } from '../../storage';
import type { AppContext } from '../../shell/app';
import { icon } from '../../shell/components/icons';
import { plantIcon } from '../../shell/components/plant';
import type { Place, PlaceScene } from '../../shell/place';
import { engineFor, loadProgress } from '../../shell/play';
import { bridgeStones, brookMood, MOOD_TEXT, type BrookMood } from './logic';
import { brookDeps, pack } from './pack';
import { BROOK_ABOUT, brookParentPage, brookParentSummary } from './parent';
import { archBridge } from './components/bridge';
import { brookPicture, showBrook, startBrook } from './screens/brook';

/** Bäcken: addition and subtraction within 20 on the stones over the brook, and the equal sign. */
export const backen: Place = {
  id: 'backen',
  name: 'Bäcken',
  pack,
  open: (ctx, profile) => showBrook(ctx, profile),
  start: (ctx, profile) => startBrook(ctx, profile),
  scene: brookScene,
  icon: () => icon('steps'),
  about: BROOK_ABOUT,
  parentPage: (ctx, profile) => brookParentPage(ctx, profile),
  parentSummary: (ctx, profile) => brookParentSummary(ctx, profile),
};

async function brookScene(ctx: AppContext, profile: Profile): Promise<PlaceScene> {
  const deps = brookDeps(ctx);
  const engine = engineFor(profile, deps);
  const { states, meta } = await loadProgress(profile, deps, engine);
  const mood = brookMood(states, engine.dailyDone(meta));
  const unlocked = new Set(engine.unlockedUnits(states, meta));
  const picture = brookPicture(states, unlocked);
  return {
    mood,
    moodText: MOOD_TEXT[mood],
    moodIcon: moodIcon(mood),
    ...picture,
    // On the map the bridge is a stone arch over the valley's own brook.
    art: archBridge(bridgeStones(pack, states, unlocked)),
    nameIcon: mood === 'asleep' ? icon('moon') : null,
    sunflowers: 0,
    landscapeText: null,
    go: { label: 'Hoppa på stenarna', icon: 'steps' },
    due: engine.dueCount(states),
  };
}

function moodIcon(mood: BrookMood): Element {
  if (mood === 'new') return plantIcon('seed');
  return icon(mood === 'asleep' ? 'moon' : 'drop');
}
