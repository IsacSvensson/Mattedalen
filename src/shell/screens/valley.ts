import { systemClock } from '../../engine';
import type { Profile } from '../../storage';
import { show, type AppContext } from '../app';
import { avatarIcon } from '../components/avatars';
import { icon } from '../components/icons';
import { scene } from '../components/scene';
import { world } from '../components/world';
import { h } from '../dom';
import { dayPlanKey, planDay, planHolds, rememberPlan, restedYesterday, type DayPlan, type PlaceLoad } from '../dayPlan';
import { placeIsOpen, type Place } from '../place';
import { hasSwedishVoice, speak, speechSupported } from '../speech';
import { showProfiles } from './profiles';

/**
 * The valley: the child's start page, a world of scenes with one per place
 * (`components/world.ts`, docs/PLAN-DALEN.md). Only places that exist get a
 * scene, so nothing waits to be unlocked; a place that is not open yet rests
 * in its scene. The world opens at today's place: the awake place with the
 * most due today (ties: the first in the valley). The child chooses where to go.
 */
export async function showValley(ctx: AppContext, profile: Profile): Promise<void> {
  const maps = await placeMaps(ctx, profile);
  // The day's plan: at most two places, the time shared after what is due.
  const plan = await ensureDayPlan(ctx, profile, openLoads(maps));
  for (const m of maps) {
    if (m.open && plan.minutes[m.place.pack.id] === undefined) {
      // Open, but not one of today's places: it rests today.
      m.scene = { ...m.scene, mood: 'asleep', moodText: `${m.place.name} vilar i dag.`, moodIcon: icon('moon'), nameIcon: icon('moon') };
    }
  }
  const awake = maps.filter((m) => m.open && m.scene.mood !== 'asleep');
  const today = [...awake].sort((a, b) => b.scene.due - a.scene.due)[0] ?? maps.find((m) => m.open) ?? maps[0]!;
  const go = (place: Place) => () => place.open(ctx, profile);
  const sunflowers = maps.reduce((n, m) => n + m.scene.sunflowers, 0);
  const voiceOn = profile.settings.readAloud && speechSupported() && (await hasSwedishVoice());
  const spoken = maps.map(({ scene }) => scene.moodText).join(' ');
  const scenes = world(
    maps.map(({ place, scene, open }) => ({ id: place.id, name: place.name, open, scene, go: () => void go(place)() })),
    { start: maps.indexOf(today), guide: avatarIcon(profile.avatar) },
  );

  const view = h(
    'main',
    { class: 'screen valley has-scene' },
    h(
      'header',
      { class: 'garden-head valley-head' },
      scene({ height: 120, sunflowers, cloud: true }),
      h(
        'div',
        { class: 'scene-title' },
        h('button', { class: 'avatar-badge avatar-button', type: 'button', 'aria-label': 'Byt spelare', onclick: () => void showProfiles(ctx) }, avatarIcon(profile.avatar)),
        h('h1', null, 'Mattedalen'),
        voiceOn
          ? h('button', { class: 'icon-button speak-button', type: 'button', 'aria-label': 'Läs upp', onclick: () => void speak(spoken) }, icon('speaker'))
          : null,
      ),
    ),
    maps.map(({ scene }) => (scene.landscapeText ? h('p', { class: 'sr-only' }, scene.landscapeText) : null)),
    scenes.el,
  );
  show(ctx, view, () => scenes.cleanup());
  scenes.mount();
}

const placeMaps = (ctx: AppContext, profile: Profile) =>
  Promise.all(ctx.places.map(async (place) => ({ place, scene: await place.scene(ctx, profile), open: await placeIsOpen(place, ctx, profile) })));

const openLoads = (maps: Awaited<ReturnType<typeof placeMaps>>): PlaceLoad[] =>
  maps.filter((m) => m.open).map((m) => ({ id: m.place.pack.id, due: m.scene.due }));

/**
 * Makes today's plan without showing the valley, for a way into a place that
 * does not pass it (a new child goes straight to their first place).
 */
export async function prepareDayPlan(ctx: AppContext, profile: Profile): Promise<DayPlan> {
  return ensureDayPlan(ctx, profile, openLoads(await placeMaps(ctx, profile)));
}

/**
 * Today's plan for a child: kept for the day once made, and made again only
 * when the day, the session length or the open places change.
 */
async function ensureDayPlan(ctx: AppContext, profile: Profile, open: PlaceLoad[]): Promise<DayPlan> {
  const today = systemClock.today();
  const total = profile.settings.sessionMinutes;
  const saved = await ctx.store.getSetting<DayPlan>(dayPlanKey(profile.id));
  const ids = open.map((p) => p.id);
  const plan = planHolds(saved, today, total, ids) ? saved : planDay(today, total, open, restedYesterday(saved, today, ids));
  if (plan !== saved) await ctx.store.setSetting(dayPlanKey(profile.id), plan);
  rememberPlan(profile.id, plan);
  return plan;
}
