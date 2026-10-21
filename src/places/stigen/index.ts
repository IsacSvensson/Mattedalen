import type { Profile } from '../../storage';
import type { AppContext } from '../../shell/app';
import { icon } from '../../shell/components/icons';
import type { Place, PlaceScene } from '../../shell/place';
import { engineFor, loadProgress } from '../../shell/play';
import { pathIsOpen } from './isOpen';
import { MOOD_TEXT, pathMood } from './logic';
import { CLOSED_TEXT } from './opening';
import { pack, pathDeps, pathHeld } from './pack';
import { PATH_ABOUT, pathParentPage, pathParentSummary } from './parent';
import { pathPicture, showPath, startPath } from './screens/path';

/** Stigen: the numbers to 100, on the path between the brook and the garden. */
export const stigen: Place = {
  id: 'stigen',
  name: 'Stigen',
  pack,
  open: (ctx, profile) => showPath(ctx, profile),
  start: (ctx, profile) => startPath(ctx, profile),
  isOpen: (ctx, profile) => pathIsOpen(ctx, profile),
  closedText: CLOSED_TEXT,
  scene: pathScene,
  icon: () => icon('lantern'),
  about: PATH_ABOUT,
  where: 'på stigen',
  parentPage: (ctx, profile, save) => pathParentPage(ctx, profile, save),
  parentSummary: (ctx, profile, save) => pathParentSummary(ctx, profile, save),
};

async function pathScene(ctx: AppContext, profile: Profile): Promise<PlaceScene> {
  const deps = pathDeps(ctx);
  const engine = engineFor(profile, deps);
  const { states, meta } = await loadProgress(profile, deps, engine);
  const open = await pathIsOpen(ctx, profile);
  const mood = pathMood(states, engine.dailyDone(meta));
  const picture = pathPicture(states, new Set(engine.unlockedUnits(states, meta, undefined, await pathHeld(ctx, profile))));
  return {
    mood: open ? mood : 'closed',
    moodText: open ? MOOD_TEXT[mood] : CLOSED_TEXT,
    moodIcon: icon(!open ? 'steps' : mood === 'asleep' ? 'moon' : 'lantern'),
    ...picture,
    // A closed path has nothing to be on yet.
    line: open ? picture.line : null,
    nameIcon: mood === 'asleep' ? icon('moon') : null,
    sunflowers: 0,
    landscapeText: null,
    go: { label: 'Gå på stigen', icon: 'lantern' },
    due: engine.dueCount(states),
  };
}
