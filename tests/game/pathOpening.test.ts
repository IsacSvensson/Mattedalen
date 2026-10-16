import { describe, expect, it } from 'vitest';
import { emptyState, type ItemState } from '../../src/engine';
import { createAdditionPack } from '../../src/content/addition';
import { createHundredPack } from '../../src/content/hundred';
import { createMultiplicationPack } from '../../src/content/multiplication';
import { pathOpens, pathWaiting } from '../../src/places/stigen/opening';
import { heldTables, OPENED_BY_ADULT, tablesWaiting, TABLES_WAIT, WAIT_PLAY_DAYS, waitText } from '../../src/places/tradgarden/waits';
import { playDays } from '../../src/places/tradgarden/held';
import { addDays } from '../../src/engine';
import type { SessionRecord } from '../../src/storage';
import { planDay, restedYesterday } from '../../src/shell/dayPlan';

const brook = createAdditionPack();
const path = createHundredPack();
const fluentIn = (pack: typeof brook, units: string[]) =>
  Object.fromEntries(pack.units.filter((u) => units.includes(u.id)).flatMap((u) => u.itemIds).map((id): [string, ItemState] => [id, { ...emptyState(id), status: 'fluent', box: 3 }]));

describe('when Stigen opens', () => {
  it('opens when going over the ten sits at the brook, when the child has started, or when a grown-up opens it', () => {
    const fresh = {};
    expect(pathOpens({ pathStates: fresh, brook: { pack: brook, states: fluentIn(brook, ['tio', 'tiokamrater', 'dubblor']) }, openedByAdult: false })).toBe(false);
    expect(pathOpens({ pathStates: fresh, brook: { pack: brook, states: fluentIn(brook, ['overtio']) }, openedByAdult: false })).toBe(true);
    expect(pathOpens({ pathStates: fresh, brook: { pack: brook, states: {} }, openedByAdult: true })).toBe(true);
    expect(pathOpens({ pathStates: { 'tens:3': { ...emptyState('tens:3'), status: 'learning' } }, brook: { pack: brook, states: {} }, openedByAdult: false })).toBe(true);
  });

  it('lets each part wait for what it builds on at the brook', () => {
    expect(pathWaiting(brook, {}).sort()).toEqual(['dubbla', 'overtio', 'tilltio', 'tiotal']);
    expect(pathWaiting(brook, fluentIn(brook, ['tio', 'tiokamrater', 'overtio']))).toEqual(['dubbla']);
    expect(pathWaiting(undefined, {})).toEqual([]);
  });
});

describe('the garden’s tables and Stigen', () => {
  it('wait for the part on Stigen their räknestigar need', () => {
    expect(tablesWaiting(path, {}).sort()).toEqual(Object.keys(TABLES_WAIT).sort());
    expect(tablesWaiting(path, fluentIn(path, ['tiotal', 'dubbla'])).sort()).toEqual(['u3', 'u6', 'u78', 'u9', 'usq']);
    // A skill the child shows in the garden counts: ×5 sits, so halving does, and ×4 does not wait.
    const garden = createMultiplicationPack({ division: true });
    const fives = Object.fromEntries(garden.units.find((u) => u.id === 'u5')!.itemIds.map((id): [string, ItemState] => [id, { ...emptyState(id), status: 'fluent', box: 3 }]));
    expect(tablesWaiting(path, {}, { pack: garden, states: fives })).not.toContain('u4');
    expect(tablesWaiting(path, {}, { pack: garden, states: fives })).toContain('u3');
    expect(waitText('u6')).toBe('×6 kommer när du kan gå över tiotalet på stigen.');
    expect(waitText('u78')).toBe('×7 och ×8 kommer när du kan lägga ihop tvåsiffriga tal på stigen.');
  });

  it('do not count ×5 among those that wait: it is counting in fives', () => {
    expect(TABLES_WAIT.u5).toBeUndefined();
    expect(tablesWaiting(path, {})).not.toContain('u5');
  });

  it('wait at most 14 play days from the day they could have opened, or not at all once a grown-up opens them', () => {
    const could = new Set(['u10', 'u4']);
    const first = heldTables(['u10', 'u4', 'u3'], could, {}, '2026-02-02', []);
    // u3 cannot open yet (its own rule in the garden), so it gets no day.
    expect(first.ready).toEqual({ u10: '2026-02-02', u4: '2026-02-02' });
    expect(first.changed).toBe(true);
    expect(first.held).toEqual(['u10', 'u4', 'u3']);
    // Every other day for four weeks: 14 play days, but only from the 27th day on.
    const everyOther = Array.from({ length: 14 }, (_, i) => addDays('2026-02-02', 2 * i));
    expect(heldTables(['u10', 'u4'], could, first.ready, '2026-02-27', everyOther.slice(0, 13)).held).toEqual(['u10', 'u4']);
    expect(heldTables(['u10', 'u4'], could, first.ready, '2026-03-01', everyOther).held).toEqual([]);
    // Days before the table could open do not count.
    expect(heldTables(['u10'], could, first.ready, '2026-02-03', Array.from({ length: 20 }, (_, i) => addDays('2026-01-01', i))).held).toEqual(['u10']);
    expect(heldTables(['u10'], could, { u10: OPENED_BY_ADULT }, '2026-02-02', []).held).toEqual([]);
    expect(WAIT_PLAY_DAYS).toBe(14);
  });

  it('count a play day once, from sessions with answers, not the start check or a koll', () => {
    const s = (day: string, mode: SessionRecord['mode'], answered = 5) => ({ day, mode, answered }) as SessionRecord;
    const days = playDays([s('2026-02-02', 'daily'), s('2026-02-02', 'extra'), s('2026-02-03', 'placement'), s('2026-02-04', 'check'), s('2026-02-05', 'daily', 0), s('2026-02-06', 'focus')]);
    expect(days).toEqual(['2026-02-02', '2026-02-06']);
  });
});

describe('the day plan with three places', () => {
  it('puts a place that rested yesterday first, so a new place with nothing due gets its days', () => {
    const open = [
      { id: 'multiplication', due: 20 },
      { id: 'addition', due: 15 },
      { id: 'hundred', due: 0 },
    ];
    const day1 = planDay('2026-02-02', 12, open, restedYesterday(undefined, '2026-02-02', open.map((p) => p.id)));
    expect(Object.keys(day1.minutes)).toEqual(['multiplication', 'addition']);
    const rested = restedYesterday(day1, '2026-02-03', open.map((p) => p.id));
    expect(rested).toEqual(['hundred']);
    expect(Object.keys(planDay('2026-02-03', 12, open, rested).minutes)).toEqual(['multiplication', 'hundred']);
    // After a day off, nothing is owed.
    expect(restedYesterday(day1, '2026-02-05', open.map((p) => p.id))).toEqual([]);
  });
});
