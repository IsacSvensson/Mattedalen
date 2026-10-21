import { systemClock } from '../../engine';
import type { Profile } from '../../storage';
import { show, type AppContext } from '../app';
import { avatarIcon } from '../components/avatars';
import { icon } from '../components/icons';
import { today as todayCard } from '../components/today';
import { valleyMap } from '../components/valleyMap';
import { h } from '../dom';
import { dayPlanKey, planDay, planHolds, rememberPlan, restedYesterday, type DayPlan, type PlaceLoad } from '../dayPlan';
import { placeIsOpen, type Place } from '../place';
import { hasSwedishVoice, speak, speechSupported } from '../speech';
import { showProfiles } from './profiles';
import { setWhere } from '../resume';

/**
 * The valley: the child's start page, a map with every place at full size
 * (`components/valleyMap.ts`, docs/PLAN-DALEN.md). Only places that exist are
 * drawn, so nothing waits to be unlocked; a place that is not open yet rests on
 * the map. The map opens at today's place: the awake place with the most due
 * today (ties: the first in the valley), or at the place the child comes back
 * from (`at`). The child chooses where to go; "I dag" in the corner says what
 * is left today and starts it.
 */
export async function showValley(ctx: AppContext, profile: Profile, opts: { at?: string } = {}): Promise<void> {
  setWhere({ kind: 'valley', profileId: profile.id });
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
  const at = maps.find((m) => m.place.id === opts.at) ?? today;
  // What is left today, today's place first; the places that rest today below.
  const left = [...awake].sort((a, b) => b.scene.due - a.scene.due);
  // The hand that shows the drag: the first times, until the child has moved the map (docs/PLAN-ENKLARE.md, E3).
  const hintKey = mapHintKey(profile.id);
  const hintState = (await ctx.store.getSetting<MapHint>(hintKey)) ?? { shown: 0 };
  const hint = !hintState.moved && hintState.shown < MAP_HINTS;
  if (hint) await ctx.store.setSetting(hintKey, { ...hintState, shown: hintState.shown + 1 });
  const map = valleyMap(
    maps.map(({ place, scene, open }) => ({ id: place.id, name: place.name, open, scene, go: () => void go(place)() })),
    {
      start: at.place.id,
      guide: avatarIcon(profile.avatar),
      sunflowers,
      nudge: left[0]?.place.id,
      hint,
      onMoved: () => void ctx.store.setSetting(hintKey, { shown: MAP_HINTS, moved: true }),
    },
  );
  const card = todayCard(
    left.map(({ place, scene }) => ({ icon: scene.go.icon, label: scene.go.label, note: scene.moodText, start: () => void place.start(ctx, profile) })),
    maps.filter((m) => m.open && m.scene.mood === 'asleep').map(({ scene }) => ({ icon: icon('moon'), text: scene.moodText })),
  );

  const view = h(
    'main',
    { class: 'screen valley' },
    map.el,
    // On top of the map, top left: the child's animal (switch player), the name and read-aloud.
    h(
      'header',
      { class: 'map-head' },
      h('button', { class: 'avatar-badge avatar-button', type: 'button', 'aria-label': 'Byt spelare', onclick: () => void showProfiles(ctx) }, avatarIcon(profile.avatar)),
      h('h1', null, 'Mattedalen'),
      voiceOn
        ? h('button', { class: 'icon-button speak-button', type: 'button', 'aria-label': 'Läs upp', onclick: () => void speak(spoken) }, icon('speaker'))
        : null,
    ),
    card,
    maps.map(({ scene }) => (scene.landscapeText ? h('p', { class: 'sr-only' }, scene.landscapeText) : null)),
  );
  show(ctx, view, () => map.cleanup());
  map.mount();
}

/** The hand on the map, per child: how many times it has come, and whether the child has moved the map. */
interface MapHint {
  shown: number;
  moved?: boolean;
}
export const MAP_HINTS = 3;
export const mapHintKey = (profileId: string) => `mapHint:${profileId}`;

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
