import type { Hint, Item, ItemId } from '../../engine';

/**
 * Bäcken: addition and subtraction within 20, learnt as fact families. The
 * family {5, 8, 13} is 5 + 8, 8 + 5, 13 − 5 and 13 − 8: every calculation is
 * its own fact, and the family stays together in one unit.
 *
 * Terms are 0–10, so sums go up to 20: 121 additions and 121 subtractions.
 */
export const MAX_TERM = 10;

export type Op = '+' | '-';

/** `8+5` or `13-5`. */
export interface Fact {
  op: Op;
  /** First number: a term, or what is taken from. */
  x: number;
  /** Second number: a term, or what is taken away. */
  y: number;
  answer: number;
}

export function factId(op: Op, x: number, y: number): ItemId {
  return `${x}${op}${y}`;
}

export function parseFactId(id: ItemId): Fact {
  const m = /^(\d+)([+-])(\d+)$/.exec(id);
  if (!m) throw new Error(`Not an addition or subtraction fact: ${id}`);
  const x = Number(m[1]);
  const y = Number(m[3]);
  const op = m[2] as Op;
  return { op, x, y, answer: op === '+' ? x + y : x - y };
}

export const isFactId = (id: ItemId) => /^\d+[+-]\d+$/.test(id);

/** As children write it: `8 + 5`, `13 − 5` (with a real minus sign). */
export function formatFact(op: Op, x: number, y: number): string {
  return `${x} ${op === '+' ? '+' : '−'} ${y}`;
}

/** The family of a fact as its two terms (smallest first) and their sum. */
export function familyOf({ op, x, y, answer }: Fact): { a: number; b: number; sum: number } {
  const [a, b] = op === '+' ? [x, y] : [y, answer];
  return { a: Math.min(a, b), b: Math.max(a, b), sum: a + b };
}

/**
 * Knowledge components ("delar") and their prerequisites. Easy, known things
 * first, so a start check can quickly mark them as known (zero, one more,
 * ten and some, small sums) and the child soon reaches the pairs that make
 * ten and the bridge over ten, which the pilot measures.
 */
export const UNIT_DEFS = [
  { id: 'ettmer', title: 'Ett mer, ett mindre', requires: [] },
  { id: 'noll', title: 'Noll', requires: [] },
  { id: 'sma', title: 'Små summor', requires: ['ettmer'] },
  { id: 'tio', title: 'Tio och några', requires: ['ettmer'] },
  { id: 'tiokamrater', title: 'Tiokamrater', requires: ['sma'] },
  { id: 'dubblor', title: 'Dubblor och hälften', requires: ['sma'] },
  { id: 'inom10', title: 'Inom 10', requires: ['tiokamrater'] },
  { id: 'naradubblor', title: 'Nära dubblor', requires: ['dubblor'] },
  { id: 'overtio', title: 'Över tiotalet', requires: ['tiokamrater', 'tio'] },
  { id: 'vagen', title: 'Likhetstecknet', requires: ['tiokamrater'], understanding: true },
] as const;

export type UnitId = (typeof UNIT_DEFS)[number]['id'];

/** The unit of a family. The whole family is in the same unit. */
export function unitOf(a: number, b: number): UnitId {
  if (a === 0 || b === 0) return 'noll';
  if (a === 1 || b === 1) return 'ettmer';
  if (a === 10 || b === 10) return 'tio';
  if (a === b) return 'dubblor';
  if (a + b === 10) return 'tiokamrater';
  if (a + b <= 5) return 'sma';
  if (Math.abs(a - b) === 1) return 'naradubblor';
  if (a + b <= 10) return 'inom10';
  return 'overtio';
}

/** Steps over ten: 8 + 5 crosses ten, 13 − 5 crosses it going down. */
export function crossesTen(f: Fact): boolean {
  const { a, b, sum } = familyOf(f);
  return sum > 10 && a < 10 && b < 10;
}

/**
 * A way to think about the fact, as a short Swedish sentence, with the facts
 * it builds on (`from`) for the derivation path.
 */
export function strategyFor(f: Fact): { kind: string; text: string; from: ItemId[] } {
  const { op, x, y, answer } = f;
  const { a, b, sum } = familyOf(f);
  const self = formatFact(op, x, y);
  switch (unitOf(a, b)) {
    case 'noll':
      if (op === '+') return { kind: 'zero', text: `${self} = ${answer}: noll gör ingen skillnad.`, from: [] };
      return y === 0
        ? { kind: 'zero', text: `${self} = ${answer}: inget tas bort.`, from: [] }
        : { kind: 'zero', text: `${self} = 0: allt tas bort.`, from: [] };
    case 'ettmer':
      if (op === '+') return { kind: 'next', text: `${self} är talet efter ${Math.max(x, y)}: ${answer}.`, from: [] };
      return y === 1
        ? { kind: 'next', text: `${self} är talet före ${x}: ${answer}.`, from: [] }
        : { kind: 'next', text: `${x} och ${y} står bredvid varandra: ${self} = 1.`, from: [] };
    case 'tio':
      if (op === '+') return { kind: 'ten', text: `${self} = ${answer}: ett tiotal och ${answer - 10}.`, from: [] };
      return { kind: 'ten', text: `${x} är ett tiotal och ${x - 10}. ${self} = ${answer}.`, from: [] };
    case 'dubblor':
      return op === '+'
        ? { kind: 'double', text: `${self} = ${answer}: dubbelt så mycket som ${x}.`, from: [] }
        : { kind: 'double', text: `${self} = ${answer}: hälften av ${x}.`, from: [] };
    case 'tiokamrater':
      return { kind: 'pairToTen', text: `${a} och ${b} är tiokamrater: ${a} + ${b} = 10.`, from: [] };
    case 'naradubblor':
      if (op === '+') {
        return { kind: 'nearDouble', text: `${self} = ${a} + ${a} + 1 = ${2 * a} + 1 = ${answer}.`, from: [factId('+', a, a)] };
      }
      return sum > 10 ? overTenDown(f) : { kind: 'thinkPlus', text: `${self}: tänk ${y} + ${answer} = ${x}.`, from: [] };
    case 'overtio':
      return op === '+' ? overTenUp(f) : overTenDown(f);
    default:
      if (op === '+') return { kind: 'countOn', text: `${self}: räkna vidare från ${b}.`, from: [] };
      return { kind: 'thinkPlus', text: `${self}: tänk ${y} + ${answer} = ${x}.`, from: [] };
  }

  function overTenUp({ x, y, answer }: Fact) {
    const big = Math.max(x, y);
    const small = Math.min(x, y);
    if (big === 9) {
      return {
        kind: 'nine',
        text: `${self} = 10 + ${small} − 1 = ${10 + small} − 1 = ${answer}.`,
        // 16 − 1 is not one of the facts (terms go up to 10); it is the step on the path.
        from: [factId('+', 10, small)],
      };
    }
    const fill = 10 - big;
    return {
      kind: 'bridge',
      text: `${self} = ${big} + ${fill} + ${small - fill} = 10 + ${small - fill} = ${answer}.`,
      from: [factId('+', big, fill), factId('+', 10, small - fill)],
    };
  }

  function overTenDown({ x, y, answer }: Fact) {
    const ones = x - 10;
    // Close together: count up from what is taken away (12 − 9: 10, 11, 12).
    if (answer <= 3 && y >= 7) {
      return {
        kind: 'countUp',
        text: `${self}: räkna upp från ${y}. ${y} + ${10 - y} = 10, och ${ones} till är ${x}. Det är ${answer}.`,
        from: [factId('+', y, 10 - y), factId('+', 10, ones)],
      };
    }
    // Otherwise down to ten first (13 − 5 = 13 − 3 − 2).
    return {
      kind: 'downToTen',
      text: `${self} = ${x} − ${ones} − ${y - ones} = 10 − ${y - ones} = ${answer}.`,
      from: [factId('-', x, ones), factId('-', 10, y - ones)],
    };
  }
}

/**
 * Where the animal lands on the number line (J2: the landing points are read
 * aloud, not every stone): 8 + 5 is 8 → 10 → 13, 13 − 5 is 13 → 10 → 8,
 * and 12 − 9 counted up is 9 → 10 → 12.
 */
export function landings(f: Fact): { stops: number[]; up: boolean } {
  const { op, x, y, answer } = f;
  // Adding or taking away zero is no hop at all.
  const hops = (stops: number[], up: boolean) => ({ stops: stops.filter((n, i) => i === 0 || n !== stops[i - 1]), up });
  if (op === '+') {
    const big = Math.max(x, y);
    return crossesTen(f) ? hops([big, 10, answer], true) : hops([big, answer], true);
  }
  if (strategyFor(f).kind === 'countUp') return hops([y, 10, x], true);
  return crossesTen(f) ? hops([x, 10, answer], false) : hops([x, answer], false);
}

export function hintsFor(f: Fact): Hint[] {
  const strategy = strategyFor(f);
  const { a, b } = familyOf(f);
  const unit = unitOf(a, b);
  const hints: Hint[] = [
    { kind: 'strategy', text: strategy.text, data: { strategy: strategy.kind, from: strategy.from } },
    { kind: 'numberline', data: landings(f) },
  ];
  // Pairs that make ten and doubles are seen best in a ten frame (two rows of five).
  if (unit === 'tiokamrater' || unit === 'dubblor' || unit === 'naradubblor') hints.push({ kind: 'tenframe', data: { a, b } });
  return hints;
}

/** Every fact of the families with terms 0–10. */
export function buildFacts(): Item[] {
  const items: Item[] = [];
  for (let a = 0; a <= MAX_TERM; a++) {
    for (let b = a; b <= MAX_TERM; b++) {
      const sum = a + b;
      const unitId = unitOf(a, b);
      // Additions first (the larger term first, to count on from it), then subtractions.
      const members: Fact[] = [
        { op: '+', x: b, y: a, answer: sum },
        { op: '+', x: a, y: b, answer: sum },
        { op: '-', x: sum, y: a, answer: b },
        { op: '-', x: sum, y: b, answer: a },
      ];
      const seen = new Set<ItemId>();
      members.forEach((f, i) => {
        const id = factId(f.op, f.x, f.y);
        if (seen.has(id)) return;
        seen.add(id);
        const strategy = strategyFor(f);
        // The twin: the same calculation the other way round (8 + 5 and 5 + 8, 13 − 5 and 13 − 8).
        const twin = f.op === '+' ? factId('+', f.y, f.x) : factId('-', f.x, f.answer);
        items.push({
          id,
          prompt: formatFact(f.op, f.x, f.y),
          answer: String(f.answer),
          unitId,
          tags: [`family:${a},${b},${sum}`, `op:${f.op}`, ...(crossesTen(f) ? ['crossesTen'] : [])],
          derivedFrom: strategy.from,
          hints: hintsFor(f),
          ...(twin !== id ? { pairId: twin } : {}),
          // 0 + 0 and 0 − 0 last: a first fact should be about something.
          order: (sum === 0 ? 99 : sum) * 100 + a * 4 + i,
        });
      });
    }
  }
  return items;
}
