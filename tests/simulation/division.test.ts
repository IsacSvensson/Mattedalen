import { describe, expect, it } from 'vitest';
import { atLeast, createEngine, ManualClock, seededRng, type ItemId } from '../../src/engine';
import { createMultiplicationPack, isDivisionId, isGroupId, isShareId, parseDivisionId, parseFactId } from '../../src/content/multiplication';
import { AVERAGE, WEAK, SimulatedLearner, simulate, type LearnerProfile } from './learner';

/**
 * Delat med with simulated learners: a division is a little harder than its
 * multiplication and, when not recalled, is often worked out from it ("think
 * multiplication"), which is the derivation the pack gives it.
 */

const WEEKS = 26;

const hard = (n: number) => (n <= 2 || n === 5 || n === 10 ? 0 : n <= 4 ? 0.4 : 0.9);

function difficulty(id: ItemId): number {
  if (isShareId(id) || isGroupId(id)) return 0.2;
  if (isDivisionId(id)) {
    const { divisor, quotient } = parseDivisionId(id);
    return Math.min(1, Math.max(hard(divisor), hard(quotient)) + 0.25);
  }
  const { a, b } = parseFactId(id);
  return Math.max(hard(a), hard(b));
}

function run(profile: LearnerProfile, seed: number, division: boolean) {
  const clock = new ManualClock(0);
  const pack = createMultiplicationPack({ division });
  const engine = createEngine({ pack, clock, rng: seededRng(seed) });
  const learner = new SimulatedLearner(profile, seededRng(seed + 1000), difficulty, (id) => engine.item(id).pairId, (id) => engine.item(id).derivedFrom);
  const result = simulate(engine, learner, seededRng(seed + 2000), { days: WEEKS * 7 }, clock);
  return { pack, result };
}

const sits = (s: { status: Parameters<typeof atLeast>[0] } | undefined) => s !== undefined && atLeast(s.status, 'fluent');

describe('delat med, simulated over 26 weeks', () => {
  const runs = [1, 2].map((seed) => ({ seed, with: run(AVERAGE, seed, true), without: run(AVERAGE, seed, false) }));
  const weak = run(WEAK, 1, true);

  it('an average learner comes far with the divisions too, and stays near the target accuracy', () => {
    for (const r of runs) {
      const states = Object.values(r.with.result.states);
      const divisions = states.filter((s) => isDivisionId(s.itemId));
      const sitting = divisions.filter(sits).length;
      const accuracy = r.with.result.correctTotal / r.with.result.questionsTotal;
      console.log(`genomsnittlig seed ${r.seed}: delat med som sitter ${sitting}/100, gånger ${states.filter((s) => /^\d+x\d+$/.test(s.itemId) && sits(s)).length}/100, rätt ${(accuracy * 100).toFixed(0)} %`);
      expect(sitting).toBeGreaterThanOrEqual(40);
      expect(accuracy).toBeGreaterThan(0.75);
      expect(accuracy).toBeLessThan(0.95);
    }
  });

  it('never lets a division sit before both multiplications of its family did', () => {
    for (const r of runs) {
      for (const item of r.with.pack.items.filter((it) => isDivisionId(it.id))) {
        const s = r.with.result.states[item.id]!;
        if (s.status === 'new') continue;
        for (const req of item.requires!) expect(r.with.result.states[req]!.status, `${item.id} before ${req}`).not.toBe('new');
      }
    }
  });

  it('costs the multiplications some time, but not much', () => {
    for (const r of runs) {
      const mult = (states: Record<string, { itemId: string; status: Parameters<typeof atLeast>[0] }>) =>
        Object.values(states).filter((s) => /^\d+x\d+$/.test(s.itemId) && sits(s)).length;
      const withDiv = mult(r.with.result.states);
      const withoutDiv = mult(r.without.result.states);
      console.log(`genomsnittlig seed ${r.seed}: gånger som sitter efter 26 v, med delat med ${withDiv}, utan ${withoutDiv}`);
      expect(withDiv).toBeGreaterThanOrEqual(withoutDiv - 15);
    }
  });

  it('a weak learner still gets started on the divisions', () => {
    const divisions = Object.values(weak.result.states).filter((s) => isDivisionId(s.itemId));
    const started = divisions.filter((s) => s.status !== 'new').length;
    console.log(`svag: delat med påbörjade ${started}/100, sitter ${divisions.filter(sits).length}/100`);
    expect(started).toBeGreaterThan(10);
  });
});
