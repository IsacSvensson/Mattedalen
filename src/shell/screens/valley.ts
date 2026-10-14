import type { Profile } from '../../storage';
import { show, type AppContext } from '../app';
import { avatarIcon } from '../components/avatars';
import { icon } from '../components/icons';
import { scene } from '../components/scene';
import { h, s } from '../dom';
import type { Place } from '../place';
import { hasSwedishVoice, speak, speechSupported } from '../speech';
import { showProfiles } from './profiles';

/**
 * The valley: the child's start page and the map of the places. Only places
 * that exist are drawn; the rest of the valley is landscape until a place is
 * built, so nothing waits to be unlocked.
 */
export async function showValley(ctx: AppContext, profile: Profile): Promise<void> {
  // Only Trädgården so far; Bäcken gets its own spot by the brook.
  const place = ctx.places[0] as Place;
  const map = await place.onMap(ctx, profile);
  const go = () => void place.open(ctx, profile);

  const status = h('p', { class: 'place-status' }, map.moodIcon, h('span', null, map.moodText));
  const voiceOn = profile.settings.readAloud && speechSupported() && (await hasSwedishVoice());

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
      scene({ height: 120, sunflowers: map.sunflowers, cloud: true }),
      h(
        'div',
        { class: 'valley-ground' },
        valleyLand(),
        h(
          'button',
          { class: `place ${map.spot} mood-${map.mood}`, type: 'button', 'aria-label': `${place.name}. ${map.moodText}`, onclick: go },
          map.art,
          h('span', { class: 'place-name' }, map.nameIcon, place.name),
        ),
        // The child's animal stands on the path by the place it goes to.
        h('span', { class: 'valley-walker', 'aria-hidden': 'true' }, avatarIcon(profile.avatar)),
      ),
    ),
    map.landscapeText ? h('p', { class: 'sr-only' }, map.landscapeText) : null,
    h(
      'div',
      { class: 'valley-side' },
      h(
        'div',
        { class: 'place-status-row' },
        status,
        voiceOn
          ? h('button', { class: 'icon-button speak-button', type: 'button', 'aria-label': 'Läs upp', onclick: () => void speak(`${place.name}. ${map.moodText}`) }, icon('speaker'))
          : null,
      ),
      h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: go }, icon(map.go.icon), map.go.label),
    ),
  );
  show(ctx, view);
}

/** The brook and the path, stretched to the ground's shape (the outlines keep their width). */
function valleyLand(): SVGSVGElement {
  const svg = s('svg', { class: 'valley-land', viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  // In from the left edge and out at the bottom: the brook runs on beyond the frame.
  const brook = 'M-6 16 C10 18 30 28 26 48 S10 76 22 104';
  svg.innerHTML =
    `<path d="M24 64 C40 74 52 70 60 60" class="valley-path"/>` +
    `<path d="M60 60 C70 70 80 82 92 102" class="valley-path"/>` +
    `<path d="${brook}" class="brook-bank"/>` +
    `<path d="${brook}" class="brook-water"/>`;
  return svg;
}
