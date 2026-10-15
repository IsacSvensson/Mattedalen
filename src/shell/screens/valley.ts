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
        pathStones(),
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

/** The brook, stretched to the ground's shape (the outlines keep their width). */
function valleyLand(): SVGSVGElement {
  const svg = s('svg', { class: 'valley-land', viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  // In from the left edge and out at the bottom: the brook runs on beyond the frame.
  const brook = 'M-6 16 C10 18 30 28 26 48 S10 76 22 104';
  svg.innerHTML = `<path d="${brook}" class="brook-bank"/>` + `<path d="${brook}" class="brook-water"/>` + `<path d="${brook}" class="brook-glint"/>`;
  return svg;
}

type Pt = [number, number];

/** A point on a cubic Bézier curve. */
function bezier([p0, p1, p2, p3]: [Pt, Pt, Pt, Pt], t: number): Pt {
  const u = 1 - t;
  const f = (i: 0 | 1) => u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i];
  return [f(0), f(1)];
}

/** The path from the brook past the garden and out of the map, in percent of the ground. */
const PATH: [Pt, Pt, Pt, Pt][] = [
  [[24, 64], [40, 74], [52, 70], [60, 60]],
  [[60, 60], [70, 70], [80, 82], [92, 102]],
];

/** Sizes and sideways steps of the stones, repeated along the path: uneven, but the same every time. */
const STONE_SIZE = [1, 0.75, 1.1, 0.85, 0.95, 0.7, 1.05];
const STONE_STEP = [0.6, -0.8, 0.3, -0.2, 0.9, -0.6, 0.1];

/**
 * The path as worn stepping stones of warm sand, each a little different. They
 * are placed in percent, so they stay round whatever the shape of the ground.
 */
function pathStones(): HTMLElement {
  const stones: HTMLElement[] = [];
  let n = 0;
  for (const curve of PATH) {
    for (let t = 0.04; t < 1; t += 0.085) {
      const [x, y] = bezier(curve, t);
      const [x2, y2] = bezier(curve, Math.min(1, t + 0.01));
      // Sideways from the direction of the path.
      const len = Math.hypot(x2 - x, y2 - y) || 1;
      const side = STONE_STEP[n % STONE_STEP.length]!;
      const left = x - ((y2 - y) / len) * side;
      const top = y + ((x2 - x) / len) * side;
      if (top > 98) break;
      const el = h('span', { class: 'path-stone' });
      el.style.left = `${left.toFixed(2)}%`;
      el.style.top = `${top.toFixed(2)}%`;
      el.style.setProperty('--s', String(STONE_SIZE[n % STONE_SIZE.length]));
      el.style.setProperty('--r', `${(n * 37) % 60 - 30}deg`);
      stones.push(el);
      n++;
    }
  }
  return h('span', { class: 'valley-path', 'aria-hidden': 'true' }, stones);
}
