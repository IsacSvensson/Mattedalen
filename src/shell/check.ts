import type { DayKey } from '../engine';
import type { SessionRecord } from '../storage';

/**
 * When a place's koll comes (Bäckens koll, Trädgårdens koll): about every
 * seventh day the child plays at the place, and the first time on the second
 * play day, as a baseline soon after the start. It comes before the day's
 * session and can wait until tomorrow.
 */
export const CHECK_EVERY_PLAY_DAYS = 7;

export function checkDue(sessions: readonly SessionRecord[], packId: string, today: DayKey, postponedDay?: DayKey): boolean {
  if (postponedDay === today) return false;
  const mine = sessions.filter((s) => s.packId === packId);
  const last = mine
    .filter((s) => s.mode === 'check')
    .map((s) => s.day)
    .sort()
    .at(-1);
  if (last === today) return false;
  // Earlier days with a session at the brook, since the last check.
  const playDays = new Set(mine.filter((s) => s.mode === 'daily' && s.answered > 0 && s.day < today && (!last || s.day > last)).map((s) => s.day));
  return playDays.size >= (last ? CHECK_EVERY_PLAY_DAYS - 1 : 1);
}
