import { describe, expect, it } from 'vitest';
import { applyPlacement, createEngine, ManualClock, Placement, seededRng, type Question } from '../../src/engine';
import { createHundredPack } from '../../src/content/hundred';
import { AVERAGE, STRONG, WEAK, SimulatedLearner, simulate, type LearnerProfile } from './learner';

/**
 * Simulated learners on Stigen over 26 weeks (see learner.ts for the memory
 * model). The child comes from the brook: whole tens are close to facts it
 * knows (4 + 3 is 40 + 30). The model treats every task as a fact to
 * remember, also tens and ones, which is pessimistic for understanding.
 */
const WEEKS = 26;
const DIFFICULTY: Record<string, number> = {
  tiotal: 0.1,
  tiental: 0.2,
  hopptio: 0.3,
  ental: 0.3,
  tilltio: 0.4,
  dubbla: 0.6,
  overtio: 0.8,
  tvasiffr: 0.9,
};

function run(profile: LearnerProfile, seed: number, startCheck: boolean, knownBefore: string[] = []) {
  const clock = new ManualClock(Date.UTC(2026, 0, 5, 15));
  const pack = createHundredPack();
  const engine = createEngine({ pack, clock, rng: seededRng(seed) });
  const learner = new SimulatedLearner(
    profile,
    seededRng(seed + 1000),
    (id) => DIFFICULTY[engine.item(id).unitId] ?? 0.5,
    (id) => engine.item(id).pairId,
    (id) => engine.item(id).derivedFrom,
  );
  if (knownBefore.length) learner.prime(pack.items.filter((i) => knownBefore.includes(i.unitId)).map((i) => i.id), 60);

  let initial;
  let checkQuestions = 0;
  let passed: string[] = [];
  if (startCheck) {
    const placement = new Placement(pack, seededRng(seed + 7));
    for (let item = placement.next(); item; item = placement.next()) {
      const q: Question = { seq: ++checkQuestions, item, prompt: item.prompt, kind: 'placement', format: 'free', pairKnown: false };
      const { given, rtMs } = learner.answer(q, clock.now());
      clock.advance(rtMs + 1500);
      placement.submit(given, rtMs);
    }
    passed = placement.result().passedUnitIds;
    initial = applyPlacement(pack, engine.config, placement.result(), engine.initialStates(), engine.initialMeta(), clock.today());
  }
  const result = simulate(engine, learner, seededRng(seed + 2000), { days: WEEKS * 7, ...(initial ? { initial } : {}) }, clock);
  const firstIntroduced = (unitId: string) => result.days.find((d) => d.summary.introduced.some((id) => engine.item(id).unitId === unitId))?.day ?? Infinity;
  const sits = (unitId: string) => {
    const ids = pack.units.find((u) => u.id === unitId)!.itemIds;
    return ids.filter((id) => ['fluent', 'automatic'].includes(result.states[id]!.status)).length / ids.length;
  };
  const answered = result.days.reduce((s, d) => s + d.summary.answered, 0);
  const correct = result.days.reduce((s, d) => s + d.summary.correct, 0);
  return { result, passed, checkQuestions, firstIntroduced, sits, accuracy: correct / answered };
}

const average = [1, 2].map((seed) => run(AVERAGE, seed, false));
const weak = run(WEAK, 1, false);
const strong = run(STRONG, 1, false);
// A child who already knows the numbers to 100 well, up to the bridge over the ten.
const ahead = run(AVERAGE, 3, true, ['tiotal', 'tiental', 'hopptio', 'ental', 'tilltio']);

describe('Stigen: the pace over half a year', () => {
  it('an average child starts on the bridge over the ten within about ten weeks, and it sits after half a year', () => {
    for (const r of average) expect(r.firstIntroduced('overtio')).toBeLessThanOrEqual(11 * 7);
    // Over both seeds: two-digit numbers are only 12 tasks, so one seed swings by a fact or two.
    const mean = (part: string) => average.reduce((n, r) => n + r.sits(part), 0) / average.length;
    expect(mean('overtio')).toBeGreaterThanOrEqual(0.75);
    expect(mean('tvasiffr')).toBeGreaterThanOrEqual(0.75);
  });

  it('doubling and halving come early, beside the way to the bridge (the garden’s ×5 and ×4 wait for them)', () => {
    for (const r of average) {
      expect(r.firstIntroduced('dubbla')).toBeLessThanOrEqual(3 * 7);
      expect(r.sits('dubbla')).toBeGreaterThanOrEqual(0.8);
    }
  });

  it('is right most of the time while learning', () => {
    for (const r of [...average, strong]) {
      expect(r.accuracy).toBeGreaterThanOrEqual(0.78);
      expect(r.accuracy).toBeLessThanOrEqual(0.94);
    }
    expect(weak.accuracy).toBeGreaterThanOrEqual(0.7);
  });

  it('a weak child is slower, a strong one faster', () => {
    expect(weak.firstIntroduced('tilltio')).toBeGreaterThan(average[0]!.firstIntroduced('tilltio'));
    expect(strong.firstIntroduced('overtio')).toBeLessThan(average[0]!.firstIntroduced('overtio'));
  });

  it('the start check takes a child who already knows the numbers to 100 straight to the bridge', () => {
    // The model slips now and then (one off), so one part may be missed.
    expect(ahead.passed.filter((id) => ['tiotal', 'ental', 'tilltio', 'hopptio'].includes(id)).length).toBeGreaterThanOrEqual(3);
    expect(ahead.checkQuestions).toBeLessThanOrEqual(45);
    expect(ahead.firstIntroduced('overtio')).toBeLessThanOrEqual(14);
  });

  it('never asks the same task twice in a row and ends on time', () => {
    for (const { result } of [...average, weak, strong, ahead]) {
      expect(result.maxSameInARow).toBe(1);
      expect(result.maxOverrunMs).toBeLessThanOrEqual(30_000);
    }
  });
});
