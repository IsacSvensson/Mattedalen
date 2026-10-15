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
import { lanterns, partProgress } from '../logic';
import { pack, pathDeps } from '../pack';
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
  const unlocked = new Set(engine.unlockedUnits(states, meta));
  const asleep = engine.dailyDone(meta);
  const lights = lanterns(pack, states, unlocked);
  const lit = litCount(lights);
  const parts = partProgress(pack, states, unlocked).filter((p) => p.open);
  const now = lights[currentPart(lights)];

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
        h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void showPathSession(ctx, profile, 'daily') }, icon('lantern'), 'Gå på stigen'),
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
        h('button', { class: 'avatar-badge avatar-button', type: 'button', 'aria-label': 'Till dalen', onclick: () => void showValley(ctx, profile) }, avatarIcon(profile.avatar)),
        h('h1', { class: profile.name.length > 10 ? 'long-name' : undefined }, `${genitive(profile.name)} stig`),
      ),
    ),
    h('div', { class: 'path-trail' }, trail(lights, 'large', avatarIcon(profile.avatar))),
    h('p', { class: 'sr-only' }, `På stigen lyser ${lit} av ${lights.length} lyktor.${now ? ` Du är vid lyktan för ${now.title.toLowerCase()}.` : ''}`),
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
            h('span', { class: 'part-name' }, p.title),
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
