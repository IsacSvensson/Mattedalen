import { describe, expect, it } from 'vitest';
import { addDays, diffDays, ManualClock, randInt, seededRng, shuffle, weightedPick } from '../../src/engine';

describe('day arithmetic', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('measures whole days between keys', () => {
    expect(diffDays('2026-01-01', '2026-01-31')).toBe(30);
    expect(diffDays('2026-01-31', '2026-01-01')).toBe(-30);
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2);
  });

  it('manual clock maps time to UTC days', () => {
    const clock = new ManualClock(Date.UTC(2026, 4, 17, 23, 59));
    expect(clock.today()).toBe('2026-05-17');
    clock.advance(60_000);
    expect(clock.today()).toBe('2026-05-18');
  });
});

describe('seeded randomness', () => {
  it('is deterministic and in [0, 1)', () => {
    const a = seededRng(42);
    const b = seededRng(42);
    for (let i = 0; i < 1000; i++) {
      const x = a.next();
      expect(x).toBe(b.next());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('shuffle returns a permutation', () => {
    const rng = seededRng(1);
    const list = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(rng, list);
    expect(out.slice().sort()).toEqual(list);
    expect(list).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('weightedPick follows the weights', () => {
    const rng = seededRng(7);
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 10_000; i++) counts[weightedPick(rng, ['a', 'b', 'c'] as const, (x) => (x === 'a' ? 6 : x === 'b' ? 3 : 1))!]++;
    expect(counts.a / 10_000).toBeCloseTo(0.6, 1);
    expect(counts.b / 10_000).toBeCloseTo(0.3, 1);
    expect(counts.c / 10_000).toBeCloseTo(0.1, 1);
  });

  it('randInt stays in range', () => {
    const rng = seededRng(3);
    for (let i = 0; i < 1000; i++) expect(randInt(rng, 5)).toBeLessThan(5);
  });
});
