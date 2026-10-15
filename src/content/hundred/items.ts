import type { Hint, Item, ItemId } from '../../engine';
import {
  allTasks,
  crossesTen,
  formatFact,
  isTen,
  onesOf,
  taskAnswer,
  taskId,
  taskPrompt,
  tenAbove,
  tenBelow,
  tensOf,
  unitOf,
  type Task,
} from './tasks';

/** Hälften av 56: an even number of tens and the rest, 40 and 16, so both halves are whole. */
export function halfSplit(n: number): { tens: number; rest: number } {
  const tens = 20 * Math.floor(n / 20);
  return { tens, rest: n - tens };
}

const hops = (from: number, step: number, count: number) => Array.from({ length: count + 1 }, (_, i) => from + i * step);
const times = ['', 'Ett hopp', 'Två hopp', 'Tre hopp', 'Fyra hopp', 'Fem hopp', 'Sex hopp', 'Sju hopp', 'Åtta hopp', 'Nio hopp'];

/**
 * A way to think about the task, as a short Swedish sentence, with the tasks
 * it builds on (`from`) for the räknestig. The main way is in steps on an
 * empty number line: 47 + 8 is 47 + 3 = 50, then 50 + 5 = 55.
 */
export function strategyFor(t: Task): { kind: string; text: string; from: ItemId[] } {
  const answer = taskAnswer(t);
  switch (t.kind) {
    case 'tens':
      return { kind: 'tens', text: `${t.n} tiotal är ${answer}.`, from: [] };
    case 'count':
      return { kind: 'tens', text: `${t.n} är ${answer} tiotal.`, from: [] };
    case 'place': {
      const [tens, ones] = [tensOf(t.n), onesOf(t.n)];
      if (t.ask === 'number') return { kind: 'place', text: `${tens} tiotal är ${10 * tens}, och ${ones} ental till: ${t.n}.`, from: [] };
      if (t.ask === 'swapped') return { kind: 'place', text: `Tiotalen först: ${tens} tiotal och ${ones} ental är ${t.n}.`, from: [] };
      return { kind: 'place', text: `${t.n} är ${10 * tens} och ${ones}. Det är ${tens} tiotal och ${ones} ental.`, from: [] };
    }
    case 'regroup': {
      const more = tensOf(t.ones);
      return {
        kind: 'regroup',
        text: `${t.ones} ental är ${more} tiotal och ${onesOf(t.ones)} ental. ${t.tens} + ${more} = ${t.tens + more} tiotal och ${onesOf(t.ones)} ental: ${answer}.`,
        from: [],
      };
    }
    case 'next':
      return { kind: 'toTen', text: `${onesOf(t.n)} och ${answer} är tiokamrater: ${t.n} + ${answer} = ${tenAbove(t.n)}.`, from: [] };
    case 'half': {
      if (t.n % 20 === 0) return { kind: 'half', text: `Hälften av ${t.n / 10} tiotal är ${t.n / 20} tiotal: ${answer}.`, from: [] };
      const { tens, rest } = halfSplit(t.n);
      const parts = tens ? `Hälften av ${tens} är ${tens / 2} och hälften av ${rest} är ${rest / 2}` : `Hälften av ${rest} är ${rest / 2}`;
      return { kind: 'half', text: `${t.n} = ${tens} + ${rest}. ${parts}: ${answer}.`, from: tens ? [taskId({ kind: 'half', n: tens })] : [] };
    }
    case 'fact':
      return factStrategy(t, answer);
  }
}

function factStrategy({ op, x, y }: Task & { kind: 'fact' }, answer: number): { kind: string; text: string; from: ItemId[] } {
  const self = formatFact(op, x, y);
  const t: Task = { kind: 'fact', op, x, y };
  switch (unitOf(t)) {
    case 'tiotal':
      return {
        kind: 'tens',
        text: `${formatFact(op, x / 10, y / 10)} = ${answer / 10}, så ${x / 10} tiotal ${op === '+' ? 'och' : 'minus'} ${y / 10} tiotal är ${answer / 10} tiotal: ${answer}.`,
        from: [],
      };
    case 'hopptio': {
      const n = y / 10;
      const word = op === '+' ? (n === 1 ? 'Ett hopp på tio' : `${times[n]} på tio`) : n === 1 ? 'Ett hopp bakåt på tio' : `${times[n]} bakåt på tio`;
      return { kind: 'hopTen', text: `${word}: ${hops(x, op === '+' ? 10 : -10, n).join(', ')}.`, from: [] };
    }
    case 'ental':
      if (isTen(x)) return { kind: 'tensAndOnes', text: `${x} och ${y} är ${answer}.`, from: [] };
      if (op === '-' && y === onesOf(x)) return { kind: 'downToTen', text: `Ta bort entalen: ${self} = ${answer}.`, from: [] };
      return { kind: 'ones', text: `${formatFact(op, onesOf(x), y)} = ${onesOf(answer)}, så ${self} = ${answer}.`, from: [] };
    case 'tilltio':
      return { kind: 'fromTen', text: `10 − ${y} = ${10 - y}, så ${self} = ${answer}.`, from: [] };
    case 'overtio': {
      if (op === '+') {
        const fill = tenAbove(x) - x;
        return { kind: 'bridge', text: `${self} = ${x} + ${fill} + ${y - fill} = ${tenAbove(x)} + ${y - fill} = ${answer}.`, from: [taskId({ kind: 'next', n: x })] };
      }
      const ones = onesOf(x);
      return {
        kind: 'downToTen',
        text: `${self} = ${x} − ${ones} − ${y - ones} = ${tenBelow(x)} − ${y - ones} = ${answer}.`,
        from: [taskId({ kind: 'fact', op: '-', x, y: ones })],
      };
    }
    case 'dubbla': {
      const [tens, ones] = [tenBelow(x), onesOf(x)];
      return {
        kind: 'double',
        text: `${self} = ${tens} + ${tens} + ${ones} + ${ones} = ${2 * tens} + ${2 * ones} = ${answer}.`,
        // 10 + 10 and 20 + 20 are tasks here; 8 + 8 is a fact from the brook.
        from: [taskId({ kind: 'fact', op: '+', x: tens, y: tens })],
      };
    }
    case 'tvasiffr': {
      const [tens, ones] = [tenBelow(y), onesOf(y)];
      return {
        kind: 'jumpTens',
        text: `${self} = ${x} + ${tens} + ${ones} = ${x + tens} + ${ones} = ${answer}.`,
        from: [taskId({ kind: 'fact', op: '+', x, y: tens })],
      };
    }
    default:
      throw new Error(`Not a calculation of Stigen: ${self}`);
  }
}

/** The other way for an addition: tens and ones each on their own (34 + 25 is 50 + 9). */
function splitText({ x, y }: { x: number; y: number }): string {
  const [tens, ones] = [tenBelow(x) + tenBelow(y), onesOf(x) + onesOf(y)];
  return `${formatFact('+', x, y)}: ${tenBelow(x)} + ${tenBelow(y)} = ${tens} och ${onesOf(x)} + ${onesOf(y)} = ${ones}. ${tens} + ${ones} = ${tens + ones}.`;
}

/**
 * Where the hops land on an empty number line: 47 + 8 is 47 → 50 → 55,
 * 52 − 6 is 52 → 50 → 46, 34 + 25 is 34 → 54 → 59, 26 + 30 is 26 → 36 → 46 → 56.
 */
export function landings(t: Task): { stops: number[]; up: boolean } | null {
  const answer = taskAnswer(t);
  if (t.kind === 'next') return { stops: [t.n, tenAbove(t.n)], up: true };
  if (t.kind !== 'fact') return null;
  const { op, x, y } = t;
  const up = op === '+';
  switch (unitOf(t)) {
    case 'hopptio':
      return { stops: hops(x, up ? 10 : -10, y / 10), up };
    case 'overtio':
      return { stops: [x, up ? tenAbove(x) : tenBelow(x), answer], up };
    case 'tvasiffr':
    case 'dubbla':
      return isTen(y) || onesOf(y) === 0 ? { stops: [x, answer], up } : { stops: [x, x + tenBelow(y), answer], up };
    default:
      return { stops: [x, answer], up };
  }
}

export function hintsFor(t: Task): Hint[] {
  const strategy = strategyFor(t);
  const hints: Hint[] = [{ kind: 'strategy', text: strategy.text, data: { strategy: strategy.kind, from: strategy.from } }];
  const line = landings(t);
  if (line) hints.push({ kind: 'numberline', data: line });
  // Tens rods and unit cubes: the numbers of the task, as tens and ones.
  if (t.kind === 'place' || t.kind === 'regroup') hints.push({ kind: 'base10', data: { tens: t.kind === 'place' ? tensOf(t.n) : t.tens, ones: t.kind === 'place' ? onesOf(t.n) : t.ones } });
  if (t.kind === 'tens' || t.kind === 'count') hints.push({ kind: 'base10', data: { tens: t.kind === 'tens' ? t.n : t.n / 10, ones: 0 } });
  if (t.kind === 'fact' && t.op === '+' && (unitOf(t) === 'tvasiffr' || unitOf(t) === 'dubbla' || unitOf(t) === 'tiotal')) {
    hints.push({ kind: 'base10', data: { numbers: [t.x, t.y] } });
    if (unitOf(t) !== 'tiotal') hints.push({ kind: 'split', text: splitText(t) });
  }
  return hints;
}

/**
 * The order a task comes in within its part: easier first. In "Dubbla och
 * halvera" a half comes right after its double (14 + 14, then hälften av 28).
 */
function orderOf(t: Task, index: number): number {
  switch (t.kind) {
    case 'tens':
      return t.n;
    case 'count':
      return 10 + t.n / 10;
    case 'half':
      return 100 * (t.n / 2) + 50;
    case 'fact':
      if (unitOf(t) === 'tiotal') return 100 + (t.op === '+' ? 0 : 100) + taskAnswer(t) / 10 + (t.op === '+' ? t.x : t.y) / 1000;
      if (unitOf(t) === 'dubbla') return 100 * t.x;
      return index;
    default:
      return index;
  }
}

/** The twin: a double and its half (14 + 14 and hälften av 28), a step up to the ten and down from it (56 + 4 = 60 and 60 − 4). */
function twinOf(t: Task, ids: Set<ItemId>): ItemId | undefined {
  let twin: ItemId | undefined;
  if (t.kind === 'fact' && t.op === '+' && t.x === t.y) twin = taskId({ kind: 'half', n: 2 * t.x });
  if (t.kind === 'half') twin = taskId({ kind: 'fact', op: '+', x: t.n / 2, y: t.n / 2 });
  if (t.kind === 'next') twin = taskId({ kind: 'fact', op: '-', x: tenAbove(t.n), y: taskAnswer(t) });
  if (t.kind === 'fact' && t.op === '-' && unitOf(t) === 'tilltio') twin = taskId({ kind: 'next', n: t.x - t.y });
  return twin !== undefined && ids.has(twin) ? twin : undefined;
}

/** Every task as an item. */
export function buildItems(): Item[] {
  const tasks = allTasks();
  const ids = new Set(tasks.map(taskId));
  return tasks.map((t, index) => {
    const id = taskId(t);
    const pairId = twinOf(t, ids);
    return {
      id,
      prompt: taskPrompt(t),
      answer: String(taskAnswer(t)),
      unitId: unitOf(t),
      tags: [`kind:${t.kind}`, ...(t.kind === 'fact' ? [`op:${t.op}`] : []), ...(crossesTen(t) ? ['crossesTen'] : [])],
      derivedFrom: strategyFor(t).from,
      hints: hintsFor(t),
      ...(pairId ? { pairId } : {}),
      order: orderOf(t, index),
    };
  });
}

/** The task with its answer, for grown-ups: "37 + 3 = 40", "hälften av 56 = 28", "47 = 4 tiotal och 7 ental". */
export function taskWithAnswer(t: Task): string {
  const answer = taskAnswer(t);
  if (t.kind === 'next') return `${formatFact('+', t.n, answer)} = ${tenAbove(t.n)}`;
  const prompt = taskPrompt(t);
  return prompt.includes('__') ? prompt.replace('__', String(answer)) : `${prompt} = ${answer}`;
}
