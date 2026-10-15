import type { DayKey } from '../engine';

/**
 * The day's plan: which places the child visits today and how many minutes
 * each gets. The day's time (the session length a grown-up chose) is shared,
 * so two places never mean twice the screen time.
 *
 * - At most two places a day; the child chooses the order.
 * - Every place of the day gets at least `MIN_PLACE_MINUTES`; the rest of the
 *   time follows how much is due for review at each place, not straight halves.
 * - The plan is made once a day and kept, so the shares do not shift while the
 *   child works through the reviews at one place.
 */

/** Places a child visits at most in a day. */
export const MAX_PLACES_PER_DAY = 2;

/** Shortest daily session at one place, in minutes. */
export const MIN_PLACE_MINUTES = 5;

export interface PlaceLoad {
  /** The place's pack id: what the engine knows the place by. */
  id: string;
  /** Items due for review today (or overdue). */
  due: number;
}

export interface DayPlan {
  day: DayKey;
  /** The day's time in minutes, as set when the plan was made. */
  total: number;
  /** Minutes per place of the day, by pack id, in the order the places were offered. */
  minutes: Record<string, number>;
}

/**
 * Plans a day for the open places, given in map order. The places with the
 * most due come first when there are more than `MAX_PLACES_PER_DAY`; ties keep
 * the map order.
 */
export function planDay(day: DayKey, total: number, open: readonly PlaceLoad[]): DayPlan {
  const chosen = [...open]
    .map((load, order) => ({ load, order }))
    .sort((a, b) => b.load.due - a.load.due || a.order - b.order)
    .slice(0, MAX_PLACES_PER_DAY)
    .sort((a, b) => a.order - b.order)
    .map(({ load }) => load);
  const minutes: Record<string, number> = {};
  if (!chosen.length) return { day, total, minutes };
  if (chosen.length === 1) return { day, total, minutes: { [chosen[0]!.id]: total } };

  // Everyone gets the least time first; what is left follows what is due.
  const least = Math.min(MIN_PLACE_MINUTES, Math.floor(total / chosen.length));
  const rest = total - least * chosen.length;
  const due = chosen.reduce((sum, p) => sum + p.due, 0);
  const weights = chosen.map((p) => (due > 0 ? p.due / due : 1 / chosen.length));
  // Whole minutes, the largest remainders rounded up, so the parts add up to the day.
  const exact = weights.map((w) => w * rest);
  const whole = exact.map(Math.floor);
  let left = rest - whole.reduce((a, b) => a + b, 0);
  const byRemainder = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of byRemainder) {
    if (left <= 0) break;
    whole[i]!++;
    left--;
  }
  chosen.forEach((p, i) => (minutes[p.id] = least + whole[i]!));
  return { day, total, minutes };
}

/** Whether a stored plan still holds: the same day, the same time, the same open places. */
export function planHolds(plan: DayPlan | undefined, day: DayKey, total: number, openIds: readonly string[]): plan is DayPlan {
  if (!plan || plan.day !== day || plan.total !== total) return false;
  // A place that opened during the day makes a new plan; one that is already planned stays.
  const planned = Object.keys(plan.minutes);
  return openIds.every((id) => planned.includes(id)) || planned.length >= MAX_PLACES_PER_DAY;
}

/** The plans in use, by profile id: the engine reads the day's minutes from here. */
const plans = new Map<string, DayPlan>();

export function rememberPlan(profileId: string, plan: DayPlan): void {
  plans.set(profileId, plan);
}

/** A place's minutes today, or undefined when there is no plan for today. */
export function plannedMinutes(profileId: string, packId: string, today: DayKey): number | undefined {
  const plan = plans.get(profileId);
  return plan && plan.day === today ? plan.minutes[packId] : undefined;
}

/** Key of the stored plan in the app settings. */
export const dayPlanKey = (profileId: string) => `dayPlan:${profileId}`;
