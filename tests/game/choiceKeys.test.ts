import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHOICE_WAIT_MS, choiceKeys } from '../../src/shell/components/choiceKeys';

const key = (k: string) => ({ key: k, preventDefault: vi.fn() });

describe('the keys of a multiple choice', () => {
  afterEach(() => vi.useRealTimers());

  it('types a number answer: 3 is the answer 3, not the third choice', () => {
    const chosen: number[] = [];
    const keys = choiceKeys(['12', '3', '21', '7'], (i) => chosen.push(i));
    keys.onKey(key('3'));
    expect(chosen).toEqual([1]);
  });

  it('takes two digits for a two-digit answer, and starts over on a digit that fits nothing', () => {
    const chosen: number[] = [];
    const keys = choiceKeys(['42', '24', '36', '18'], (i) => chosen.push(i));
    keys.onKey(key('2'));
    expect(chosen).toEqual([]);
    keys.onKey(key('4'));
    expect(chosen).toEqual([1]);
    const again = choiceKeys(['42', '24', '36', '18'], (i) => chosen.push(i));
    // 5 fits no choice; then 3 and 6.
    again.onKey(key('5'));
    again.onKey(key('3'));
    again.onKey(key('6'));
    expect(chosen).toEqual([1, 2]);
  });

  it('waits a moment when the number begins a longer choice, or takes it at once on Enter', () => {
    vi.useFakeTimers();
    const chosen: number[] = [];
    const keys = choiceKeys(['2', '24', '20', '4'], (i) => chosen.push(i));
    keys.onKey(key('2'));
    expect(chosen).toEqual([]);
    vi.advanceTimersByTime(CHOICE_WAIT_MS);
    expect(chosen).toEqual([0]);
    const enter = choiceKeys(['2', '24', '20', '4'], (i) => chosen.push(i));
    enter.onKey(key('2'));
    const e = key('Enter');
    enter.onKey(e);
    expect(chosen).toEqual([0, 0]);
    expect(e.preventDefault).toHaveBeenCalled();
    // Chosen once only: the waiting timer does nothing more.
    vi.advanceTimersByTime(CHOICE_WAIT_MS);
    expect(chosen).toEqual([0, 0]);
  });

  it('keeps 1, 2, 3 … as shortcuts when the choices are not numbers', () => {
    const chosen: number[] = [];
    const keys = choiceKeys(['ja', 'nej'], (i) => chosen.push(i));
    expect(keys.numeric).toBe(false);
    keys.onKey(key('3'));
    keys.onKey(key('2'));
    expect(chosen).toEqual([1]);
  });
});
