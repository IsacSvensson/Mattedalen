import type { Profile } from '../../../storage';
import { show, type AppContext } from '../../../shell/app';
import { avatarIcon } from '../../../shell/components/avatars';
import { icon } from '../../../shell/components/icons';
import { scene } from '../../../shell/components/scene';
import { h } from '../../../shell/dom';
import { engineFor, loadProgress } from '../../../shell/play';
import { showValley } from '../../../shell/screens/valley';
import { genitive } from '../../../shell/words';
import { currentPart, litCount, trail } from '../components/trail';
import { lanterns } from '../logic';
import { pack, pathDeps, pathHeld } from '../pack';
import { pathCheckLaterKey } from '../check';
import { showPathCheckOffer } from './check';
import { offeredKey, showPathPlacementOffer } from './placement';
import { checkDue } from '../../../shell/check';
import { systemClock, type ItemId, type ItemState } from '../../../engine';
import { showPathSession } from './session';

/**
 * Stigen: the path with a post at every ten and a lantern for every part, and
 * what sits of each part. The child's animal stands by the post of the part it
 * is on. The daily session is walking on the path.
 */
export async function showPath(ctx: AppContext, profile: Profile): Promise<void> {
  const deps = pathDeps(ctx);
  const engine = engineFor(profile, deps);
  const { states, meta } = await loadProgress(profile, deps, engine);
  // The first time on Stigen, with nothing practised yet: offer the start check (once).
  const fresh = Object.values(states).every((s) => s.status === 'new');
  if (fresh && !(await ctx.store.getSetting<boolean>(offeredKey(profile)))) {
    return showPathPlacementOffer(ctx, profile, () => showPath(ctx, profile));
  }
  const held = await pathHeld(ctx, profile);
  const unlocked = new Set(engine.unlockedUnits(states, meta, undefined, held));
  const asleep = engine.dailyDone(meta);
  const picture = pathPicture(states, unlocked, avatarIcon(profile.avatar));

  const actions = asleep
    ? h(
        'div',
        { class: 'garden-actions' },
        h('p', { class: 'sleep-text' }, icon('moon'), 'Stigen vilar. Kom tillbaka i morgon!'),
        h('button', { class: 'soft-button', type: 'button', onclick: () => void showPathSession(ctx, profile, 'extra') }, 'Öva lite till (frivilligt)'),
      )
    : h(
        'div',
        { class: 'garden-actions' },
        h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void startPath(ctx, profile) }, icon('lantern'), 'Gå på stigen'),
      );

  const view = h(
    'main',
    { class: `screen path has-scene${asleep ? ' asleep' : ''}` },
    h(
      'header',
      { class: 'garden-head' },
      scene({ height: 150, cloud: true }),
      h(
        'div',
        { class: 'scene-title' },
        // The child's animal walks back to the valley, as in the other places.
        h('button', { class: 'avatar-badge avatar-button', type: 'button', 'aria-label': 'Till dalen', onclick: () => void showValley(ctx, profile, { at: 'stigen' }) }, avatarIcon(profile.avatar)),
        h('h1', { class: profile.name.length > 10 ? 'long-name' : undefined }, `${genitive(profile.name)} stig`),
      ),
    ),
    picture.art,
    h('p', { class: 'sr-only' }, picture.artText),
    h('div', { class: 'garden-side' }, picture.line, actions),
  );
  show(ctx, view);
}

/**
 * Starts the day's session on Stigen, as the button on its page does and as
 * "I dag" in the valley does: the start check is offered the first time, and
 * Stigens koll comes first on the days it is due (about every seventh play day on Stigen).
 */
export async function startPath(ctx: AppContext, profile: Profile): Promise<void> {
  const deps = pathDeps(ctx);
  const engine = engineFor(profile, deps);
  const { states, meta } = await loadProgress(profile, deps, engine);
  const fresh = Object.values(states).every((s) => s.status === 'new');
  if (fresh && !(await ctx.store.getSetting<boolean>(offeredKey(profile)))) {
    return showPathPlacementOffer(ctx, profile, () => showPath(ctx, profile));
  }
  const play = () => showPathSession(ctx, profile, 'daily');
  const checkFirst =
    !engine.dailyDone(meta) && checkDue(await ctx.store.listSessions(profile.id), pack.id, systemClock.today(), await ctx.store.getSetting<string>(pathCheckLaterKey(profile.id)));
  return checkFirst ? showPathCheckOffer(ctx, profile, play) : play();
}

/**
 * The path with its lanterns and what the child is on now, without counts,
 * for Stigen's page and its scene in the valley. On the page the child's
 * animal stands by the lantern it is at.
 */
export function pathPicture(
  states: Record<ItemId, ItemState>,
  unlocked: ReadonlySet<string>,
  walker?: Element,
): { art: HTMLElement; artText: string; line: HTMLElement | null } {
  const lights = lanterns(pack, states, unlocked);
  const now = lights[currentPart(lights)];
  return {
    art: h('div', { class: 'path-trail' }, trail(lights, walker)),
    artText: `På stigen lyser ${litCount(lights)} av ${lights.length} lyktor.${now ? ` Du är vid lyktan för ${now.title.toLowerCase()}.` : ''}`,
    line: now ? h('p', { class: 'place-now' }, icon('lantern'), h('span', null, 'Nu: ', h('strong', null, now.title))) : null,
  };
}
