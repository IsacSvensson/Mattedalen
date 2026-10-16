import { describe, expect, it } from 'vitest';
import { AVERAGE, STRONG } from './learner';
import { simulateValley } from './valley';

/**
 * The whole valley with simulated children (docs/PLAN-HUNDRA.md, Fynd från
 * H5, and docs/PLAN-GRANSKNING.md, R2): the brook, the garden when doubles
 * sit, and Stigen when going over the ten sits at the brook. The garden's
 * tables wait for their part on Stigen only while Stigen is open, and at most
 * 14 play days. One seed each here; `valleyReport.test.ts` runs many.
 */
const WEEKS = 52;
const week = (day: number | undefined) => (day === undefined ? Infinity : Math.floor(day / 7));
const TABLES = ['u2', 'u10', 'u5', 'u1', 'u4', 'u3', 'usq', 'u9', 'u6', 'u78'];

const without = simulateValley({ profile: AVERAGE, seed: 1, weeks: WEEKS, path: false });
const app = simulateValley({ profile: AVERAGE, seed: 1, weeks: WEEKS, path: true });
const strong = simulateValley({ profile: STRONG, seed: 1, weeks: WEEKS, path: true });
const strongHard = simulateValley({ profile: STRONG, seed: 1, weeks: WEEKS, path: true, waits: 'hard' });

describe('the valley with Stigen, simulated', () => {
  it('opens Stigen when going over the ten sits at the brook, and the child walks it', () => {
    expect(app.openDay.hundred).not.toBeNull();
    expect(week(app.openDay.hundred!)).toBeGreaterThanOrEqual(week(app.sitDay['addition:overtio']));
    for (const part of ['tiotal', 'tiental', 'ental', 'dubbla']) expect(app.firstDay[`hundred:${part}`], part).toBeDefined();
    expect(strong.firstDay['hundred:overtio']).toBeDefined();
  });

  it('lets nothing wait while Stigen is closed: until it opens, the garden goes as without Stigen', () => {
    const before = TABLES.filter((t) => app.firstDay[`multiplication:${t}`]! < app.openDay.hundred!);
    expect(before.length).toBeGreaterThan(5);
    for (const t of before) expect(app.firstDay[`multiplication:${t}`], t).toBe(without.firstDay[`multiplication:${t}`]);
  });

  it('keeps the garden going: every table starts, and a third place costs a little, not a stall', () => {
    for (const t of TABLES) expect(app.firstDay[`multiplication:${t}`], t).toBeDefined();
    expect(week(app.firstDay['multiplication:u2'])).toBeLessThan(week(app.firstDay['multiplication:u10']));
    expect(app.timesSit(WEEKS)).toBeGreaterThan(without.timesSit(WEEKS) - 0.1);
  });

  it('lets a strong child through quickly: every table started within half a year, some let go by the cap', () => {
    for (const t of TABLES) expect(week(strong.firstDay[`multiplication:${t}`]), t).toBeLessThanOrEqual(26);
    expect(strong.timesSit(26)).toBeGreaterThan(0.9);
    expect(strong.byCap.length).toBeGreaterThan(0);
  });

  it('would hold the later tables for months without the cap', () => {
    for (const t of ['u3', 'usq', 'u78']) {
      expect(week(strongHard.firstDay[`multiplication:${t}`]) - week(strong.firstDay[`multiplication:${t}`]), t).toBeGreaterThanOrEqual(8);
    }
  });

  it('stays at a good level of right answers', () => {
    for (const r of [app, strong]) expect(r.correct / r.answered).toBeGreaterThan(0.78);
  });
});
