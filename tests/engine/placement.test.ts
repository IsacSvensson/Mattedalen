import { describe, expect, it } from 'vitest';
import { applyPlacement, DEFAULT_CONFIG, emptyState, passThreshold, Placement, seededRng, type ItemId } from '../../src/engine';
import { createMultiplicationPack } from '../../src/content/multiplication';
import { createWordPack } from './fixtures';

const pack = createMultiplicationPack();

/** A test-taker that knows exactly the given units (answers fast) and nothing else. */
function take(knownUnits: string[], seed = 1, slowMs?: number) {
  const known = new Set(pack.units.filter((u) => knownUnits.includes(u.id)).flatMap((u) => u.itemIds));
  const p = new Placement(pack, seededRng(seed));
  let asked = 0;
  for (let item = p.next(); item; item = p.next()) {
    asked++;
    p.submit(known.has(item.id) ? item.answer : '0', slowMs ?? 2000);
  }
  return { ...p.result(), asked };
}

describe('placement check', () => {
  it('places a learner who knows ×10, ×2, ×5 and ×1 at ×4', () => {
    const r = take(['u10', 'u2', 'u5', 'u1']);
    expect(r.passedUnitIds).toEqual(['u10', 'u2', 'u5', 'u1']);
    expect(r.stoppedAt).toBe('u4');
    expect(r.asked).toBeLessThanOrEqual(4 * 4 + 3);
  });

  it('stops quickly for a beginner', () => {
    const r = take([]);
    expect(r.passedUnitIds).toEqual([]);
    expect(r.stoppedAt).toBe('u10');
    expect(r.asked).toBe(3); // two misses, a second chance, a third miss
  });

  it('lets a learner who knows everything through every unit', () => {
    const r = take(pack.units.map((u) => u.id));
    expect(r.passedUnitIds).toHaveLength(10);
    expect(r.stoppedAt).toBeNull();
  });

  it('passes known units on slow answers too, but only fast ones make them fluent', () => {
    const fast = take(['u10', 'u2']);
    expect(fast.passedUnitIds).toEqual(['u10', 'u2']);
    expect(fast.fluentUnitIds).toEqual(['u10', 'u2']);
    const slow = take(['u10', 'u2'], 1, 9000);
    expect(slow.passedUnitIds).toEqual(['u10', 'u2']);
    expect(slow.fluentUnitIds).toEqual([]);
    expect(slow.stoppedAt).toBe('u5');
  });

  it('does not count answers that took very long (counted out step by step)', () => {
    const r = take(['u10', 'u2'], 1, 25_000);
    expect(r.passedUnitIds).toEqual([]);
  });

  it('never counts the first answer as slow (it is also the first go at the number pad)', () => {
    const p = new Placement(pack, seededRng(2));
    let first = true;
    for (let item = p.next(); item && p.result().passedUnitIds.length === 0; item = p.next()) {
      p.submit(item.answer, first ? 12_000 : 3000);
      first = false;
    }
    expect(p.result().fluentUnitIds).toEqual(['u10']);
  });

  it('allows one slip per unit of four', () => {
    expect(passThreshold(4)).toBe(3);
    expect(passThreshold(2)).toBe(2);
    const p = new Placement(pack, seededRng(3));
    let first = true;
    for (let item = p.next(); item && p.result().passedUnitIds.length === 0; item = p.next()) {
      p.submit(first ? '0' : item.answer, 1500);
      first = false;
    }
    expect(p.result().passedUnitIds).toEqual(['u10']);
  });

  it('gives a second chance after one slip too many, but not a third', () => {
    const run = (pattern: boolean[]) => {
      const p = new Placement(pack, seededRng(9));
      let i = 0;
      for (let item = p.next(); item && p.result().passedUnitIds.length === 0 && !p.isDone(); item = p.next()) {
        p.submit(pattern[i++] ?? true ? item.answer : '0', 1500);
      }
      return { passed: p.result().passedUnitIds, asked: i };
    };
    // Two misses out of four, then both extra items right: 4 of 6 passes.
    expect(run([false, true, false, true, true, true])).toEqual({ passed: ['u10'], asked: 6 });
    // A miss among the extra items stops the check.
    expect(run([false, true, false, true, false])).toEqual({ passed: [], asked: 5 });
  });

  it('samples different items from each unit and works for any content', () => {
    const words = createWordPack();
    const p = new Placement(words, seededRng(5));
    const asked: ItemId[] = [];
    for (let item = p.next(); item; item = p.next()) {
      asked.push(item.id);
      p.submit(item.answer, 1000);
    }
    expect(new Set(asked).size).toBe(asked.length);
    expect(p.result().passedUnitIds).toEqual(['animals', 'colours']);
  });
});

describe('applying a placement', () => {
  const today = '2026-03-02';

  it('makes passed units fluent, spreads their reviews over a week and unlocks the next unit', () => {
    const states = Object.fromEntries(pack.items.map((i) => [i.id, emptyState(i.id)]));
    const meta = { pacingGap: 8, unlockedUnitIds: ['u10'], accuracyEma: null, sessionsCompleted: 0, lastSessionDay: null };
    const result = { passedUnitIds: ['u10', 'u2'], fluentUnitIds: ['u10', 'u2'], stoppedAt: 'u5', answers: [] };
    const out = applyPlacement(pack, DEFAULT_CONFIG, result, states, meta, today);
    const placed = pack.units.filter((u) => ['u10', 'u2'].includes(u.id)).flatMap((u) => u.itemIds);
    for (const id of placed) expect(out.states[id]!.status).toBe('fluent');
    expect(out.states['5x7']!.status).toBe('new');
    const dueDays = new Set(placed.map((id) => out.states[id]!.dueDay));
    expect(dueDays.size).toBe(7);
    expect([...dueDays].sort()[0]).toBe('2026-03-03');
    expect(out.meta.unlockedUnitIds).toEqual(['u10', 'u2', 'u5']);
  });

  it('makes units passed with slow answers learning, due within a few days', () => {
    const states = Object.fromEntries(pack.items.map((i) => [i.id, emptyState(i.id)]));
    const meta = { pacingGap: 8, unlockedUnitIds: ['u10'], accuracyEma: null, sessionsCompleted: 0, lastSessionDay: null };
    const result = { passedUnitIds: ['u10', 'u2'], fluentUnitIds: ['u10'], stoppedAt: 'u5', answers: [] };
    const out = applyPlacement(pack, DEFAULT_CONFIG, result, states, meta, today);
    const two = pack.units.find((u) => u.id === 'u2')!.itemIds;
    for (const id of two) {
      expect(out.states[id]!.status).toBe('learning');
      expect(out.states[id]!.box).toBe(1);
      expect(['2026-03-03', '2026-03-04', '2026-03-05']).toContain(out.states[id]!.dueDay);
    }
    expect(out.states['10x3']!.status).toBe('fluent');
    expect(out.meta.unlockedUnitIds).toEqual(['u10', 'u2', 'u5']);
  });

  it('never lowers existing progress', () => {
    const states = { '10x3': { ...emptyState('10x3'), status: 'automatic' as const, box: 5, dueDay: '2026-04-01' } };
    const meta = { pacingGap: 8, unlockedUnitIds: ['u10', 'u2', 'u5'], accuracyEma: 0.9, sessionsCompleted: 9, lastSessionDay: null };
    const out = applyPlacement(pack, DEFAULT_CONFIG, { passedUnitIds: ['u10'], fluentUnitIds: ['u10'], stoppedAt: 'u2', answers: [] }, states, meta, today);
    expect(out.states['10x3']).toEqual(states['10x3']);
    expect(out.meta.unlockedUnitIds).toEqual(['u10', 'u2', 'u5']);
    expect(out.meta.sessionsCompleted).toBe(9);
  });
});
