import { addDays, type DayKey, type ItemId, type ItemState } from '../engine';
import type { AttemptDaySummary, SessionRecord, StoredAttempt } from '../storage';

export interface DayMinutes {
  day: DayKey;
  minutes: number;
}

/** Practised minutes per day for the last `days` days (oldest first). */
export function minutesPerDay(sessions: readonly SessionRecord[], today: DayKey, days = 14): DayMinutes[] {
  const byDay = new Map<DayKey, number>();
  for (const s of sessions) byDay.set(s.day, (byDay.get(s.day) ?? 0) + Math.max(0, s.endedAt - s.startedAt) / 60_000);
  const out: DayMinutes[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    out.push({ day, minutes: Math.round(byDay.get(day) ?? 0) });
  }
  return out;
}

export interface Confusion {
  itemId: ItemId;
  fact: string;
  given: string;
  count: number;
}

/** The most frequent wrong answers across all facts; `label` writes a fact as the place shows it. */
export function topConfusions(states: Record<ItemId, ItemState>, limit = 8, label: (id: ItemId) => string = (id) => id): Confusion[] {
  const all: Confusion[] = [];
  for (const s of Object.values(states)) {
    for (const [given, count] of Object.entries(s.confusions)) all.push({ itemId: s.itemId, fact: label(s.itemId), given, count });
  }
  return all.sort((x, y) => y.count - x.count || x.fact.localeCompare(y.fact)).slice(0, limit);
}

export interface FactStats {
  attempts: number;
  correct: number;
  meanRtMs: number | null;
}

/** Attempts per fact from both the recent log and the summarised history. */
export function factStats(attempts: readonly StoredAttempt[], summaries: readonly AttemptDaySummary[]): Map<ItemId, FactStats> {
  const acc = new Map<ItemId, { attempts: number; correct: number; rt: number }>();
  const add = (id: ItemId, n: number, c: number, rt: number) => {
    const s = acc.get(id) ?? { attempts: 0, correct: 0, rt: 0 };
    s.attempts += n;
    s.correct += c;
    s.rt += rt;
    acc.set(id, s);
  };
  for (const a of attempts) add(a.itemId, 1, a.correct ? 1 : 0, a.rtMs);
  for (const s of summaries) add(s.itemId, s.attempts, s.correct, s.totalRtMs);
  return new Map([...acc].map(([id, s]) => [id, { attempts: s.attempts, correct: s.correct, meanRtMs: s.attempts ? s.rt / s.attempts : null }]));
}

export const STATUS_TEXT: Record<ItemState['status'], string> = {
  new: 'inte påbörjad',
  learning: 'övas',
  fluent: 'flytande',
  automatic: 'automatiserad',
};

export function formatDay(day: DayKey): string {
  const [, m, d] = day.split('-').map(Number) as [number, number, number];
  const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  return `${d} ${months[m - 1]}`;
}
