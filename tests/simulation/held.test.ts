import { describe, expect, it } from 'vitest';
import { atLeast, createEngine, ManualClock, seededRng, type ItemId } from '../../src/engine';
import { createMultiplicationPack, parseFactId } from '../../src/content/multiplication';
import { AVERAGE, SimulatedLearner, simulate } from './learner';

/**
 * Held units with simulated learners (docs/PLAN-HUNDRA.md): the later tables
 * wait for another place for a while. Sessions must go on as usual meanwhile
 * (review, no stalling, accuracy near the target), and the tables must open
 * as soon as they are released.
 */

const hard = (n: number) => (n <= 2 || n === 5 || n === 10 ? 0 : n <= 4 ? 0.4 : 0.9);
const difficulty = (id: ItemId) => {
  const { a, b } = parseFactId(id);
  return Math.max(hard(a), hard(b));
};

const WEEKS = 20;
const RELEASE_DAY = 6 * 7;
const LATER = ['u4', 'u3', 'usq', 'u9', 'u6', 'u78'];

function run(seed: number, held: (day: number) => string[]) {
  const clock = new ManualClock(0);
  const pack = createMultiplicationPack();
  const engine = createEngine({ pack, clock, rng: seededRng(seed) });
  const learner = new SimulatedLearner(AVERAGE, seededRng(seed + 1000), difficulty, (id) => engine.item(id).pairId, (id) => engine.item(id).derivedFrom);
  return simulate(engine, learner, seededRng(seed + 2000), { days: WEEKS * 7, held }, clock);
}

describe('held units, simulated', () => {
  const free = run(1, () => []);
  const heldSixWeeks = run(1, (day) => (day < RELEASE_DAY ? LATER : []));

  it('keeps sessions going while units are held: the same length, accuracy near the target', () => {
    const before = heldSixWeeks.days.filter((d) => d.day < RELEASE_DAY);
    expect(before.length).toBeGreaterThan(25);
    for (const d of before) expect(d.summary.answered).toBeGreaterThan(5);
    const answered = before.reduce((n, d) => n + d.summary.answered, 0);
    const correct = before.reduce((n, d) => n + d.summary.correct, 0);
    expect(correct / answered).toBeGreaterThan(0.75);
    expect(heldSixWeeks.maxSameInARow).toBeLessThanOrEqual(2);
  });

  it('never introduces a held table, and opens it when released', () => {
    const introducedBefore = heldSixWeeks.days.filter((d) => d.day < RELEASE_DAY).flatMap((d) => d.summary.introduced);
    const pack = createMultiplicationPack();
    const laterItems = new Set(pack.units.filter((u) => LATER.includes(u.id)).flatMap((u) => u.itemIds));
    expect(introducedBefore.some((id) => laterItems.has(id))).toBe(false);
    const introducedAfter = heldSixWeeks.days.filter((d) => d.day >= RELEASE_DAY).flatMap((d) => d.summary.introduced);
    expect(introducedAfter.some((id) => laterItems.has(id))).toBe(true);
  });

  it('costs some time, not the end result', () => {
    const sits = (r: typeof free) => Object.values(r.states).filter((s) => atLeast(s.status, 'fluent')).length;
    console.log(`fritt: ${sits(free)} av 100 sitter efter ${WEEKS} v; hållet 6 v: ${sits(heldSixWeeks)}`);
    expect(sits(heldSixWeeks)).toBeGreaterThan(sits(free) * 0.75);
  });
});
