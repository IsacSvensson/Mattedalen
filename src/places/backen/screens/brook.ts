import { systemClock, type ItemId, type ItemState } from '../../../engine';
import type { Profile } from '../../../storage';
import { show, type AppContext } from '../../../shell/app';
import { avatarIcon } from '../../../shell/components/avatars';
import { icon } from '../../../shell/components/icons';
import { scene } from '../../../shell/components/scene';
import { h } from '../../../shell/dom';
import { engineFor, loadProgress } from '../../../shell/play';
import { showValley } from '../../../shell/screens/valley';
import { genitive } from '../../../shell/words';
import { bridge, LAID_AT, laidCount } from '../components/bridge';
import { bridgeStones, partProgress } from '../logic';
import { brookDeps, pack } from '../pack';
import { checkDue, checkLaterKey } from '../check';
import { showCheckOffer } from './check';
import { offeredKey, showBrookPlacementOffer } from './placement';
import { showBrookSession } from './session';

/**
 * Bäcken: the bridge the child builds, one block per part, and what sits of
 * each part. The daily session is hopping on the stones.
 */
export async function showBrook(ctx: AppContext, profile: Profile): Promise<void> {
  const deps = brookDeps(ctx);
  const engine = engineFor(profile, deps);
  const { states, meta } = await loadProgress(profile, deps, engine);
  // The first time at the brook, with nothing practised yet: offer the start check (J4).
  const fresh = Object.values(states).every((s) => s.status === 'new');
  if (fresh && !(await ctx.store.getSetting<boolean>(offeredKey(profile)))) {
    return showBrookPlacementOffer(ctx, profile, () => showBrook(ctx, profile));
  }
  const asleep = engine.dailyDone(meta);
  const picture = brookPicture(states, new Set(engine.unlockedUnits(states, meta)));
  // Bäckens koll comes first on the days it is due (about every seventh play day).
  const checkFirst =
    !asleep && checkDue(await ctx.store.listSessions(profile.id), pack.id, systemClock.today(), await ctx.store.getSetting<string>(checkLaterKey(profile.id)));
  const play = () => showBrookSession(ctx, profile, 'daily');

  const actions = asleep
    ? h(
        'div',
        { class: 'garden-actions' },
        h('p', { class: 'sleep-text' }, icon('moon'), 'Bäcken vilar. Kom tillbaka i morgon!'),
        h('button', { class: 'soft-button', type: 'button', onclick: () => void showBrookSession(ctx, profile, 'extra') }, 'Öva lite till (frivilligt)'),
      )
    : h(
        'div',
        { class: 'garden-actions' },
        h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void (checkFirst ? showCheckOffer(ctx, profile, play) : play()) }, icon('steps'), 'Hoppa på stenarna'),
      );

  const view = h(
    'main',
    { class: `screen brook has-scene${asleep ? ' asleep' : ''}` },
    h(
      'header',
      { class: 'garden-head' },
      scene({ height: 150, cloud: true }),
      h(
        'div',
        { class: 'scene-title' },
        // The child's animal walks back to the valley, as in the garden.
        h('button', { class: 'avatar-badge avatar-button', type: 'button', 'aria-label': 'Till dalen', onclick: () => void showValley(ctx, profile) }, avatarIcon(profile.avatar)),
        h('h1', { class: profile.name.length > 10 ? 'long-name' : undefined }, `${genitive(profile.name)} bäck`),
      ),
    ),
    picture.art,
    h('p', { class: 'sr-only' }, picture.artText),
    h('div', { class: 'garden-side' }, picture.line, actions),
  );
  show(ctx, view);
}

/**
 * The bridge and what the child is on now, for the brook's page and its scene
 * in the valley. What the child is on: the first open part that is not laid
 * yet. No counts: the bridge shows what sits.
 */
export function brookPicture(states: Record<ItemId, ItemState>, unlocked: ReadonlySet<string>): { art: HTMLElement; artText: string; line: HTMLElement | null } {
  const stones = bridgeStones(pack, states, unlocked);
  const open = partProgress(pack, states, unlocked).filter((p) => p.open);
  const now = open.find((p) => p.known < LAID_AT * p.total) ?? open.at(-1);
  return {
    art: h('div', { class: 'brook-bridge' }, bridge(stones)),
    artText: `Bron har ${laidCount(stones)} av ${stones.length} stenar på plats.`,
    line: now ? h('p', { class: 'place-now' }, icon('steps'), h('span', null, 'Nu: ', h('strong', null, now.understanding ? `${now.title} (vågen)` : now.title))) : null,
  };
}
