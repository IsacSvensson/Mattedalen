import { describe, expect, it } from 'vitest';
import { computeUnlocked, DEFAULT_CONFIG, emptyState, PacingController, requiredCount, type ItemState, type Unit } from '../../src/engine';

const pacing = DEFAULT_CONFIG.pacing;

describe('pacing controller', () => {
  it('has no opinion before a few answers', () => {
    const p = new PacingController(pacing, 8);
    expect(p.accuracy()).toBeNull();
    expect(p.allowNew()).toBe(true);
  });

  it('brings new items sooner when everything is right', () => {
    const p = new PacingController(pacing, 8);
    for (let i = 0; i < 60; i++) p.record(true);
    expect(p.gap).toBe(pacing.minGap);
  });

  it('holds back new items when too many answers are wrong', () => {
    const p = new PacingController(pacing, 8);
    for (let i = 0; i < 60; i++) p.record(i % 3 !== 0); // ~67 % correct
    expect(p.gap).toBe(pacing.maxGap);
    expect(p.allowNew()).toBe(false);
  });

  it('keeps the gap unchanged inside the target band', () => {
    const p = new PacingController(pacing, 8);
    // One mistake in every 7 answers: every window of 10 is 80 % or 90 % correct.
    for (let i = 0; i < 200; i++) p.record(i % 7 !== 6);
    expect(p.gap).toBe(8);
    expect(p.allowNew()).toBe(true);
  });
});

describe('unit unlocking', () => {
  const units: Unit[] = [
    { id: 'a', title: 'A', order: 0, itemIds: ['a1', 'a2', 'a3', 'a4', 'a5'], unlockRule: { kind: 'always' } },
    { id: 'b', title: 'B', order: 1, itemIds: ['b1', 'b2', 'b3', 'b4'], unlockRule: { kind: 'previous', fraction: 0.8, minStatus: 'fluent' } },
    { id: 'c', title: 'C', order: 2, itemIds: ['c1'], unlockRule: { kind: 'previous', fraction: 0.8, minStatus: 'fluent' } },
  ];
  const states = (fluent: string[]): Record<string, ItemState> =>
    Object.fromEntries(
      units.flatMap((u) => u.itemIds).map((id) => [id, { ...emptyState(id), status: fluent.includes(id) ? 'fluent' : 'learning' }]),
    );

  it('opens the first unit only, at first', () => {
    expect(computeUnlocked(units, states([]), [])).toEqual(['a']);
  });

  it('opens the next unit when ~80 % of the previous one is fluent', () => {
    expect(computeUnlocked(units, states(['a1', 'a2', 'a3']), [])).toEqual(['a']);
    expect(computeUnlocked(units, states(['a1', 'a2', 'a3', 'a4']), [])).toEqual(['a', 'b']);
  });

  it('rounds down for small units (3 of 4 is about 80 %)', () => {
    expect(requiredCount(units[1] as Unit, 0.8)).toBe(3);
    expect(computeUnlocked(units, states(['a1', 'a2', 'a3', 'a4', 'b1', 'b2', 'b3']), [])).toEqual(['a', 'b', 'c']);
  });

  it('never skips a unit', () => {
    expect(computeUnlocked(units, states(['b1', 'b2', 'b3', 'b4']), [])).toEqual(['a']);
  });

  it('keeps units unlocked even if the learner slips', () => {
    expect(computeUnlocked(units, states([]), ['a', 'b'])).toEqual(['a', 'b']);
  });

  it('can open earlier with a relaxed fraction (learner above target)', () => {
    expect(computeUnlocked(units, states(['a1', 'a2', 'a3']), [], 0.6)).toEqual(['a', 'b']);
  });
});
