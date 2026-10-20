import { addDays, atLeast, evidenceDays, type ContentPack, type DayKey, type Engine, type ItemId, type ItemState } from '../engine';
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
export function topConfusions(
  states: Record<ItemId, ItemState>,
  limit = 8,
  label: (id: ItemId) => string = (id) => id,
  keep: (given: string) => boolean = () => true,
): Confusion[] {
  const all: Confusion[] = [];
  for (const s of Object.values(states)) {
    for (const [given, count] of Object.entries(s.confusions)) if (keep(given)) all.push({ itemId: s.itemId, fact: label(s.itemId), given, count });
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

/** "mån", "tis" … for a day, as under the bars of the last seven days. */
export function weekdayShort(day: DayKey): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()]!;
}

export function formatDay(day: DayKey): string {
  const [, m, d] = day.split('-').map(Number) as [number, number, number];
  const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  return `${d} ${months[m - 1]}`;
}

/**
 * What the child is on in a place, for grown-ups: the first open part (in the
 * pack's order) where less than about 80 % sits, or the last open part.
 */
export function partNow(pack: ContentPack, states: Record<ItemId, ItemState>, open: ReadonlySet<string>): string | null {
  const parts = [...pack.units].sort((a, b) => a.order - b.order).filter((u) => open.has(u.id));
  const sits = (id: ItemId) => atLeast(states[id]?.status ?? 'new', 'fluent');
  const now = parts.find((u) => u.itemIds.filter(sits).length < 0.8 * u.itemIds.length) ?? parts.at(-1);
  return now?.title ?? null;
}

/**
 * Facts the child answers right but slowly (docs/PLAN-GRANSKNING.md, S2): right
 * without help on enough days to be a bush, but not under the time limit. They
 * stay sprouts; a grown-up can give the child more time.
 */
export function slowButRight(engine: Engine, states: Record<ItemId, ItemState>): number {
  const units = new Map(engine.pack.units.map((u) => [u.id, u.status]));
  return engine.pack.items.filter((it) => {
    const s = states[it.id];
    if (s?.status !== 'learning') return false;
    const rules = { ...engine.config.status, ...units.get(it.unitId) };
    return (
      evidenceDays(s, Number.MAX_SAFE_INTEGER, rules.fluentFormats) >= rules.fluentDays &&
      evidenceDays(s, rules.fluentRtMs, rules.fluentFormats) < rules.fluentDays
    );
  }).length;
}

/** Each fact's best time on the days that count as evidence, fastest first. */
export function bestTimes(states: Record<ItemId, ItemState>): number[] {
  return Object.values(states)
    .map((s) => Math.min(...Object.values(s.dayBest).flatMap((ev) => Object.values(ev).filter((x): x is number => typeof x === 'number'))))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}

/** The child's quickest facts tell how fast it is in itself: the tenth quickest. */
export const QUICK_FACTS = 10;
/**
 * A child is slow in itself when even its tenth quickest fact takes this long.
 * Simulated over a year: strong 1.4–1.8 s, average 1.9–2.4 s, weak 2.8–3.4 s,
 * slow 4.0–4.5 s (docs/PLAN-GRANSKNING.md, S2).
 */
export const SLOW_QUICK_MS = 3700;

/**
 * The facts more time would help with, over the child's places: the facts right
 * but slow (`slowButRight`), when the child is slow in itself: even its tenth
 * quickest fact, at any place, takes `SLOW_QUICK_MS`. A child who has trouble
 * remembering still answers its easiest facts quickly; for it more time would
 * only let it work facts out, so none.
 */
export function slowFacts(places: readonly { slow: number; bestTimes: readonly number[] }[]): number {
  const quick = places.flatMap((p) => p.bestTimes).sort((a, b) => a - b)[QUICK_FACTS - 1];
  return quick !== undefined && quick >= SLOW_QUICK_MS ? places.reduce((n, p) => n + p.slow, 0) : 0;
}

/** How much of a place sits: facts at least fluent, of all its facts. */
export function knownOf(pack: ContentPack, states: Record<ItemId, ItemState>): { known: number; total: number } {
  const known = pack.items.filter((it) => atLeast(states[it.id]?.status ?? 'new', 'fluent')).length;
  return { known, total: pack.items.length };
}
