import type { Profile } from '../../storage';
import type { AppContext } from '../../shell/app';
import { icon } from '../../shell/components/icons';
import type { Place, PlaceScene } from '../../shell/place';
import { engineFor, loadProgress } from '../../shell/play';
import { towerIsOpen } from './isOpen';
import { MOOD_TEXT, towerMood } from './logic';
import { CLOSED_TEXT } from './opening';
import { pack, towerDeps, towerHeld } from './pack';
import { TOWER_ABOUT, towerParentPage, towerParentSummary } from './parent';
import { showTower, startTower, towerPicture } from './screens/tower';

/** Klocktornet: reading the clock, at the pond below Stigen (docs/PLAN-KLOCKAN.md). */
export const klocktornet: Place = {
  id: 'klocktornet',
  name: 'Klocktornet',
  pack,
  open: (ctx, profile) => showTower(ctx, profile),
  start: (ctx, profile) => startTower(ctx, profile),
  isOpen: (ctx, profile) => towerIsOpen(ctx, profile),
  closedText: CLOSED_TEXT,
  scene: towerScene,
  icon: () => icon('watch'),
  about: TOWER_ABOUT,
  where: 'i tornet',
  parentPage: (ctx, profile, save) => towerParentPage(ctx, profile, save),
  parentSummary: (ctx, profile, save) => towerParentSummary(ctx, profile, save),
};

async function towerScene(ctx: AppContext, profile: Profile): Promise<PlaceScene> {
  const deps = towerDeps(ctx);
  const engine = engineFor(profile, deps);
  const { states, meta } = await loadProgress(profile, deps, engine);
  const open = await towerIsOpen(ctx, profile);
  const mood = towerMood(states, engine.dailyDone(meta));
  const picture = towerPicture(states, new Set(engine.unlockedUnits(states, meta, undefined, await towerHeld(ctx, profile))));
  return {
    mood: open ? mood : 'closed',
    moodText: open ? MOOD_TEXT[mood] : CLOSED_TEXT,
    moodIcon: icon(!open ? 'steps' : mood === 'asleep' ? 'moon' : 'watch'),
    ...picture,
    line: open ? picture.line : null,
    nameIcon: mood === 'asleep' ? icon('moon') : null,
    sunflowers: 0,
    landscapeText: null,
    go: { label: 'Gå upp i tornet', icon: 'watch' },
    due: engine.dueCount(states),
  };
}
