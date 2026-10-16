import type { ItemId } from '../../engine';

/**
 * Stigen: the numbers to 100 (see docs/PLAN-HUNDRA.md and docs/STIGEN.md).
 * Not every sum to 100: a few hundred tasks, chosen so that they cover the
 * steps the garden's räknestigar take (35 + 7, 60 − 6, 28 + 28, hälften av
 * 70 …) and a little more. Numbers 0–100, no negatives, no answers over 100.
 *
 * The kinds of task, with their ids:
 * - `47+8`, `52-6`, `14+14`: a calculation
 * - `tens:3`: 3 tiotal = __ (30)
 * - `count:70`: 70 = __ tiotal (7)
 * - `next:37`: 37 + __ = 40 (3), the way up to the next ten
 * - `half:56`: hälften av 56 (28)
 * - `te:63`, `te:47:t`, `te:47:e`, `te:47:byt`, `te:3t14e`: tens and ones
 */

export type Op = '+' | '-';

export type PlaceAsk = 'number' | 'tens' | 'ones' | 'swapped';

export type Task =
  | { kind: 'fact'; op: Op; x: number; y: number }
  | { kind: 'tens'; n: number }
  | { kind: 'count'; n: number }
  | { kind: 'next'; n: number }
  | { kind: 'half'; n: number }
  | { kind: 'place'; n: number; ask: PlaceAsk }
  | { kind: 'regroup'; tens: number; ones: number };

export const tensOf = (n: number) => Math.floor(n / 10);
export const onesOf = (n: number) => n % 10;
export const isTen = (n: number) => n % 10 === 0;
/** The ten at or below n: 47 → 40. */
export const tenBelow = (n: number) => 10 * tensOf(n);
/** The ten above n: 47 → 50. */
export const tenAbove = (n: number) => 10 * tensOf(n) + 10;

export function taskId(t: Task): ItemId {
  switch (t.kind) {
    case 'fact':
      return `${t.x}${t.op}${t.y}`;
    case 'place':
      return t.ask === 'number' ? `te:${t.n}` : `te:${t.n}:${t.ask === 'tens' ? 't' : t.ask === 'ones' ? 'e' : 'byt'}`;
    case 'regroup':
      return `te:${t.tens}t${t.ones}e`;
    default:
      return `${t.kind}:${t.n}`;
  }
}

export function parseTaskId(id: ItemId): Task {
  let m = /^(\d+)([+-])(\d+)$/.exec(id);
  if (m) return { kind: 'fact', op: m[2] as Op, x: Number(m[1]), y: Number(m[3]) };
  m = /^(tens|count|next|half):(\d+)$/.exec(id);
  if (m) return { kind: m[1] as 'tens' | 'count' | 'next' | 'half', n: Number(m[2]) };
  m = /^te:(\d+)t(\d+)e$/.exec(id);
  if (m) return { kind: 'regroup', tens: Number(m[1]), ones: Number(m[2]) };
  m = /^te:(\d+)(?::(t|e|byt))?$/.exec(id);
  if (m) return { kind: 'place', n: Number(m[1]), ask: m[2] === 't' ? 'tens' : m[2] === 'e' ? 'ones' : m[2] === 'byt' ? 'swapped' : 'number' };
  throw new Error(`Not a task of Stigen: ${id}`);
}

export const isFactId = (id: ItemId) => /^\d+[+-]\d+$/.test(id);

export function taskAnswer(t: Task): number {
  switch (t.kind) {
    case 'fact':
      return t.op === '+' ? t.x + t.y : t.x - t.y;
    case 'tens':
      return 10 * t.n;
    case 'count':
      return t.n / 10;
    case 'next':
      return tenAbove(t.n) - t.n;
    case 'half':
      return t.n / 2;
    case 'place':
      return t.ask === 'tens' ? tensOf(t.n) : t.ask === 'ones' ? onesOf(t.n) : t.n;
    case 'regroup':
      return 10 * t.tens + t.ones;
  }
}

/** As children write it, with a real minus sign: `52 − 6`. */
export function formatFact(op: Op, x: number, y: number): string {
  return `${x} ${op === '+' ? '+' : '−'} ${y}`;
}

const ental = (n: number) => `${n} ental`;
const tiotal = (n: number) => `${n} tiotal`;

/**
 * The prompt of a task. A calculation is just the calculation (`47 + 8`,
 * `hälften av 56`), and the form adds the blank; the other kinds carry their
 * blank in the prompt.
 */
export function taskPrompt(t: Task): string {
  switch (t.kind) {
    case 'fact':
      return formatFact(t.op, t.x, t.y);
    case 'tens':
      return `${tiotal(t.n)} = __`;
    case 'count':
      return `${t.n} = __ tiotal`;
    case 'next':
      return `${t.n} + __ = ${tenAbove(t.n)}`;
    case 'half':
      return `hälften av ${t.n}`;
    case 'place': {
      const [tens, ones] = [tensOf(t.n), onesOf(t.n)];
      if (t.ask === 'tens') return `${t.n} = __ tiotal och ${ental(ones)}`;
      if (t.ask === 'ones') return `${t.n} = ${tiotal(tens)} och __ ental`;
      if (t.ask === 'swapped') return `${ental(ones)} och ${tiotal(tens)} = __`;
      return `${tiotal(tens)} och ${ental(ones)} = __`;
    }
    case 'regroup':
      return `${tiotal(t.tens)} och ${ental(t.ones)} = __`;
  }
}

/**
 * The parts ("delar") and the order they come in. Each builds on the ones
 * before it in the pack; what each builds on at the brook is in
 * `BROOK_PREREQUISITES`, for the place to hold the part until then.
 */
export const UNIT_DEFS = [
  { id: 'tiotal', title: 'Hela tiotal', requires: [] },
  { id: 'tiental', title: 'Tiotal och ental', requires: ['tiotal'], understanding: true },
  { id: 'ental', title: 'Ental utan att gå över', requires: ['tiental'] },
  { id: 'tilltio', title: 'Till nästa tiotal', requires: ['tiental'] },
  { id: 'overtio', title: 'Över tiotalet', requires: ['ental', 'tilltio'] },
  // Open as early, but its new tasks come while the child waits for the bridge over the ten to open.
  { id: 'hopptio', title: 'Hoppa tio', requires: ['tiental'] },
  // A lane of its own: the garden's ×4 and ×5 wait for it, not for the bridge over the ten.
  { id: 'dubbla', title: 'Dubbla och halvera', requires: ['tiental'], lane: 'dubbla' },
  { id: 'tvasiffr', title: 'Tvåsiffrigt plus tvåsiffrigt', requires: ['hopptio', 'overtio'] },
  // After two-digit plus: the same hops of ten, backwards (docs/PLAN-MINUS.md).
  { id: 'tvasiffrminus', title: 'Tvåsiffrigt minus tvåsiffrigt', requires: ['tvasiffr'] },
] as const;

export type UnitId = (typeof UNIT_DEFS)[number]['id'];

/** What a part builds on at the brook (unit ids of the addition pack). */
export const BROOK_PREREQUISITES: Partial<Record<UnitId, string[]>> = {
  tiotal: ['tio'],
  tilltio: ['tiokamrater'],
  overtio: ['overtio'],
  dubbla: ['dubblor'],
};

/**
 * The part a task belongs to: by its form (`formOf`), except the first steps
 * of two-digit minus that no earlier part has (75 − 20, 68 + __ = 70).
 */
export function unitOf(t: Task): UnitId {
  return minusStepIds().has(taskId(t)) ? 'tvasiffrminus' : formOf(t);
}

/** The part a task's form goes with: 75 − 20 is a hop of ten, wherever it is practised. */
export function formOf(t: Task): UnitId {
  switch (t.kind) {
    case 'tens':
    case 'count':
      return 'tiotal';
    case 'place':
    case 'regroup':
      return 'tiental';
    case 'next':
      return 'tilltio';
    case 'half':
      return 'dubbla';
    case 'fact': {
      const { op, x, y } = t;
      // A hop of ten, also from a whole ten (40 + 10).
      if (y === 10 || (isTen(y) && !isTen(x))) return 'hopptio';
      if (isTen(x) && isTen(y)) return 'tiotal';
      if (op === '+' && x === y) return 'dubbla';
      if (y >= 10) return op === '+' ? 'tvasiffr' : 'tvasiffrminus';
      if (op === '+') return isTen(x) || onesOf(x) + y < 10 ? 'ental' : 'overtio';
      if (isTen(x)) return 'tilltio';
      return y <= onesOf(x) ? 'ental' : 'overtio';
    }
  }
}

/** Steps over a ten on the way: 47 + 8, 52 − 6 and 28 + 28, not 47 + 3 or 60 − 4. */
export function crossesTen(t: Task): boolean {
  if (t.kind !== 'fact') return false;
  if (t.op === '+') return onesOf(t.x) + onesOf(t.y) > 10;
  return !isTen(t.x) && onesOf(t.y) > onesOf(t.x);
}

const fact = (op: Op, x: number, y: number): Task => ({ kind: 'fact', op, x, y });
const add = (x: number, y: number) => fact('+', x, y);
const sub = (x: number, y: number) => fact('-', x, y);
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** Over the ten, up and down. The garden's räknestigar use the first ones (18 + 6 … 81 − 9). */
const OVER_UP: [number, number][] = [
  [18, 6], [14, 7], [18, 3], [16, 8], [24, 8], [18, 9], [27, 9], [36, 6], [35, 7], [48, 8], [45, 9], [54, 9],
  [47, 8], [29, 5], [56, 7], [73, 9], [85, 6], [67, 5],
];
const OVER_DOWN: [number, number][] = [
  [54, 6], [63, 7], [72, 8], [81, 9], [52, 6], [43, 5], [31, 4], [65, 8], [94, 7], [26, 9],
];
/** Two-digit plus two-digit: first without a new ten, then with. */
const TWO_DIGIT: [number, number][] = [
  [34, 25], [35, 14], [23, 45], [52, 36], [61, 27],
  [47, 36], [28, 35], [39, 24], [56, 27], [18, 46], [65, 29], [37, 38],
];

/**
 * Two-digit minus two-digit (docs/PLAN-MINUS.md): first without going over a
 * ten, then over it, taking the tens away first (75 − 20 − 3).
 */
const TWO_DIGIT_DOWN: [number, number][] = [
  [75, 23], [68, 25], [89, 34], [57, 32], [96, 41],
  [72, 38], [63, 27], [81, 46], [54, 29], [45, 18], [90, 36],
];
/** Numbers close to each other: count up from the smaller (68 → 70 → 71). */
const CLOSE: [number, number][] = [
  [71, 68], [52, 47], [83, 79], [64, 58],
];

/** Counting up is the way when the numbers are at most ten apart, and the smaller one is not a whole ten. */
export const countsUp = (x: number, y: number) => x - y <= 10 && !isTen(y) && tenAbove(y) <= x;

/** The steps two-digit minus starts from: the first hop back (75 − 20), and up to the ten (68 + __ = 70). */
function minusStepTasks(): Task[] {
  return [...TWO_DIGIT_DOWN.map(([x, y]) => sub(x, tenBelow(y))), ...CLOSE.map(([, y]): Task => ({ kind: 'next', n: y }))];
}

/** The steps that are new with two-digit minus: they belong to it, not to the part the kind of task would go to. */
let minusSteps: Set<ItemId> | undefined;
function minusStepIds(): Set<ItemId> {
  if (!minusSteps) {
    const before = new Set(tasksBeforeMinus().map(taskId));
    minusSteps = new Set(minusStepTasks().map(taskId).filter((id) => !before.has(id)));
  }
  return minusSteps;
}

/**
 * Every task of Stigen, in no particular order (each part sorts its own).
 * Two-digit minus comes last, so that the items before it keep their places
 * (QR codes from version 1 of the pack hold the first items only).
 */
export function allTasks(): Task[] {
  const out = [...tasksBeforeMinus(), ...minusStepTasks(), ...TWO_DIGIT_DOWN.map(([x, y]) => sub(x, y)), ...CLOSE.map(([x, y]) => sub(x, y))];
  // Once each: a hop or a step can come from two places.
  const seen = new Set<ItemId>();
  return out.filter((t) => {
    const id = taskId(t);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** The tasks of version 1 of the pack, before two-digit minus. */
function tasksBeforeMinus(): Task[] {
  const out: Task[] = [];

  // Hela tiotal: how many tens, and the brook's facts as tens (40 + 30, 90 − 20).
  for (const n of [3, 5, 7, 4, 9, 10]) out.push({ kind: 'tens', n });
  for (const n of [20, 60, 40, 80, 100, 30]) out.push({ kind: 'count', n });
  for (const [x, y] of [[20, 20], [30, 20], [40, 30], [50, 20], [30, 30], [60, 40], [40, 40], [70, 20], [50, 50], [60, 30]]) out.push(add(x!, y!));
  for (const [x, y] of [[50, 20], [40, 20], [70, 30], [90, 20], [80, 50], [60, 30], [100, 40], [100, 70]]) out.push(sub(x!, y!));

  // Tiotal och ental (understanding).
  for (const n of [63, 47, 25, 81, 39, 50, 74, 18, 92]) out.push({ kind: 'place', n, ask: 'number' });
  for (const n of [47, 85, 36, 60]) out.push({ kind: 'place', n, ask: 'tens' });
  for (const n of [52, 93, 70, 28]) out.push({ kind: 'place', n, ask: 'ones' });
  for (const n of [47, 92, 36]) out.push({ kind: 'place', n, ask: 'swapped' });
  out.push({ kind: 'regroup', tens: 3, ones: 14 }, { kind: 'regroup', tens: 5, ones: 12 });

  // Hoppa tio: one hop and several, up and down; and the first hop of every two-digit sum (47 + 30 for 47 + 36).
  for (const [x, y] of [[20, 10], [50, 10], [90, 10]]) out.push(add(x!, y!));
  for (const x of [60, 100]) out.push(sub(x, 10));
  for (const x of [14, 37, 62, 89]) out.push(add(x, 10));
  for (const x of [24, 55, 68, 91]) out.push(sub(x, 10));
  for (const [x, y] of [[26, 30], [13, 40], [24, 60]]) out.push(add(x!, y!));
  for (const [x, y] of [[58, 20], [83, 30], [74, 40], [96, 50]]) out.push(sub(x!, y!));
  for (const [x, y] of TWO_DIGIT) out.push(add(x, tenBelow(y)));
  // 10 + 10: the first step of doubling 12 … 19.
  out.push(add(10, 10));

  // Ental utan att gå över: a ten and some ones, ones up and down, and down to the ten (52 − 2, the first step of 52 − 6).
  for (const [x, y] of [[20, 4], [30, 5], [30, 6], [40, 8], [70, 3]]) out.push(add(x!, y!));
  for (const [x, y] of [[12, 6], [15, 3], [21, 7], [24, 4], [42, 7], [34, 5], [53, 4], [61, 8], [82, 5], [76, 3]]) out.push(add(x!, y!));
  for (const [x, y] of [[27, 3], [36, 4], [47, 3], [58, 5], [69, 7], [85, 2]]) out.push(sub(x!, y!));
  for (const [x] of OVER_DOWN) out.push(sub(x, onesOf(x)));

  // Till nästa tiotal: up to the ten (the first step of 47 + 8), and from a ten down (60 − 6).
  for (const n of [...OVER_UP.map(([x]) => x), 37, 25, 61, 95]) out.push({ kind: 'next', n });
  for (const [x, y] of [[30, 3], [40, 4], [50, 5], [60, 6], [70, 7], [80, 8], [90, 9], [60, 4], [50, 2], [100, 6], [40, 7], [20, 7]])
    out.push(sub(x!, y!));

  // Över tiotalet.
  for (const [x, y] of OVER_UP) out.push(add(x, y));
  for (const [x, y] of OVER_DOWN) out.push(sub(x, y));

  // Dubbla och halvera.
  for (const n of [...range(11, 19), 21, 23, 24, 25, 26, 28, 32, 35, 36, 45]) out.push(add(n, n));
  for (const n of [...range(2, 10).map((t) => 10 * t), 24, 28, 32, 36, 46, 56, 64, 72]) out.push({ kind: 'half', n });

  // Tvåsiffrigt plus tvåsiffrigt.
  for (const [x, y] of TWO_DIGIT) out.push(add(x, y));
  return out;
}
