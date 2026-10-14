import { describe, expect, it } from 'vitest';
import { applyPlacement, createEngine, ManualClock, Placement, seededRng, type ItemId, type Question } from '../../src/engine';
import { createAdditionPack, isEqualityId } from '../../src/content/addition';
import { AVERAGE, STRONG, WEAK, SimulatedLearner, simulate, type LearnerProfile } from './learner';

/**
 * Simulated learners in Bäcken over 26 weeks (see learner.ts for the memory
 * model). The learner already knows zero, one more, ten and some, and small
 * sums from before (as most 7-year-olds do); the question is how soon the
 * start check gets them to the pairs that make ten and the bridge over ten.
 *
 * The model treats the equal sign tasks (Vågen) as facts to remember, which
 * is pessimistic for understanding; they get a lower difficulty here.
 */
const WEEKS = 26;
const DIFFICULTY: Record<string, number> = {
  noll: 0,
  ettmer: 0,
  tio: 0.1,
  sma: 0.2,
  tiokamrater: 0.3,
  dubblor: 0.3,
  vagen: 0.3,
  inom10: 0.5,
  naradubblor: 0.6,
  overtio: 0.9,
};
const KNOWN_BEFORE = new Set(['noll', 'ettmer', 'sma', 'tio']);

function run(profile: LearnerProfile, seed: number, startCheck: boolean) {
  const clock = new ManualClock(Date.UTC(2026, 0, 5, 15));
  const pack = createAdditionPack();
  const engine = createEngine({ pack, clock, rng: seededRng(seed) });
  const learner = new SimulatedLearner(
    profile,
    seededRng(seed + 1000),
    (id) => DIFFICULTY[engine.item(id).unitId] ?? 0.5,
    (id) => engine.item(id).pairId,
    (id) => engine.item(id).derivedFrom,
  );
  learner.prime(pack.items.filter((i) => KNOWN_BEFORE.has(i.unitId)).map((i) => i.id), 60);

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

  const firstIntroduced = (pred: (id: ItemId) => boolean) => result.days.find((d) => d.summary.introduced.some(pred))?.day ?? Infinity;
  let introduced = Object.values(initial?.states ?? {}).filter((s) => s.status !== 'new').length;
  const phase = [];
  for (const d of result.days) {
    if (introduced >= pack.items.length) break;
    phase.push(d);
    introduced += d.summary.introduced.length;
  }
  const answered = phase.reduce((s, d) => s + d.summary.answered, 0);
  const correct = phase.reduce((s, d) => s + d.summary.correct, 0);
  const bridge = pack.units.find((u) => u.id === 'overtio')!.itemIds;
  return {
    engine,
    result,
    checkQuestions,
    passed,
    firstBridgeDay: firstIntroduced((id) => engine.item(id).unitId === 'overtio'),
    firstEqualityDay: firstIntroduced(isEqualityId),
    allIntroducedDay: introduced >= pack.items.length ? (phase[phase.length - 1]?.day ?? 0) : Infinity,
    accuracy: correct / answered,
    bridgeKnown: bridge.filter((id) => ['fluent', 'automatic'].includes(result.states[id]!.status)).length,
    introducedBy: (day: number) => result.days.filter((d) => d.day < day).reduce((s, d) => s + d.summary.introduced.length, 0),
  };
}

const average = [1, 2].map((seed) => run(AVERAGE, seed, true));
const averageWithoutCheck = run(AVERAGE, 1, false);
const weak = run(WEAK, 1, true);
const strong = run(STRONG, 1, true);

describe('Bäcken: the start check gets a child to what is new (J4)', () => {
  it('marks what the child already knows in a few questions', () => {
    for (const r of average) {
      expect(r.passed.sort()).toEqual([...KNOWN_BEFORE].sort());
      expect(r.checkQuestions).toBeLessThanOrEqual(30);
    }
  });

  it('reaches the bridge over ten within three weeks, much sooner than without the check', () => {
    for (const r of average) expect(r.firstBridgeDay).toBeLessThanOrEqual(21);
    expect(averageWithoutCheck.firstBridgeDay).toBeGreaterThan(average[0]!.firstBridgeDay);
  });

  it('meets the equal sign in other forms early, and every fact within about two months', () => {
    for (const r of average) {
      expect(r.firstEqualityDay).toBeLessThanOrEqual(21);
      expect(r.allIntroducedDay).toBeLessThanOrEqual(9 * 7);
    }
  });
});

describe('Bäcken: pacing towards high success', () => {
  it('an average learner is right 78–92 % of the time while learning', () => {
    for (const r of [...average, averageWithoutCheck]) {
      expect(r.accuracy).toBeGreaterThanOrEqual(0.78);
      expect(r.accuracy).toBeLessThanOrEqual(0.92);
    }
  });

  it('an average learner knows the bridge over ten after six months', () => {
    for (const r of average) expect(r.bridgeKnown).toBeGreaterThanOrEqual(40);
  });

  it('a weak learner gets new facts more slowly, and a strong one faster', () => {
    expect(weak.introducedBy(8 * 7)).toBeLessThan(average[0]!.introducedBy(8 * 7));
    expect(strong.allIntroducedDay).toBeLessThan(average[0]!.allIntroducedDay);
  });

  it('a weak learner stays above 72 % (the reviews over ten are what is hard: see the plan)', () => {
    expect(weak.accuracy).toBeGreaterThanOrEqual(0.72);
  });
});

describe('Bäcken: session invariants over months of play', () => {
  const all = [...average, averageWithoutCheck, weak, strong];

  it('never asks the same item twice in a row and ends on time', () => {
    for (const { result } of all) {
      expect(result.maxSameInARow).toBe(1);
      expect(result.maxOverrunMs).toBeLessThanOrEqual(30_000);
    }
  });

  it('only introduces items of units whose prerequisites are known', () => {
    for (const { engine, result } of all) {
      for (const d of result.days) {
        for (const id of d.summary.introduced) expect(d.summary.meta.unlockedUnitIds).toContain(engine.item(id).unitId);
      }
    }
  });
});
