import { describe, expect, it } from 'vitest';
import { MAX_PLACES_PER_DAY, MIN_PLACE_MINUTES, planDay, planHolds, plannedMinutes, rememberPlan } from '../../src/shell/dayPlan';

const DAY = '2026-02-02';
const total = (minutes: Record<string, number>) => Object.values(minutes).reduce((a, b) => a + b, 0);

describe('the day plan', () => {
  it('gives one open place all of the day', () => {
    expect(planDay(DAY, 12, [{ id: 'addition', due: 3 }]).minutes).toEqual({ addition: 12 });
  });

  it('shares the day after what is due, not in straight halves, and never more than the day', () => {
    const plan = planDay(DAY, 15, [
      { id: 'multiplication', due: 40 },
      { id: 'addition', due: 10 },
    ]);
    // 5 + 5 first, then the 5 left over: 4 to the garden (40 of 50 due), 1 to the brook.
    expect(plan.minutes).toEqual({ multiplication: 9, addition: 6 });
    expect(total(plan.minutes)).toBe(15);
  });

  it('gives every place of the day at least the least time, however little is due there', () => {
    const plan = planDay(DAY, 12, [
      { id: 'multiplication', due: 90 },
      { id: 'addition', due: 0 },
    ]);
    expect(plan.minutes.addition).toBe(MIN_PLACE_MINUTES);
    expect(plan.minutes.multiplication).toBe(7);
  });

  it('shares evenly when nothing is due yet (a new child)', () => {
    expect(planDay(DAY, 12, [{ id: 'a', due: 0 }, { id: 'b', due: 0 }]).minutes).toEqual({ a: 6, b: 6 });
    expect(total(planDay(DAY, 13, [{ id: 'a', due: 0 }, { id: 'b', due: 0 }]).minutes)).toBe(13);
  });

  it('visits at most two places a day: those with the most due, in map order', () => {
    const plan = planDay(DAY, 14, [
      { id: 'a', due: 2 },
      { id: 'b', due: 30 },
      { id: 'c', due: 12 },
    ]);
    expect(Object.keys(plan.minutes)).toEqual(['b', 'c']);
    expect(Object.keys(plan.minutes)).toHaveLength(MAX_PLACES_PER_DAY);
  });

  it('is kept for the day, and made again on a new day, a new length or a newly opened place', () => {
    const plan = planDay(DAY, 12, [{ id: 'addition', due: 3 }]);
    expect(planHolds(plan, DAY, 12, ['addition'])).toBe(true);
    expect(planHolds(plan, '2026-02-03', 12, ['addition'])).toBe(false);
    expect(planHolds(plan, DAY, 15, ['addition'])).toBe(false);
    expect(planHolds(plan, DAY, 12, ['multiplication', 'addition'])).toBe(false);
    expect(planHolds(undefined, DAY, 12, ['addition'])).toBe(false);
  });

  it('tells the engine a place’s minutes for today only', () => {
    rememberPlan('p1', { day: DAY, total: 12, minutes: { addition: 7, multiplication: 5 } });
    expect(plannedMinutes('p1', 'addition', DAY)).toBe(7);
    expect(plannedMinutes('p1', 'addition', '2026-02-03')).toBeUndefined();
    expect(plannedMinutes('p2', 'addition', DAY)).toBeUndefined();
  });
});
