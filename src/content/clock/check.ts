import type { Rng } from '../../engine';
import { normalizeAnswer } from './time';
import { HAND_PLACES, HOUR_HAND_HOURS, parseTaskId, TIMES, WHY_TASKS, taskAnswer, taskId, type Task } from './tasks';

/**
 * Tornets koll (docs/PLAN-KLOCKAN.md, KL4): the same blueprint every time,
 * after NCM's MTi1 (reading, setting the hands, the units of time), drawn at
 * random within each kind and never adapted to the child. The times are drawn
 * from all the tower's times, not only those the child has met.
 */
export type CheckCategory = 'lasa' | 'stalla' | 'timvisaren' | 'enheter';

export const CHECK_CATEGORIES: { id: CheckCategory; title: string; short: string; count: number }[] = [
  { id: 'lasa', title: 'Läsa klockan', short: 'Läsa', count: 4 },
  { id: 'stalla', title: 'Ställa visarna', short: 'Ställa', count: 3 },
  { id: 'timvisaren', title: 'Timvisaren', short: 'Timvisaren', count: 1 },
  { id: 'enheter', title: 'Minuter, kvartar och timmar', short: 'Enheter', count: 2 },
];

export interface CheckItem {
  id: string;
  answer: string;
  category: CheckCategory;
}

const allTimes = () => [...TIMES.hel, ...TIMES.halv, ...TIMES.kvart, ...TIMES.femmin];

const POOLS: Record<CheckCategory, () => Task[]> = {
  // Words where there are words yet; digital time for every time.
  lasa: () => allTimes().flatMap((t): Task[] => [{ kind: 'read', form: 'dig', t }, ...(t.m % 15 === 0 ? [{ kind: 'read', form: 'ord', t } as Task] : [])]),
  stalla: () => allTimes().map((t): Task => ({ kind: 'read', form: 'stall', t })),
  timvisaren: () => HOUR_HAND_HOURS.flatMap((h) => HAND_PLACES.map((place): Task => ({ kind: 'hourHand', h, place }))),
  // The questions about why that have a number for an answer: minutes, quarters and hours.
  enheter: () => Object.entries(WHY_TASKS).filter(([, w]) => /^\d+$/.test(w.answer)).map(([key]): Task => ({ kind: 'why', key })),
};

function pick<T>(pool: T[], n: number, rng: Rng): T[] {
  const left = [...pool];
  const out: T[] = [];
  while (out.length < n && left.length) out.push(left.splice(Math.floor(rng.next() * left.length), 1)[0]!);
  return out;
}

/** One check: the same number of tasks of each kind, taken in turns so the kinds are mixed. */
export function buildTowerCheck(rng: Rng): CheckItem[] {
  const drawn = CHECK_CATEGORIES.map(({ id, count }) => pick(POOLS[id](), count, rng).map((t): CheckItem => ({ id: taskId(t), answer: taskAnswer(t), category: id })));
  const out: CheckItem[] = [];
  for (let i = 0; drawn.some((d) => d.length > i); i++) for (const d of drawn) if (d[i]) out.push(d[i]!);
  return out;
}

export interface CheckAnswer {
  item: CheckItem;
  given: string;
}

export const checkRight = (a: CheckAnswer) => normalizeAnswer(a.given) === normalizeAnswer(a.item.answer);

/** Right answers per kind, and each task's outcome, for the session's `extra` (as Stigens koll). Not timed: understanding. */
export function summarizeTowerCheck(answers: CheckAnswer[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { id } of CHECK_CATEGORIES) Object.assign(out, { [`${id}:total`]: 0, [`${id}:right`]: 0, [`${id}:quick`]: 0 });
  for (const a of answers) {
    const right = checkRight(a);
    out[`${a.item.category}:total`]!++;
    if (right) out[`${a.item.category}:right`]!++;
    out[`item:${a.item.id}`] = right ? 1 : -1;
  }
  return out;
}

export const checkTask = (item: CheckItem): Task => parseTaskId(item.id);
