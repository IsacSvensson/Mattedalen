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
  /** Answers on its own: not reached in steps on the räknestig. */
  attempts: number;
  correct: number;
  meanRtMs: number | null;
  /** Right answers reached in steps on the räknestig (with support), counted apart. */
  supported: number;
}

/**
 * Attempts per fact from both the recent log and the summarised history. An
 * answer reached on the räknestig is support, not the child's own recall, so it
 * is counted apart (the summarised history does not tell them apart).
 */
export function factStats(attempts: readonly StoredAttempt[], summaries: readonly AttemptDaySummary[]): Map<ItemId, FactStats> {
  const acc = new Map<ItemId, { attempts: number; correct: number; rt: number; supported: number }>();
  const get = (id: ItemId) => acc.get(id) ?? (acc.set(id, { attempts: 0, correct: 0, rt: 0, supported: 0 }), acc.get(id)!);
  const add = (id: ItemId, n: number, c: number, rt: number) => {
    const s = get(id);
    s.attempts += n;
    s.correct += c;
    s.rt += rt;
  };
  for (const a of attempts) {
    if (a.kind === 'derive') {
      if (a.correct) get(a.itemId).supported++;
    } else add(a.itemId, 1, a.correct ? 1 : 0, a.rtMs);
  }
  for (const s of summaries) add(s.itemId, s.attempts, s.correct, s.totalRtMs);
  return new Map(
    [...acc].map(([id, s]) => [id, { attempts: s.attempts, correct: s.correct, meanRtMs: s.attempts ? s.rt / s.attempts : null, supported: s.supported }]),
  );
}

/** "12 försök, 75 % rätt · snitt 3.1 s · 2 gånger via räknestigen", for the details of a fact. */
export function factStatsText(st: FactStats | undefined): string[] {
  if (!st) return [];
  const parts: string[] = [];
  if (st.attempts) {
    parts.push(`${st.attempts} försök, ${Math.round((st.correct / st.attempts) * 100)} % rätt`);
    if (st.meanRtMs) parts.push(`snitt ${(st.meanRtMs / 1000).toFixed(1)} s`);
  }
  if (st.supported) parts.push(`${st.supported === 1 ? 'en gång' : `${st.supported} gånger`} via räknestigen`);
  return parts;
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
