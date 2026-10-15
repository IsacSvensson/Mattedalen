import type { Profile } from '../../../storage';
import { show, type AppContext } from '../../../shell/app';
import { avatarIcon } from '../../../shell/components/avatars';
import { icon } from '../../../shell/components/icons';
import { scene } from '../../../shell/components/scene';
import { h } from '../../../shell/dom';
import { engineFor, loadProgress } from '../../../shell/play';
import { showValley } from '../../../shell/screens/valley';
import { genitive } from '../../../shell/words';
import { bridge, laidCount } from '../components/bridge';
import { bridgeStones, partProgress } from '../logic';
import { brookDeps, pack } from '../pack';
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
  const unlocked = new Set(engine.unlockedUnits(states, meta));
  const asleep = engine.dailyDone(meta);
  const stones = bridgeStones(pack, states, unlocked);
  const parts = partProgress(pack, states, unlocked).filter((p) => p.open);
  const laid = laidCount(stones);

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
        h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void showBrookSession(ctx, profile, 'daily') }, icon('steps'), 'Hoppa på stenarna'),
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
    h('div', { class: 'brook-bridge' }, bridge(stones)),
    h('p', { class: 'sr-only' }, `Bron har ${laid} av ${stones.length} stenar på plats.`),
    h(
      'div',
      { class: 'garden-side' },
      h(
        'ul',
        { class: 'brook-parts', 'aria-label': 'Det här sitter' },
        parts.map((p) =>
          h(
            'li',
            null,
            h('span', { class: 'part-name' }, p.understanding ? `${p.title} (vågen)` : p.title),
            h('span', { class: 'part-count' }, `${p.known} av ${p.total}`),
            h('span', { class: 'part-bar', 'aria-hidden': 'true' }, h('span', { style: `width:${Math.round((100 * p.known) / Math.max(1, p.total))}%` })),
          ),
        ),
      ),
      actions,
    ),
  );
  show(ctx, view);
}
