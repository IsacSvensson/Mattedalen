import { diffDays } from './clock';
import type { AnswerFormat, DayEvidence, DayKey, ItemId, ItemState, Status, StatusConfig } from './types';
import { STATUS_ORDER } from './types';

export function emptyState(itemId: ItemId): ItemState {
  return {
    itemId,
    status: 'new',
    box: 0,
    dueDay: null,
    introducedDay: null,
    lastSeenAt: null,
    lastWrongDay: null,
    lastRtMs: null,
    seen: 0,
    correct: 0,
    lapses: 0,
    dayBest: {},
    confusions: {},
  };
}

export function statusRank(s: Status): number {
  return STATUS_ORDER.indexOf(s);
}

export function atLeast(s: Status, min: Status): boolean {
  return statusRank(s) >= statusRank(min);
}

/** Number of distinct days with a correct answer under `rtMs` in one of `formats`. */
export function evidenceDays(state: ItemState, rtMs: number, formats: AnswerFormat[]): number {
  let days = 0;
  for (const ev of Object.values(state.dayBest)) {
    if (formats.some((f) => (ev[f] ?? Infinity) < rtMs)) days++;
  }
  return days;
}

/** Highest status the evidence supports, never below `learning` for an introduced item. */
export function promotedStatus(state: ItemState, cfg: StatusConfig): Status {
  let status = state.status === 'new' ? 'learning' : state.status;
  if (status === 'learning' && evidenceDays(state, cfg.fluentRtMs, cfg.fluentFormats) >= cfg.fluentDays) {
    status = 'fluent';
  }
  if (status === 'fluent' && evidenceDays(state, cfg.automaticRtMs, cfg.automaticFormats) >= cfg.automaticDays) {
    status = 'automatic';
  }
  return status;
}

/** A wrong answer moves the item down one step (but never back to `new`). */
export function demotedStatus(status: Status): Status {
  switch (status) {
    case 'automatic':
      return 'fluent';
    case 'fluent':
      return 'learning';
    default:
      return 'learning';
  }
}

function pruneEvidence(dayBest: Record<DayKey, ItemState['dayBest'][DayKey]>, today: DayKey, keepDays: number) {
  const out: ItemState['dayBest'] = {};
  for (const [day, ev] of Object.entries(dayBest)) {
    if (diffDays(day, today) < keepDays) out[day] = ev;
  }
  return out;
}

/**
 * After a wrong answer, today no longer counts and only so much earlier
 * evidence is kept that the next level is one good day away: a demoted
 * fluent item must show fluency on a new day before it is promoted again.
 */
function trimEvidenceAfterLapse(s: ItemState, today: DayKey, cfg: StatusConfig): ItemState['dayBest'] {
  const keep = s.status === 'fluent' ? cfg.automaticDays - 1 : cfg.fluentDays - 1;
  const days = Object.keys(s.dayBest)
    .filter((d) => d !== today)
    .sort()
    .slice(-Math.max(0, keep));
  return Object.fromEntries(days.map((d) => [d, s.dayBest[d] as DayEvidence]));
}

export interface AnswerInput {
  correct: boolean;
  /** Normalized answer the learner gave. */
  given: string;
  rtMs: number;
  format: AnswerFormat;
  now: number;
  today: DayKey;
}

/**
 * Status part of answering an item (Leitner scheduling lives in leitner.ts).
 *
 * Evidence only counts for genuine retrieval: not on the day the item was
 * introduced and not after the learner already got it wrong today (the
 * correct answer was just shown to them).
 */
export function applyStatus(prev: ItemState, input: AnswerInput, cfg: StatusConfig): ItemState {
  const s: ItemState = {
    ...prev,
    dayBest: { ...prev.dayBest },
    confusions: { ...prev.confusions },
    seen: prev.seen + 1,
    lastSeenAt: input.now,
    lastRtMs: input.rtMs,
  };
  if (s.status === 'new') {
    s.status = 'learning';
    s.introducedDay = input.today;
  }

  if (!input.correct) {
    s.lapses++;
    s.lastWrongDay = input.today;
    s.confusions[input.given] = (s.confusions[input.given] ?? 0) + 1;
    s.status = demotedStatus(s.status);
    s.dayBest = trimEvidenceAfterLapse(s, input.today, cfg);
    return s;
  }

  s.correct++;
  const countsAsEvidence = s.introducedDay !== input.today && s.lastWrongDay !== input.today;
  if (countsAsEvidence) {
    const ev = { ...s.dayBest[input.today] };
    ev[input.format] = Math.min(ev[input.format] ?? Infinity, input.rtMs);
    s.dayBest[input.today] = ev;
    s.dayBest = pruneEvidence(s.dayBest, input.today, cfg.keepEvidenceDays);
    s.status = promotedStatus(s, cfg);
  }
  return s;
}
