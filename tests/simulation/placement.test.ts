import { describe, expect, it } from 'vitest';
import { applyPlacement, createEngine, ManualClock, Placement, seededRng, type ItemId, type Question } from '../../src/engine';
import { createMultiplicationPack, parseFactId } from '../../src/content/multiplication';
import { AVERAGE, SimulatedLearner, simulate } from './learner';

function difficulty(id: ItemId): number {
  const { a, b } = parseFactId(id);
  const hard = (n: number) => (n <= 2 || n === 5 || n === 10 ? 0 : n <= 4 ? 0.4 : 0.9);
  return Math.max(hard(a), hard(b));
}

const START = Date.UTC(2026, 0, 5, 15);

/** An average learner who already practised ×10, ×2, ×5 and ×1 before getting the app. */
function setup(seed: number, prime: boolean) {
  const clock = new ManualClock(START);
  const pack = createMultiplicationPack();
  const engine = createEngine({ pack, clock, rng: seededRng(seed) });
  const learner = new SimulatedLearner(AVERAGE, seededRng(seed + 1000), difficulty, (id) => engine.item(id).pairId, (id) => engine.item(id).derivedFrom);
  const easyUnits = ['u10', 'u2', 'u5', 'u1'];
  if (prime) learner.prime(pack.units.filter((u) => easyUnits.includes(u.id)).flatMap((u) => u.itemIds));
  return { clock, pack, engine, learner };
}

function place(seed: number) {
  const { clock, pack, engine, learner } = setup(seed, true);
  const placement = new Placement(pack, seededRng(seed + 7));
  let seq = 0;
  for (let item = placement.next(); item; item = placement.next()) {
    const q: Question = { seq: ++seq, item, kind: 'placement', format: 'free', pairKnown: false };
    const { given, rtMs } = learner.answer(q, clock.now());
    clock.advance(rtMs + 1500);
    placement.submit(given, rtMs);
  }
  const placed = applyPlacement(pack, engine.config, placement.result(), engine.initialStates(), engine.initialMeta(), clock.today());
  return { clock, engine, learner, result: placement.result(), placed, asked: seq };
}

describe('placement with simulated learners', () => {
  const SEEDS = [1, 2, 4];

  it('places most learners who know the easy tables at ×4, after a short check', () => {
    const runs = [1, 2, 3, 4, 5, 6, 7, 8].map(place);
    const atFour = runs.filter((r) => r.result.stoppedAt === 'u4').length;
    console.log('stopped at', runs.map((r) => r.result.stoppedAt).join(' '), 'asked', runs.map((r) => r.asked).join(' '));
    expect(atFour).toBeGreaterThanOrEqual(6);
    for (const r of runs) {
      // Never placed beyond what they know, and always past the first unit.
      expect(r.result.passedUnitIds.length).toBeGreaterThanOrEqual(1);
      expect(r.result.passedUnitIds.length).toBeLessThanOrEqual(4);
      expect(r.asked).toBeLessThanOrEqual(24);
    }
  });

  it.each(SEEDS)('seed %i: after placement, practice stays in the target band and moves on quickly', (seed) => {
    const { clock, engine, learner, placed } = place(seed);
    clock.set(START + 86_400_000);
    const res = simulate(engine, learner, seededRng(seed + 2000), { days: 42, startMs: START + 86_400_000, initial: placed }, clock);
    const accuracy = res.correctTotal / res.questionsTotal;
    expect(accuracy).toBeGreaterThanOrEqual(0.8);
    expect(accuracy).toBeLessThanOrEqual(0.93);
    // Six weeks in, well past where a learner without placement would be.
    expect(res.meta.unlockedUnitIds.length).toBeGreaterThanOrEqual(8);

    // Without the check, the same learner spends the first weeks on what they already know.
    const plain = setup(seed, true);
    const resPlain = simulate(plain.engine, plain.learner, seededRng(seed + 2000), { days: 14, startMs: START + 86_400_000 }, plain.clock);
    const firstTwoWeeks = res.days.filter((d) => d.day < 14);
    const acc = (days: typeof res.days) => days.reduce((s, d) => s + d.summary.correct, 0) / days.reduce((s, d) => s + d.summary.answered, 0);
    expect(acc(resPlain.days)).toBeGreaterThan(acc(firstTwoWeeks));
  });
});
