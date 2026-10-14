import type { Profile } from '../../storage';
import { show, type AppContext } from '../app';
import { avatarIcon } from '../components/avatars';
import { icon } from '../components/icons';
import { plantIcon } from '../components/plant';
import { scene } from '../components/scene';
import { h, s } from '../dom';
import { engineFor, loadProgress } from '../play';
import { speak, speechSupported } from '../speech';
import { gardenMood, miniBed, MOOD_TEXT, type PlaceMood } from '../valley';
import { knownTables, showGarden } from './garden';
import { showProfiles } from './profiles';

/**
 * The valley: the child's start page and the map of the places. Only places
 * that exist are drawn; the rest of the valley is landscape until a place is
 * built, so nothing waits to be unlocked.
 */
export async function showValley(ctx: AppContext, profile: Profile): Promise<void> {
  const engine = engineFor(profile, ctx.deps);
  const { states, meta } = await loadProgress(profile, ctx.deps, engine);
  const mood = gardenMood(states, engine.dailyDone(meta));
  const known = knownTables(ctx.pack, states);
  const goToGarden = () => void showGarden(ctx, profile);

  const status = h('p', { class: 'place-status' }, moodIcon(mood), h('span', null, MOOD_TEXT[mood]));
  const voiceOn = profile.settings.readAloud && speechSupported();

  const view = h(
    'main',
    { class: 'screen valley' },
    h(
      'header',
      { class: 'valley-head' },
      h('button', { class: 'avatar-badge avatar-button', type: 'button', 'aria-label': 'Byt spelare', onclick: () => void showProfiles(ctx) }, avatarIcon(profile.avatar)),
      h('h1', null, 'Mattedalen'),
    ),
    h(
      'div',
      { class: 'valley-map' },
      // Whole areas: one sunflower on the hill per table the child knows, as in the garden.
      scene({ height: 120, sunflowers: known.size, cloud: true }),
      h(
        'div',
        { class: 'valley-ground' },
        valleyLand(),
        h(
          'button',
          { class: `place place-garden mood-${mood}`, type: 'button', 'aria-label': `Trädgården. ${MOOD_TEXT[mood]}`, onclick: goToGarden },
          h('span', { class: 'mini-bed', 'aria-hidden': 'true' }, miniBed(states).map((stage) => h('span', { class: 'mini-cell' }, stage === 'soil' ? null : plantIcon(stage)))),
          h('span', { class: 'place-name' }, mood === 'asleep' ? icon('moon') : null, 'Trädgården'),
        ),
        // The child's animal stands on the path by the place it goes to.
        h('span', { class: 'valley-walker', 'aria-hidden': 'true' }, avatarIcon(profile.avatar)),
      ),
    ),
    known.size ? h('p', { class: 'sr-only' }, `Solrosor på kullen: ${known.size}, en för varje tabell du kan.`) : null,
    h(
      'div',
      { class: 'valley-side' },
      h(
        'div',
        { class: 'place-status-row' },
        status,
        voiceOn
          ? h('button', { class: 'icon-button speak-button', type: 'button', 'aria-label': 'Läs upp', onclick: () => void speak(`Trädgården. ${MOOD_TEXT[mood]}`) }, icon('speaker'))
          : null,
      ),
      h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: goToGarden }, icon('can'), 'Gå till trädgården'),
    ),
  );
  show(ctx, view);
}

function moodIcon(mood: PlaceMood): Element {
  if (mood === 'new') return plantIcon('sprout');
  return icon(mood === 'asleep' ? 'moon' : 'drop');
}

/** The brook and the path, stretched to the ground's shape (the outlines keep their width). */
function valleyLand(): SVGSVGElement {
  const svg = s('svg', { class: 'valley-land', viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  const brook = 'M20 -2 C14 18 30 30 24 48 S10 76 22 102';
  svg.innerHTML =
    `<path d="M24 64 C40 74 52 70 60 60" class="valley-path"/>` +
    `<path d="M60 60 C70 70 80 82 92 102" class="valley-path"/>` +
    `<path d="${brook}" class="brook-bank"/>` +
    `<path d="${brook}" class="brook-water"/>`;
  return svg;
}
