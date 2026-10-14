import { describe, expect, it } from 'vitest';
import { createEngine, ManualClock, seededRng, sortedUnits, type ItemId } from '../../src/engine';
import { createMultiplicationPack, parseFactId } from '../../src/content/multiplication';
import { AVERAGE, STRONG, WEAK, SimulatedLearner, simulate, type LearnerProfile, type SimulationResult } from './learner';

/**
 * Simulated learners practising daily (about 6 days a week) for 26 weeks.
 * The "learning phase" is from the first session until every fact has been
 * introduced; after that sessions are pure consolidation and naturally get
 * easier.
 */

const WEEKS = 26;

/** Facts with 6–9 are hardest, ×1/×2/×5/×10 easiest (Math Garden data). */
function difficulty(id: ItemId): number {
  const { a, b } = parseFactId(id);
  const hard = (n: number) => (n <= 2 || n === 5 || n === 10 ? 0 : n <= 4 ? 0.4 : 0.9);
  return Math.max(hard(a), hard(b));
}

function run(profile: LearnerProfile, seed: number) {
  const clock = new ManualClock(0);
  const pack = createMultiplicationPack();
  const engine = createEngine({ pack, clock, rng: seededRng(seed) });
  const learner = new SimulatedLearner(
    profile,
    seededRng(seed + 1000),
    difficulty,
    (id) => engine.item(id).pairId,
    (id) => engine.item(id).derivedFrom,
  );
  const result = simulate(engine, learner, seededRng(seed + 2000), { days: WEEKS * 7 }, clock);
  return { engine, result };
}

function learningPhase(res: SimulationResult) {
  const phase = [];
  let introduced = 0;
  for (const d of res.days) {
    if (introduced >= 100) break;
    phase.push(d);
    introduced += d.summary.introduced.length;
  }
  const answered = phase.reduce((s, d) => s + d.summary.answered, 0);
  const correct = phase.reduce((s, d) => s + d.summary.correct, 0);
  const accs = phase.map((d) => d.summary.accuracy ?? 0);
  return {
    sessions: phase.length,
    lastDay: phase[phase.length - 1]?.day ?? 0,
    allIntroduced: introduced >= 100,
    accuracy: correct / answered,
    share: (lo: number, hi: number) => accs.filter((a) => a >= lo && a <= hi).length / accs.length,
  };
}

const SEEDS = [1, 2, 3, 4];
const average = SEEDS.map((seed) => run(AVERAGE, seed));
const weak = [1, 2].map((seed) => run(WEAK, seed));
const strong = [1, 2].map((seed) => run(STRONG, seed));

describe('simulated average learner', () => {
  it.each(SEEDS.map((s, i) => [s, i]))('seed %i: 80–90 % correct while learning', (_seed, i) => {
    const phase = learningPhase(average[i]!.result);
    expect(phase.accuracy).toBeGreaterThanOrEqual(0.8);
    expect(phase.accuracy).toBeLessThanOrEqual(0.9);
    // Most single sessions are in or near the band.
    expect(phase.share(0.8, 0.9)).toBeGreaterThanOrEqual(0.5);
    expect(phase.share(0.75, 0.95)).toBeGreaterThanOrEqual(0.85);
  });

  it.each(SEEDS.map((s, i) => [s, i]))('seed %i: realistic timeline (whole table in ~3–6 months)', (_seed, i) => {
    const { engine, result } = average[i]!;
    const phase = learningPhase(result);
    expect(phase.allIntroduced).toBe(true);
    // All facts met within 5–20 weeks …
    expect(phase.lastDay).toBeGreaterThanOrEqual(5 * 7);
    expect(phase.lastDay).toBeLessThanOrEqual(20 * 7);
    // … and most automatic after six months.
    expect(engine.statusCounts(result.states).automatic).toBeGreaterThanOrEqual(80);
    expect(result.meta.unlockedUnitIds).toHaveLength(10);
  });
});

describe('simulated weak and strong learners', () => {
  it('a weak learner is protected from too many errors', () => {
    for (const { result } of weak) {
      const phase = learningPhase(result);
      expect(phase.accuracy).toBeGreaterThanOrEqual(0.78);
      expect(phase.share(0.7, 0.95)).toBeGreaterThanOrEqual(0.85);
    }
  });

  it('a weak learner gets new facts more slowly than an average one', () => {
    const introduced = (r: SimulationResult, days: number) =>
      r.days.filter((d) => d.day < days).reduce((s, d) => s + d.summary.introduced.length, 0);
    for (const { result } of weak) {
      for (const avg of average) expect(introduced(result, 56)).toBeLessThan(introduced(avg.result, 56));
    }
  });

  it('a strong learner moves through the table faster than an average one', () => {
    for (const { result } of strong) {
      const phase = learningPhase(result);
      for (const avg of average) expect(phase.lastDay).toBeLessThan(learningPhase(avg.result).lastDay);
    }
  });
});

describe('session invariants over months of simulated play', () => {
  const all = [...average, ...weak, ...strong];

  it('never asks the same fact twice in a row', () => {
    for (const { result } of all) expect(result.maxSameInARow).toBe(1);
  });

  it('ends sessions on time (at most the last question runs over)', () => {
    for (const { result } of all) expect(result.maxOverrunMs).toBeLessThanOrEqual(30_000);
  });

  it('respects the new-item limit and the unit order', () => {
    for (const { engine, result } of all) {
      const order = sortedUnits(engine.pack.units).map((u) => u.id);
      for (const d of result.days) {
        expect(d.summary.introduced.length).toBeLessThanOrEqual(engine.config.pacing.maxNewPerSession);
        expect(d.summary.meta.unlockedUnitIds).toEqual(order.slice(0, d.summary.meta.unlockedUnitIds.length));
        for (const id of d.summary.introduced) {
          expect(d.summary.meta.unlockedUnitIds).toContain(engine.item(id).unitId);
        }
      }
    }
  });

  it('is reproducible with the same seeds', { timeout: 60_000 }, () => {
    const again = run(AVERAGE, SEEDS[0]!).result;
    expect(again.correctTotal).toBe(average[0]!.result.correctTotal);
    expect(again.questionsTotal).toBe(average[0]!.result.questionsTotal);
  });
});
