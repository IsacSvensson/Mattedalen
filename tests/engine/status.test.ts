import { describe, expect, it } from 'vitest';
import { addDays, applyStatus, DEFAULT_CONFIG, emptyState, makeConfig, type AnswerFormat, type ItemState } from '../../src/engine';

const cfg = DEFAULT_CONFIG.status;
const DAY0 = '2026-02-02';

function answer(s: ItemState, day: number, correct: boolean, rtMs: number, format: AnswerFormat = 'choice', c = cfg) {
  return applyStatus(s, { correct, given: correct ? 'ok' : 'wrong', rtMs, format, now: day * 86_400_000, today: addDays(DAY0, day) }, c);
}

/** Introduced on day 0. */
function introduced(): ItemState {
  return answer(emptyState('x'), 0, true, 8000);
}

describe('status rules', () => {
  it('an introduced item becomes learning, and the intro day is not evidence', () => {
    const s = introduced();
    expect(s.status).toBe('learning');
    expect(s.introducedDay).toBe(DAY0);
    expect(Object.keys(s.dayBest)).toHaveLength(0);
    // Fast answers on the intro day still do not count.
    expect(Object.keys(answer(s, 0, true, 1000).dayBest)).toHaveLength(0);
  });

  it('fluent = correct under 5 s on 2 different days', () => {
    let s = introduced();
    s = answer(s, 1, true, 4000);
    expect(s.status).toBe('learning');
    s = answer(s, 2, true, 4900);
    expect(s.status).toBe('fluent');
  });

  it('two fast answers on the same day count as one day', () => {
    let s = introduced();
    s = answer(s, 1, true, 2000);
    s = answer(s, 1, true, 2000);
    expect(s.status).toBe('learning');
  });

  it('slow correct answers are not evidence', () => {
    let s = introduced();
    s = answer(s, 1, true, 4000);
    s = answer(s, 2, true, 5000);
    expect(s.status).toBe('learning');
  });

  it('automatic = free answer under 3 s on 3 different days', () => {
    let s = introduced();
    s = answer(s, 1, true, 2500, 'free');
    s = answer(s, 2, true, 2500, 'free');
    expect(s.status).toBe('fluent');
    s = answer(s, 3, true, 2500, 'free');
    expect(s.status).toBe('automatic');
  });

  it('fast multiple choice alone never makes an item automatic', () => {
    let s = introduced();
    for (let d = 1; d <= 6; d++) s = answer(s, d, true, 1500, 'choice');
    expect(s.status).toBe('fluent');
  });

  it('a wrong answer moves the item down exactly one step', () => {
    let s = introduced();
    for (let d = 1; d <= 3; d++) s = answer(s, d, true, 2000, 'free');
    expect(s.status).toBe('automatic');
    s = answer(s, 4, false, 3000, 'free');
    expect(s.status).toBe('fluent');
    s = answer(s, 5, false, 3000, 'free');
    expect(s.status).toBe('learning');
    s = answer(s, 6, false, 3000, 'free');
    expect(s.status).toBe('learning');
    expect(s.lapses).toBe(3);
  });

  it('after a lapse the level must be shown again on a new day', () => {
    let s = introduced();
    s = answer(s, 1, true, 2000);
    s = answer(s, 2, true, 2000);
    expect(s.status).toBe('fluent');
    s = answer(s, 3, false, 2000);
    expect(s.status).toBe('learning');
    // Correct again the same day: does not count (the answer was just shown).
    s = answer(s, 3, true, 1500);
    expect(s.status).toBe('learning');
    s = answer(s, 4, true, 1500);
    expect(s.status).toBe('fluent');
  });

  it('records which wrong answers were given', () => {
    let s = introduced();
    s = applyStatus(s, { correct: false, given: '48', rtMs: 3000, format: 'choice', now: 0, today: addDays(DAY0, 1) }, cfg);
    s = applyStatus(s, { correct: false, given: '48', rtMs: 3000, format: 'choice', now: 0, today: addDays(DAY0, 2) }, cfg);
    s = applyStatus(s, { correct: false, given: '54', rtMs: 3000, format: 'choice', now: 0, today: addDays(DAY0, 2) }, cfg);
    expect(s.confusions).toEqual({ '48': 2, '54': 1 });
  });

  it('thresholds are configurable', () => {
    const strict = makeConfig({ status: { fluentDays: 3, fluentRtMs: 3000 } }).status;
    let s = introduced();
    s = answer(s, 1, true, 2500, 'choice', strict);
    s = answer(s, 2, true, 2500, 'choice', strict);
    expect(s.status).toBe('learning');
    s = answer(s, 3, true, 2500, 'choice', strict);
    expect(s.status).toBe('fluent');
  });

  it('keeps only recent evidence', () => {
    let s = introduced();
    s = answer(s, 1, true, 2000);
    s = answer(s, 31, true, 2000);
    expect(Object.keys(s.dayBest)).toEqual([addDays(DAY0, 31)]);
    expect(s.status).toBe('learning');
  });
});
