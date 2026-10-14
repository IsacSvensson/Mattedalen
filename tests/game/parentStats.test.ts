import { describe, expect, it } from 'vitest';
import { emptyState } from '../../src/engine';
import { factStats, formatDay, minutesPerDay, topConfusions } from '../../src/shell/stats';
import type { SessionRecord, StoredAttempt } from '../../src/storage';

const session = (day: string, minutes: number): SessionRecord => ({
  id: day + minutes,
  profileId: 'p',
  packId: 'multiplication',
  mode: 'daily',
  day,
  startedAt: 0,
  endedAt: minutes * 60_000,
  answered: 10,
  correct: 9,
  introduced: [],
});

describe('parent statistics', () => {
  it('sums practised minutes per day, including empty days', () => {
    const days = minutesPerDay([session('2026-02-01', 12), session('2026-02-01', 5), session('2026-02-03', 10)], '2026-02-03', 4);
    expect(days).toEqual([
      { day: '2026-01-31', minutes: 0 },
      { day: '2026-02-01', minutes: 17 },
      { day: '2026-02-02', minutes: 0 },
      { day: '2026-02-03', minutes: 10 },
    ]);
  });

  it('lists the most common confusions first', () => {
    const states = {
      '7x8': { ...emptyState('7x8'), confusions: { '48': 4, '54': 1 } },
      '6x7': { ...emptyState('6x7'), confusions: { '48': 2 } },
    };
    const label = (id: string) => id.replace('x', ' × ');
    expect(topConfusions(states, 2, label)).toEqual([
      { itemId: '7x8', fact: '7 × 8', given: '48', count: 4 },
      { itemId: '6x7', fact: '6 × 7', given: '48', count: 2 },
    ]);
  });

  it('combines the recent log with summarised history', () => {
    const attempt = (correct: boolean, rtMs: number) => ({ itemId: '3x7', correct, rtMs }) as StoredAttempt;
    const stats = factStats(
      [attempt(true, 2000), attempt(false, 4000)],
      [{ profileId: 'p', packId: 'multiplication', day: '2026-01-01', itemId: '3x7', attempts: 2, correct: 2, totalRtMs: 6000 }],
    );
    expect(stats.get('3x7')).toEqual({ attempts: 4, correct: 3, meanRtMs: 3000 });
  });

  it('formats days in Swedish', () => {
    expect(formatDay('2026-10-03')).toBe('3 okt');
  });
});
