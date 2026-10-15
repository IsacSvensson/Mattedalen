import type { Rng } from '../../engine';
import { EQUALITIES, equalityId } from './equality';
import { formatFact } from './facts';

/**
 * Bäckens koll: separate check tasks, the same blueprint every time and not
 * adapted to the child. In an adaptive session the share of right answers is
 * pushed towards the target and does not show what the child can, so this is
 * the measure of mastery. The equal sign is checked in forms the child has not
 * practised ("8 + 4 = __ + 5"): that is the measure of transfer.
 */

export type CheckCategory = 'inom10' | 'plus' | 'minus' | 'equality';

/** The kinds of tasks, with a short name for narrow tables. */
export const CHECK_CATEGORIES: { id: CheckCategory; title: string; short: string; count: number }[] = [
  { id: 'inom10', title: 'Inom 10', short: 'Inom 10', count: 3 },
  { id: 'plus', title: 'Plus över tiotalet', short: 'Plus över 10', count: 3 },
  { id: 'minus', title: 'Minus över tiotalet', short: 'Minus över 10', count: 3 },
  { id: 'equality', title: 'Likhetstecknet i nya former', short: 'Likhet', count: 4 },
];

export interface CheckItem {
  /** A fact id (`8+5`, `13-5`) or a new equality (`chk:8+4=_+5`). */
  id: string;
  /** As shown, with `__` for the blank: "8 + 5 = __", "8 + 4 = __ + 5". */
  prompt: string;
  answer: string;
  category: CheckCategory;
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

const fact = (op: '+' | '-', x: number, y: number, category: CheckCategory): CheckItem => ({
  id: `${x}${op}${y}`,
  prompt: `${formatFact(op, x, y)} = __`,
  answer: String(op === '+' ? x + y : x - y),
  category,
});

/** Within 10, without the easiest (0 and one more): 3 + 5, 8 − 3. */
function withinTen(): CheckItem[] {
  const out: CheckItem[] = [];
  for (const a of range(2, 8))
    for (const b of range(2, 8))
      if (a + b <= 10) {
        out.push(fact('+', a, b, 'inom10'));
        out.push(fact('-', a + b, b, 'inom10'));
      }
  return out;
}

const overTen = (op: '+' | '-'): CheckItem[] =>
  range(2, 9).flatMap((a) =>
    range(2, 9)
      .filter((b) => a + b > 10)
      .map((b) => (op === '+' ? fact('+', a, b, 'plus') : fact('-', a + b, b, 'minus'))),
  );

const practised = new Set(EQUALITIES.map(equalityId));

/**
 * Equalities with a blank on the other side of the sign, none of them among
 * the scale's practised tasks: `a + b = __ + c`, `__ + c = a + b`, `a + b = c + __`.
 */
function newEqualities(): CheckItem[] {
  const out: CheckItem[] = [];
  for (const a of range(2, 9))
    for (const b of range(2, 9))
      for (const c of range(2, 9)) {
        const answer = a + b - c;
        if (answer < 1 || answer > 9 || c === a || c === b || a + b > 18) continue;
        const forms: [string, string][] = [
          [`chk:${a}+${b}=_+${c}`, `${a} + ${b} = __ + ${c}`],
          [`chk:_+${c}=${a}+${b}`, `__ + ${c} = ${a} + ${b}`],
          [`chk:${a}+${b}=${c}+_`, `${a} + ${b} = ${c} + __`],
        ];
        for (const [id, prompt] of forms) {
          if (practised.has(id.replace('chk:', 'eq:'))) continue;
          out.push({ id, prompt, answer: String(answer), category: 'equality' });
        }
      }
  return out;
}

const POOLS: Record<CheckCategory, () => CheckItem[]> = {
  inom10: withinTen,
  plus: () => overTen('+'),
  minus: () => overTen('-'),
  equality: newEqualities,
};

function pick<T>(pool: T[], n: number, rng: Rng): T[] {
  const left = [...pool];
  const out: T[] = [];
  while (out.length < n && left.length) out.push(left.splice(Math.floor(rng.next() * left.length), 1)[0]!);
  return out;
}

/**
 * One check: the same number of tasks of each kind every time, drawn at random
 * within each kind (never chosen after what the child knows), taken in turns
 * so that the kinds are mixed.
 */
export function buildCheck(rng: Rng): CheckItem[] {
  const drawn = CHECK_CATEGORIES.map(({ id, count }) => pick(POOLS[id](), count, rng));
  const out: CheckItem[] = [];
  for (let i = 0; drawn.some((d) => d.length > i); i++) for (const d of drawn) if (d[i]) out.push(d[i]!);
  return out;
}

export interface CheckAnswer {
  item: CheckItem;
  given: string;
  /** To the first digit, as everywhere at the brook. */
  rtMs: number;
}

/** An answer counts as quick when it came within this time (as for "automatic"). */
export const QUICK_MS = 3000;

/**
 * The check as numbers for the session record: per kind how many were right
 * and how many of those were quick, and per task the time of a right answer
 * (or -1), for a closer look later (trained and untrained facts).
 */
export function summarizeCheck(answers: CheckAnswer[]): Record<string, number> {
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
