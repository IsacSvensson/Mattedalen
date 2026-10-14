import { describe, expect, it } from 'vitest';
import { addDays, applyLeitner, applyStatus, DEFAULT_CONFIG, emptyState, isDue, type ItemState } from '../../src/engine';

const DAY0 = '2026-02-02';
const intervals = DEFAULT_CONFIG.leitner.intervalsDays;

function answer(s: ItemState, day: string, correct: boolean): ItemState {
  const next = applyStatus(s, { correct, given: correct ? 'a' : 'b', rtMs: 2000, format: 'choice', now: 0, today: day }, DEFAULT_CONFIG.status);
  return applyLeitner(s, next, correct, day, intervals);
}

describe('Leitner scheduling', () => {
  it('a new item starts in box 0, due the next day', () => {
    const s = answer(emptyState('x'), DAY0, true);
    expect(s.box).toBe(0);
    expect(s.dueDay).toBe(addDays(DAY0, 1));
    expect(isDue(s, DAY0)).toBe(false);
    expect(isDue(s, addDays(DAY0, 1))).toBe(true);
  });

  it('correct answers on due days walk through 1, 2, 4, 7, 14, 30 days', () => {
    let s = answer(emptyState('x'), DAY0, true);
    const gaps: number[] = [];
    let day = DAY0;
    for (let i = 0; i < 7; i++) {
      const due = s.dueDay as string;
      gaps.push(Math.round((Date.parse(due) - Date.parse(day)) / 86_400_000));
      day = due;
      s = answer(s, day, true);
    }
    expect(gaps).toEqual([1, 2, 4, 7, 14, 30, 30]);
    expect(s.box).toBe(intervals.length - 1);
  });

  it('answering before the due day does not stretch the interval', () => {
    let s = answer(emptyState('x'), DAY0, true);
    s = answer(s, addDays(DAY0, 1), true);
    const { box, dueDay } = s;
    s = answer(s, addDays(DAY0, 2), true);
    expect(s.box).toBe(box);
    expect(s.dueDay).toBe(dueDay);
  });

  it('a wrong answer sends the item back to box 0', () => {
    let s = answer(emptyState('x'), DAY0, true);
    for (let i = 0; i < 3; i++) s = answer(s, s.dueDay as string, true);
    expect(s.box).toBe(3);
    const day = addDays(s.dueDay as string, 2);
    s = answer(s, day, false);
    expect(s.box).toBe(0);
    expect(s.dueDay).toBe(addDays(day, 1));
    // Getting it right right after the correction does not move it up.
    s = answer(s, day, true);
    expect(s.box).toBe(0);
  });
});
