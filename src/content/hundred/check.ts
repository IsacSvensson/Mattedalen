import type { Rng } from '../../engine';
import { crossesTen, isTen, onesOf, taskAnswer, taskId, taskPrompt, type Task } from './tasks';

/**
 * Stigens koll: the same blueprint every time, drawn at random within each
 * kind and never adapted to the child (as Bäckens koll). The tasks are drawn
 * from all numbers to 100, not only those practised on Stigen, so the check
 * also shows whether the way of thinking carries over.
 */

export type CheckCategory = 'tiotal' | 'ental' | 'plus' | 'minus' | 'dubbla' | 'tvasiffr' | 'tvasiffrminus';

export const CHECK_CATEGORIES: { id: CheckCategory; title: string; short: string; count: number }[] = [
  { id: 'tiotal', title: 'Tiotal och ental', short: 'Tiotal', count: 2 },
  { id: 'ental', title: 'Ental och hela tiotal', short: 'Ental', count: 2 },
  { id: 'plus', title: 'Plus över tiotalet', short: 'Plus över', count: 3 },
  { id: 'minus', title: 'Minus över tiotalet', short: 'Minus över', count: 3 },
  { id: 'dubbla', title: 'Dubbla och halvera', short: 'Dubbla', count: 2 },
  { id: 'tvasiffr', title: 'Tvåsiffrigt plus tvåsiffrigt', short: 'Tvåsiffrigt', count: 2 },
  // Last, so the kinds before it are drawn as in the checks before it (docs/PLAN-MINUS.md).
  { id: 'tvasiffrminus', title: 'Tvåsiffrigt minus tvåsiffrigt', short: 'Tvåsiffrigt minus', count: 2 },
];

export interface CheckItem {
  /** The task's id on Stigen (`47+8`, `te:63`, `half:56`), also for tasks not practised there. */
  id: string;
  /** As shown, with `__` for the blank. */
  prompt: string;
  answer: string;
  category: CheckCategory;
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const fact = (op: '+' | '-', x: number, y: number): Task => ({ kind: 'fact', op, x, y });

const item = (t: Task, category: CheckCategory): CheckItem => {
  const prompt = taskPrompt(t);
  return { id: taskId(t), prompt: prompt.includes('__') ? prompt : `${prompt} = __`, answer: String(taskAnswer(t)), category };
};

const twoDigit = range(11, 99).filter((n) => !isTen(n));

const POOLS: Record<CheckCategory, () => Task[]> = {
  tiotal: () => twoDigit.flatMap((n): Task[] => [{ kind: 'place', n, ask: 'number' }, { kind: 'place', n, ask: 'tens' }, { kind: 'place', n, ask: 'ones' }]),
  ental: () => [
    ...twoDigit.flatMap((x) => range(1, 9 - onesOf(x)).map((y) => fact('+', x, y))),
    ...twoDigit.flatMap((x) => range(1, onesOf(x)).map((y) => fact('-', x, y))),
    ...range(1, 9).flatMap((a) => range(1, 10 - a).map((b) => fact('+', 10 * a, 10 * b))),
  ],
  plus: () => twoDigit.flatMap((x) => range(3, 9).map((y) => fact('+', x, y))).filter((t) => crossesTen(t) && taskAnswer(t) <= 100),
  minus: () => range(21, 99).filter((x) => !isTen(x)).flatMap((x) => range(3, 9).map((y) => fact('-', x, y))).filter((t) => crossesTen(t)),
  dubbla: () => [
    ...twoDigit.filter((n) => n < 50).map((n) => fact('+', n, n)),
    ...range(11, 49).map((n) => 2 * n).filter((n) => !isTen(n)).map((n): Task => ({ kind: 'half', n })),
  ],
  tvasiffr: () => twoDigit.flatMap((x) => twoDigit.filter((y) => y !== x && x + y <= 99).map((y) => fact('+', x, y))),
  tvasiffrminus: () => twoDigit.flatMap((x) => twoDigit.filter((y) => y < x).map((y) => fact('-', x, y))),
};

function pick<T>(pool: T[], n: number, rng: Rng): T[] {
  const left = [...pool];
  const out: T[] = [];
  while (out.length < n && left.length) out.push(left.splice(Math.floor(rng.next() * left.length), 1)[0]!);
  return out;
}

/** One check: the same number of tasks of each kind, taken in turns so the kinds are mixed. */
export function buildPathCheck(rng: Rng): CheckItem[] {
  const drawn = CHECK_CATEGORIES.map(({ id, count }) => pick(POOLS[id](), count, rng).map((t) => item(t, id)));
  const out: CheckItem[] = [];
  for (let i = 0; drawn.some((d) => d.length > i); i++) for (const d of drawn) if (d[i]) out.push(d[i]!);
  return out;
}

export interface CheckAnswer {
  item: CheckItem;
  given: string;
  rtMs: number;
}

/** An answer counts as quick when it came within this time. Two-digit answers are timed to the first digit. */
export const QUICK_MS = 3000;

/** Per kind: how many, how many right and how many of those quick; per task the time of a right answer (or -1). */
export function summarizePathCheck(answers: CheckAnswer[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { id } of CHECK_CATEGORIES) Object.assign(out, { [`${id}:total`]: 0, [`${id}:right`]: 0, [`${id}:quick`]: 0 });
  for (const a of answers) {
    const right = a.given.trim() === a.item.answer;
    const cat = a.item.category;
    out[`${cat}:total`]!++;
    if (right) out[`${cat}:right`]!++;
    if (right && a.rtMs <= QUICK_MS) out[`${cat}:quick`]!++;
    out[`item:${a.item.id}`] = right ? Math.round(a.rtMs) : -1;
  }
  return out;
}
