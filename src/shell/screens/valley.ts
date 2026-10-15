import { systemClock } from '../../engine';
import type { Profile } from '../../storage';
import { show, type AppContext } from '../app';
import { avatarIcon } from '../components/avatars';
import { icon } from '../components/icons';
import { scene } from '../components/scene';
import { h, s } from '../dom';
import { dayPlanKey, planDay, planHolds, rememberPlan, type DayPlan, type PlaceLoad } from '../dayPlan';
import { placeIsOpen, type Place } from '../place';
import { hasSwedishVoice, speak, speechSupported } from '../speech';
import { showProfiles } from './profiles';

/**
 * The valley: the child's start page and the map of the places. Only places
 * that exist are drawn; the rest of the valley is landscape until a place is
 * built, so nothing waits to be unlocked. The child chooses which place to go
 * to; the main button suggests the first one that is not resting.
 */
export async function showValley(ctx: AppContext, profile: Profile): Promise<void> {
  const maps = await Promise.all(
    ctx.places.map(async (place) => ({ place, map: await place.onMap(ctx, profile), open: await placeIsOpen(place, ctx, profile) })),
  );
  // The day's plan: at most two places, the time shared after what is due.
  const plan = await ensureDayPlan(
    ctx,
    profile,
    maps.filter((m) => m.open).map((m) => ({ id: m.place.pack.id, due: m.map.due })),
  );
  for (const m of maps) {
    if (m.open && plan.minutes[m.place.pack.id] === undefined) {
      // Open, but not one of today's places: it rests today.
      m.map = { ...m.map, mood: 'asleep', moodText: `${m.place.name} vilar i dag.`, moodIcon: icon('moon'), nameIcon: icon('moon') };
    }
  }
  const lastId = await ctx.store.getSetting<string>(lastPlaceKey(profile));
  const last = maps.find((m) => m.place.id === lastId) ?? maps.find((m) => m.open) ?? maps[0]!;
  // The main button: the open place with the most to do today; the child may choose another.
  const awake = maps.filter((m) => m.open && m.map.mood !== 'asleep');
  const suggested = [...awake].sort((a, b) => b.map.due - a.map.due)[0] ?? maps.find((m) => m.open) ?? maps[0]!;
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
        maps.map(({ place, map, open }) =>
          h(
            'button',
            {
              class: `place ${map.spot} mood-${map.mood}`,
              type: 'button',
              'aria-label': `${place.name}. ${map.moodText}`,
              // A place that has not opened yet rests on the map; its line below says when it opens.
              disabled: !open,
              onclick: () => void go(place)(),
            },
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

/**
 * Today's plan for a child: kept for the day once made, and made again only
 * when the day, the session length or the open places change.
 */
async function ensureDayPlan(ctx: AppContext, profile: Profile, open: PlaceLoad[]): Promise<DayPlan> {
  const today = systemClock.today();
  const total = profile.settings.sessionMinutes;
  const saved = await ctx.store.getSetting<DayPlan>(dayPlanKey(profile.id));
  const plan = planHolds(saved, today, total, open.map((p) => p.id)) ? saved : planDay(today, total, open);
  if (plan !== saved) await ctx.store.setSetting(dayPlanKey(profile.id), plan);
  rememberPlan(profile.id, plan);
  return plan;
}

/** Where a child went last, so their animal stands there (per child). */
const lastPlaceKey = (profile: Profile) => `lastPlace:${profile.id}`;

/**
 * The brook, stretched to the ground's shape (the outlines keep their width).
 * It comes from far behind the hills, narrow, widens as it comes closer, runs
 * under the bridge and down along the left side, so the bridge's sign and the
 * garden stand on dry land.
 */
function valleyLand(): SVGSVGElement {
  const svg = s('svg', { class: 'valley-land', viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  const centre = BROOK.flatMap((curve, i) => Array.from({ length: 24 }, (_, k) => bezier(curve, (k + (i ? 1 : 0)) / 24)));
  // Width in percent of the ground's width: narrow far away, full width from the bridge on.
  const width = (i: number) => 0.2 + 6.8 * Math.min(1, i / 20) ** 0.75;
  // The ground is wider than it is high: offsets are worked out in its own proportions
  // (units of its height), so the water keeps its width whichever way it runs.
  const aspect = 1.4;
  const left: string[] = [];
  const right: string[] = [];
  centre.forEach(([x, y], i) => {
    const [nx, ny] = centre[Math.min(i + 1, centre.length - 1)]!;
    const [px, py] = centre[Math.max(i - 1, 0)]!;
    const tx = (nx - px) * aspect;
    const ty = ny - py;
    const len = Math.hypot(tx, ty) || 1;
    const half = (width(i) * aspect) / 2;
    const ox = ((-ty / len) * half) / aspect;
    const oy = (tx / len) * half;
    left.push(`${(x + ox).toFixed(2)} ${(y + oy).toFixed(2)}`);
    right.push(`${(x - ox).toFixed(2)} ${(y - oy).toFixed(2)}`);
  });
  const water = `M${left.join(' L')} L${right.reverse().join(' L')} Z`;
  const glint = `M${centre.slice(14).map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L')}`;
  svg.innerHTML = `<path d="${water}" class="brook-water"/>` + `<path d="${glint}" class="brook-glint"/>`;
  return svg;
}

type Pt = [number, number];

/** A point on a cubic Bézier curve. */
function bezier([p0, p1, p2, p3]: [Pt, Pt, Pt, Pt], t: number): Pt {
  const u = 1 - t;
  const f = (i: 0 | 1) => u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i];
  return [f(0), f(1)];
}

/** The brook's middle line, in percent of the ground: from behind the hills, under the bridge, down along the left side. */
const BROOK: [Pt, Pt, Pt, Pt][] = [
  [[28, 1], [27, 8], [28, 14], [26, 21]],
  [[26, 21], [24, 40], [12, 62], [15, 104]],
];

/** The path from the brook past the garden and out of the map, in percent of the ground. */
const PATH: [Pt, Pt, Pt, Pt][] = [
  [[19, 74], [30, 79], [44, 76], [58, 64]],
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
