import { addDays } from './clock';
import type { DayKey, ItemState } from './types';

export function isDue(state: ItemState, today: DayKey): boolean {
  return state.status !== 'new' && state.dueDay !== null && state.dueDay <= today;
}

/**
 * Leitner-style spacing. A correct answer on an item that is due moves it up
 * one box; answering it again before it is due does not (that is massed
 * practice, which should not stretch the interval). A wrong answer sends it
 * back to the first box. Newly introduced items start in box 0.
 */
export function applyLeitner(
  prev: ItemState,
  next: ItemState,
  correct: boolean,
  today: DayKey,
  intervalsDays: number[],
): ItemState {
  const last = intervalsDays.length - 1;
  const firstInterval = intervalsDays[0] ?? 1;

  if (prev.status === 'new') {
    return { ...next, box: 0, dueDay: addDays(today, firstInterval) };
  }
  if (!correct) {
    return { ...next, box: 0, dueDay: addDays(today, firstInterval) };
  }
  const wrongToday = prev.lastWrongDay === today;
  if (isDue(prev, today) && !wrongToday) {
    const box = Math.min(prev.box + 1, last);
    return { ...next, box, dueDay: addDays(today, intervalsDays[box] ?? firstInterval) };
  }
  return next;
}
