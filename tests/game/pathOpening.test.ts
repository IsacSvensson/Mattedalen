import { describe, expect, it } from 'vitest';
import { emptyState, type ItemState } from '../../src/engine';
import { createAdditionPack } from '../../src/content/addition';
import { createHundredPack } from '../../src/content/hundred';
import { createMultiplicationPack } from '../../src/content/multiplication';
import { pathOpens, pathWaiting } from '../../src/places/stigen/opening';
import { heldTables, OPENED_BY_ADULT, tablesWaiting, TABLES_WAIT, WAIT_DAYS_MAX, waitText } from '../../src/places/tradgarden/waits';
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

  it('wait at most three weeks from the day they could have opened, or not at all once a grown-up opens them', () => {
    const could = new Set(['u10', 'u4']);
    const first = heldTables(['u10', 'u4', 'u3'], could, {}, '2026-02-02');
    // u3 cannot open yet (its own rule in the garden), so it gets no day.
    expect(first.ready).toEqual({ u10: '2026-02-02', u4: '2026-02-02' });
    expect(first.changed).toBe(true);
    expect(first.held).toEqual(['u10', 'u4', 'u3']);
    expect(heldTables(['u10', 'u4'], could, first.ready, '2026-02-22').held).toEqual(['u10', 'u4']);
    expect(heldTables(['u10', 'u4'], could, first.ready, '2026-02-23').held).toEqual([]);
    expect(heldTables(['u10'], could, { u10: OPENED_BY_ADULT }, '2026-02-02').held).toEqual([]);
    expect(WAIT_DAYS_MAX).toBe(21);
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
