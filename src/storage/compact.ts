import type { AttemptDaySummary, StoredAttempt } from './types';

/** Local calendar day of a timestamp. */
export function localDay(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function summaryKey(s: Pick<AttemptDaySummary, 'packId' | 'day' | 'itemId'>): string {
  return `${s.packId}|${s.day}|${s.itemId}`;
}

/**
 * Folds attempts into per-day, per-item summaries, merged into `existing`.
 * Confusion data is not lost: it already lives in each ItemState.
 */
export function summarizeAttempts(
  attempts: readonly StoredAttempt[],
  existing: readonly AttemptDaySummary[],
  dayOf: (ts: number) => string = localDay,
): AttemptDaySummary[] {
  const map = new Map(existing.map((s) => [summaryKey(s), { ...s }]));
  for (const a of attempts) {
    const day = dayOf(a.ts);
    const key = summaryKey({ packId: a.packId, day, itemId: a.itemId });
    let s = map.get(key);
    if (!s) {
      s = { profileId: a.profileId, packId: a.packId, day, itemId: a.itemId, attempts: 0, correct: 0, totalRtMs: 0 };
      map.set(key, s);
    }
    s.attempts++;
    if (a.correct) s.correct++;
    s.totalRtMs += a.rtMs;
  }
  return [...map.values()];
}
