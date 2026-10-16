import { describe, expect, it } from 'vitest';
import { AVERAGE, STRONG } from './learner';
import { simulateValley } from './valley';

/**
 * The whole valley with simulated children (docs/PLAN-HUNDRA.md, Fynd från
 * H5): the brook, the garden when doubles sit, and Stigen when going over the
 * ten sits at the brook. The garden's tables wait for their part on Stigen at
 * most three weeks. Without that limit, the later tables stalled for months.
 */
const WEEKS = 52;
const week = (day: number | undefined) => (day === undefined ? Infinity : Math.floor(day / 7));

const without = simulateValley({ profile: AVERAGE, seed: 1, weeks: WEEKS, path: false });
const app = simulateValley({ profile: AVERAGE, seed: 1, weeks: WEEKS, path: true });
const hard = simulateValley({ profile: AVERAGE, seed: 1, weeks: WEEKS, path: true, waits: 'hard' });
const strong = simulateValley({ profile: STRONG, seed: 1, weeks: WEEKS, path: true });

describe('the valley with Stigen, simulated', () => {
  it('opens Stigen when going over the ten sits at the brook, and the child walks it', () => {
    expect(app.openDay.hundred).not.toBeNull();
    expect(week(app.openDay.hundred!)).toBeGreaterThanOrEqual(week(app.sitDay['addition:overtio']));
    // Stigen has part of the day, beside the brook and the garden: an average child is on the way to the ten after a year.
    for (const part of ['tiotal', 'tiental', 'ental', 'tilltio', 'dubbla']) expect(app.firstDay[`hundred:${part}`], part).toBeDefined();
    expect(strong.firstDay['hundred:overtio']).toBeDefined();
  });

  it('keeps the garden going: the tables come in order, each waiting at most a few weeks for Stigen', () => {
    for (const table of ['u2', 'u10', 'u5', 'u1', 'u4', 'u3', 'u9', 'u6']) expect(app.firstDay[`multiplication:${table}`], table).toBeDefined();
    expect(week(app.firstDay['multiplication:u2'])).toBeLessThan(week(app.firstDay['multiplication:u10']));
    // A third place takes some of the day, and the tables wait a little: a cost, not a stall.
    expect(app.timesSit(WEEKS)).toBeGreaterThan(without.timesSit(WEEKS) - 0.1);
  });

  it('would stall the garden if the tables waited until Stigen sits, however long that takes', () => {
    expect(hard.timesSit(WEEKS)).toBeLessThan(app.timesSit(WEEKS) - 0.25);
    expect(hard.firstDay['multiplication:u3']).toBeUndefined();
  });

  it('lets a strong child through quickly: every table started within half a year', () => {
    for (const table of ['u10', 'u5', 'u4', 'u3', 'usq', 'u9', 'u6', 'u78']) expect(week(strong.firstDay[`multiplication:${table}`]), table).toBeLessThanOrEqual(26);
    expect(strong.timesSit(26)).toBeGreaterThan(0.9);
  });

  it('stays at a good level of right answers', () => {
    for (const r of [app, strong]) expect(r.correct / r.answered).toBeGreaterThan(0.78);
  });
});
