import type { Item, ItemId } from '../../engine';

/**
 * Vågen (the scale by the brook): the equal sign means "is as much as", not
 * "the answer comes next" (McNeil et al.). The tasks use facts the child
 * already meets in the brook, in forms school books rarely show:
 *
 * - balance: `7 + 5 = __ + 8` and `__ + 4 = 3 + 5`
 * - true or false: `6 = 6`, `3 + 4 = 4 + 3`, `9 = 4 + 4`
 * - the same number: `8 = __`
 *
 * The typical wrong answers to `7 + 5 = __ + 8` are 12 (the left side worked
 * out) and 20 (everything added up); both are offered as options.
 */

export interface Balance {
  kind: 'balance';
  /** Left and right side; one term on one side is the blank (null). */
  left: (number | null)[];
  right: (number | null)[];
  answer: number;
}

export interface TrueFalse {
  kind: 'truefalse';
  left: number[];
  right: number[];
  answer: 'ja' | 'nej';
}

export type Equality = Balance | TrueFalse;

const sum = (xs: (number | null)[]) => xs.reduce<number>((s, x) => s + (x ?? 0), 0);

function balance(left: (number | null)[], right: (number | null)[]): Balance {
  const known = sum(left) - sum(right);
  return { kind: 'balance', left, right, answer: Math.abs(known) };
}

const truefalse = (left: number[], right: number[]): TrueFalse => ({ kind: 'truefalse', left, right, answer: sum(left) === sum(right) ? 'ja' : 'nej' });

/** The tasks, roughly from easy to hard. */
export const EQUALITIES: Equality[] = [
  truefalse([6], [6]),
  truefalse([5], [2, 3]),
  balance([8], [null]),
  truefalse([3, 4], [4, 3]),
  truefalse([9], [4, 4]),
  balance([null], [6]),
  balance([5, 3], [4, null]),
  truefalse([6, 2], [2, 6]),
  truefalse([7, 1], [8, 1]),
  balance([3, 4], [null, 2]),
  balance([6, 2], [5, null]),
  truefalse([10], [6, 4]),
  balance([null, 4], [3, 5]),
  truefalse([2, 5], [3, 4]),
  balance([8, 2], [null, 7]),
  truefalse([4, 5], [9, 1]),
  balance([9, 1], [null, 5]),
  balance([2, 6], [null, 3]),
  truefalse([5, 5], [10, 0]),
  balance([6, 4], [null, 9]),
  truefalse([7], [7, 1]),
  balance([7, 5], [null, 8]),
  balance([8, 5], [9, null]),
  balance([7, 6], [null, 10]),
];

const side = (xs: (number | null)[]) => xs.map((x) => (x === null ? '__' : String(x))).join(' + ');

export function formatEquality(e: Equality): string {
  return `${side(e.left)} = ${side(e.right)}`;
}

/** `eq:7+5=_+8` */
export function equalityId(e: Equality): ItemId {
  const s = (xs: (number | null)[]) => xs.map((x) => (x === null ? '_' : x)).join('+');
  return `eq:${s(e.left)}=${s(e.right)}`;
}

export const isEqualityId = (id: ItemId) => id.startsWith('eq:');

/** Plausible wrong answers, from the known misconceptions about the equal sign. */
export function equalityDistractors(e: Equality): { value: string; weight: number }[] {
  if (e.kind === 'truefalse') return [{ value: e.answer === 'ja' ? 'nej' : 'ja', weight: 1 }];
  const blankLeft = e.left.includes(null);
  const [other, withBlank] = blankLeft ? [e.right, e.left] : [e.left, e.right];
  const otherSum = sum(other);
  const out = [
    // Works out the side without the blank and writes that ("the answer comes next").
    { value: String(otherSum), weight: 3 },
    // Adds every number it sees.
    { value: String(otherSum + sum(withBlank)), weight: 3 },
    { value: String(e.answer + 1), weight: 1 },
    { value: String(e.answer - 1), weight: 1 },
    { value: String(e.answer + 2), weight: 0.5 },
  ];
  return out.filter((c) => Number(c.value) >= 0 && Number(c.value) !== e.answer);
}

/** A friendly word when a wrong answer is one of the typical mix-ups. */
export function equalityNote(e: Equality, given: string): string | undefined {
  if (e.kind === 'truefalse') {
    return `${side(e.left)} är ${sum(e.left)}, och ${side(e.right)} är ${sum(e.right)}. ${
      e.answer === 'ja' ? 'Det är lika mycket.' : 'Det är inte lika mycket.'
    }`;
  }
  const blankLeft = e.left.includes(null);
  const [other, withBlank] = blankLeft ? [e.right, e.left] : [e.left, e.right];
  const g = Number(given);
  if (g === sum(other)) return `${g} är det som står på andra sidan. Båda sidor ska vara lika mycket.`;
  if (g === sum(other) + sum(withBlank)) return `${g} är allt ihop. Båda sidor ska vara lika mycket.`;
  return undefined;
}

/** The equality tasks as items of the unit `vagen` (understanding). */
export function buildEqualities(): Item[] {
  return EQUALITIES.map((e, order) => ({
    id: equalityId(e),
    prompt: formatEquality(e),
    answer: String(e.answer),
    unitId: 'vagen',
    tags: [`equality:${e.kind}`],
    derivedFrom: [],
    hints: [{ kind: 'equality', data: e }],
    // There is no number to type for "stämmer det?".
    ...(e.kind === 'truefalse' ? { formats: ['choice' as const] } : {}),
    order,
  }));
}
