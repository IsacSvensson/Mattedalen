import type { ItemId, ItemState } from '../../../engine';
import type { Profile } from '../../../storage';
import { show, type AppContext } from '../../../shell/app';
import { avatarIcon } from '../../../shell/components/avatars';
import { explainButton } from '../../../shell/components/explain';
import { icon } from '../../../shell/components/icons';
import { readShown } from '../../../shell/components/readAloud';
import { scene } from '../../../shell/components/scene';
import { h } from '../../../shell/dom';
import { engineFor, loadProgress } from '../../../shell/play';
import { setWhere } from '../../../shell/resume';
import { showValley } from '../../../shell/screens/valley';
import { genitive } from '../../../shell/words';
import { currentPart, litCount } from '../../stigen/components/trail';
import { lanterns } from '../../stigen/logic';
import { towerArt } from '../components/tower';
import { pack, towerDeps, towerHeld } from '../pack';
import { TOWER_PICTURES } from '../tips';
import { showTowerSession } from './session';
import { offeredKey, showTowerPlacementOffer } from './placement';
import { showTowerCheckOffer, towerCheckLaterKey } from './check';
import { checkDue } from '../../../shell/check';
import { systemClock } from '../../../engine';

/**
 * Klocktornet (docs/PLAN-KLOCKAN.md, KL3): the tower with a window for every
 * part, lit when the part sits, and what the child is on now. The daily
 * session is climbing the tower. Not in the valley until KL4.
 */
export async function showTower(ctx: AppContext, profile: Profile): Promise<void> {
  setWhere({ kind: 'place', profileId: profile.id, placeId: 'klocktornet' });
  const deps = towerDeps(ctx);
  const engine = engineFor(profile, deps);
  const { states, meta } = await loadProgress(profile, deps, engine);
  // The first time in the tower, with nothing practised yet: offer the start check (once).
  const fresh = Object.values(states).every((s) => s.status === 'new');
  if (fresh && !(await ctx.store.getSetting<boolean>(offeredKey(profile)))) {
    return showTowerPlacementOffer(ctx, profile, () => showTower(ctx, profile));
  }
  const held = await towerHeld(ctx, profile);
  const unlocked = new Set(engine.unlockedUnits(states, meta, undefined, held));
  // Five minutes at a time waits for whole tens on Stigen: say so, once the part before it sits.
  const waits = held.includes('femmin') && engine.unlockedUnits(states, meta).includes('femmin');
  const asleep = engine.dailyDone(meta);
  const picture = towerPicture(states, unlocked);

  const actions = asleep
    ? h(
        'div',
        { class: 'garden-actions' },
        h('p', { class: 'sleep-text' }, icon('moon'), 'Tornet vilar. Kom tillbaka i morgon!'),
        h('button', { class: 'soft-button', type: 'button', onclick: () => void showTowerSession(ctx, profile, 'extra') }, 'Öva lite till (frivilligt)'),
      )
    : h('div', { class: 'garden-actions' }, h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void startTower(ctx, profile) }, icon('watch'), 'Gå upp i tornet'));

  const view = h(
    'main',
    { class: `screen tower has-scene${asleep ? ' asleep' : ''}` },
    h(
      'header',
      { class: 'garden-head' },
      scene({ height: 150, cloud: true }),
      h(
        'div',
        { class: 'scene-title' },
        h('button', { class: 'avatar-badge avatar-button', type: 'button', 'aria-label': 'Till dalen', onclick: () => void showValley(ctx, profile) }, avatarIcon(profile.avatar)),
        h('h1', { class: profile.name.length > 10 ? 'long-name' : undefined }, `${genitive(profile.name)} torn`),
      ),
      h('div', { class: 'place-corner' }, explainButton(profile, TOWER_PICTURES())),
    ),
    picture.art,
    h('p', { class: 'sr-only' }, picture.artText),
    h('div', { class: 'garden-side' }, picture.line, waits ? h('p', { class: 'muted tower-waits' }, WAITS_TEXT) : null, actions),
  );
  show(ctx, view);
  void readShown(ctx, profile, { into: '.place-corner' });
}

export const WAITS_TEXT = 'Fem minuter i taget kommer när du kan hela tiotal på stigen.';

/**
 * Starts the day's session in the tower, as its button and "I dag" do: the
 * start check is offered the first time, and the koll comes first on the days
 * it is due (about every seventh play day in the tower).
 */
export async function startTower(ctx: AppContext, profile: Profile): Promise<void> {
  const deps = towerDeps(ctx);
  const engine = engineFor(profile, deps);
  const { states, meta } = await loadProgress(profile, deps, engine);
  const fresh = Object.values(states).every((s) => s.status === 'new');
  if (fresh && !(await ctx.store.getSetting<boolean>(offeredKey(profile)))) {
    return showTowerPlacementOffer(ctx, profile, () => showTower(ctx, profile));
  }
  const play = () => showTowerSession(ctx, profile, 'daily');
  const checkFirst =
    !engine.dailyDone(meta) && checkDue(await ctx.store.listSessions(profile.id), pack.id, systemClock.today(), await ctx.store.getSetting<string>(towerCheckLaterKey(profile.id)));
  return checkFirst ? showTowerCheckOffer(ctx, profile, play) : play();
}

/** The tower with its windows and what the child is on now, without counts. */
export function towerPicture(states: Record<ItemId, ItemState>, unlocked: ReadonlySet<string>): { art: HTMLElement; artText: string; line: HTMLElement | null } {
  const parts = lanterns(pack, states, unlocked);
  const now = parts[currentPart(parts)];
  return {
    art: h('div', { class: 'tower-art' }, towerArt(parts)),
    artText: `I tornet lyser ${litCount(parts)} av ${parts.length} fönster.${now ? ` Du är vid fönstret för ${now.title.toLowerCase()}.` : ''}`,
    line: now ? h('p', { class: 'place-now' }, icon('watch'), h('span', null, 'Nu: ', h('strong', null, now.title))) : null,
  };
}
