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
 * built, so nothing waits to be unlocked. The child chooses which place to go
 * to; the main button suggests the first one that is not resting.
 */
export async function showValley(ctx: AppContext, profile: Profile): Promise<void> {
  const maps = await Promise.all(ctx.places.map(async (place) => ({ place, map: await place.onMap(ctx, profile) })));
  const lastId = await ctx.store.getSetting<string>(lastPlaceKey(profile));
  const last = maps.find((m) => m.place.id === lastId) ?? maps[0]!;
  const suggested = maps.find((m) => m.map.mood !== 'asleep') ?? maps[0]!;
  const go = (place: Place) => async () => {
    await ctx.store.setSetting(lastPlaceKey(profile), place.id);
    await place.open(ctx, profile);
  };
  const sunflowers = maps.reduce((n, m) => n + m.map.sunflowers, 0);
  const voiceOn = profile.settings.readAloud && speechSupported() && (await hasSwedishVoice());
  const spoken = maps.map(({ map }) => map.moodText).join(' ');

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
      scene({ height: 120, sunflowers, cloud: true }),
      h(
        'div',
        { class: 'valley-ground' },
        valleyLand(),
        maps.map(({ place, map }) =>
          h(
            'button',
            { class: `place ${map.spot} mood-${map.mood}`, type: 'button', 'aria-label': `${place.name}. ${map.moodText}`, onclick: () => void go(place)() },
            map.art,
            h('span', { class: 'place-name' }, map.nameIcon, place.name),
          ),
        ),
        // The child's animal stands on the path by the place it went to last.
        h('span', { class: `valley-walker at-${last.map.spot}`, 'aria-hidden': 'true' }, avatarIcon(profile.avatar)),
      ),
    ),
    maps.map(({ map }) => (map.landscapeText ? h('p', { class: 'sr-only' }, map.landscapeText) : null)),
    h(
      'div',
      { class: 'valley-side' },
      h(
        'div',
        { class: 'place-status-row' },
        h('div', { class: 'place-statuses' }, maps.map(({ map }) => h('p', { class: 'place-status' }, map.moodIcon, h('span', null, map.moodText)))),
        voiceOn
          ? h('button', { class: 'icon-button speak-button', type: 'button', 'aria-label': 'Läs upp', onclick: () => void speak(spoken) }, icon('speaker'))
          : null,
      ),
      h(
        'button',
        { class: 'big-button', type: 'button', autofocus: true, onclick: () => void go(suggested.place)() },
        icon(suggested.map.go.icon),
        suggested.map.go.label,
      ),
    ),
  );
  show(ctx, view);
}

/** Where a child went last, so their animal stands there (per child). */
const lastPlaceKey = (profile: Profile) => `lastPlace:${profile.id}`;

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
