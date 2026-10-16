import { describe, expect, it } from 'vitest';
import { addDays, applyLeitner, applyStatus, DEFAULT_CONFIG, emptyState, type ItemState } from '../../src/engine';
import { stageFor, type Stage } from '../../src/shell/components/plant';
import { heatClass } from '../../src/shell/components/heatmap';
import { levelOf, stateFromLevel } from '../../src/storage';

/**
 * The plant's steps (docs/TRADGARDEN.md, Växternas steg): every answer goes
 * through the engine's own status and Leitner rules, as in a session.
 */
const cfg = DEFAULT_CONFIG;
const DAY0 = '2026-02-02';

function answer(s: ItemState, day: number, correct: boolean, rtMs = 2000, format: 'choice' | 'free' = 'free'): ItemState {
  const today = addDays(DAY0, day);
  const next = applyStatus(s, { correct, given: correct ? 'ok' : 'fel', rtMs, format, now: day * 86_400_000, today }, cfg.status);
  return applyLeitner(s, next, correct, today, cfg.leitner.intervalsDays);
}

const stage = (s: ItemState): Stage => stageFor(s, true);

/** Answered right on every due day from `from` until the item reaches `status`. */
function growTo(s: ItemState, status: ItemState['status'], from: number): { s: ItemState; day: number } {
  let day = from;
  while (s.status !== status && day < from + 200) {
    if (s.dueDay === null || s.dueDay <= addDays(DAY0, day)) s = answer(s, day, true);
    day++;
  }
  expect(s.status).toBe(status);
  return { s, day };
}

describe('the plant takes one step at a time', () => {
  it('grows seed → sprout → bush → tree', () => {
    let s = answer(emptyState('7x8'), 0, true, 8000);
    expect(stage(s)).toBe('seed');
    s = answer(s, 1, true);
    expect(stage(s)).toBe('sprout');
    ({ s } = growTo(s, 'fluent', 2));
    expect(stage(s)).toBe('bush');
    ({ s } = growTo(s, 'automatic', 3));
    expect(stage(s)).toBe('tree');
  });

  it('falls one step on a wrong answer: tree → bush → sprout, and never back to a seed once it has been a bush', () => {
    let s = answer(emptyState('7x8'), 0, true, 8000);
    s = answer(s, 1, true);
    let day: number;
    ({ s, day } = growTo(s, 'automatic', 2));
    s = answer(s, day, false);
    expect(stage(s)).toBe('bush');
    s = answer(s, day + 1, false);
    // Before: a bush became a seed here, two steps in one.
    expect(stage(s)).toBe('sprout');
    expect(s.box).toBe(0);
    // Wrong again: it stays a sprout; what has been learnt once is not wiped out.
    s = answer(s, day + 2, false);
    expect(stage(s)).toBe('sprout');
  });

  it('a sprout that has never been a bush falls back to a seed', () => {
    let s = answer(emptyState('7x8'), 0, true, 8000);
    s = answer(s, 1, true);
    expect(stage(s)).toBe('sprout');
    s = answer(s, 2, false);
    expect(stage(s)).toBe('seed');
  });

  it('shows the same in the parent view and keeps it through a QR code, also for states saved before the rule', () => {
    let s = answer(emptyState('7x8'), 0, true, 8000);
    s = answer(s, 1, true);
    let day: number;
    ({ s, day } = growTo(s, 'fluent', 2));
    s = answer(s, day, false);
    expect(heatClass(s)).toBe('heat-learning-1');
    expect(stage(stateFromLevel('7x8', levelOf(s), DAY0, cfg.leitner.intervalsDays))).toBe('sprout');
    // Saved before `peak` existed: a drop from fluent says the same.
    const { peak: _peak, ...older } = s;
    expect(stage(older)).toBe('sprout');
    expect(stage({ ...older, drops: 0 })).toBe('seed');
  });
});
