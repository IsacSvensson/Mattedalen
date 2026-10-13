import type { Hint, Item, ItemId } from '../../engine';

/** The grid covers 1–10 × 1–10 (×0 is intentionally left out). */
export const MIN_FACTOR = 1;
export const MAX_FACTOR = 10;

/** `a × b` is read as "a groups of b" and drawn as a rows × b columns. */
export function factId(a: number, b: number): ItemId {
  return `${a}x${b}`;
}

export function parseFactId(id: ItemId): { a: number; b: number } {
  const m = /^(\d+)x(\d+)$/.exec(id);
  if (!m) throw new Error(`Not a multiplication fact id: ${id}`);
  return { a: Number(m[1]), b: Number(m[2]) };
}

export function formatFact(a: number, b: number): string {
  return `${a} × ${b}`;
}

/**
 * Unit progression, following the research summary: the "free" tables first
 * (×10, ×2, ×5, ×1), then tables derived from them (×4 = double ×2,
 * ×3 = ×2 plus one group), the squares, ×9 (= ×10 minus one group),
 * ×6 (= ×5 plus one group) and last the remaining 7×8 / 8×7.
 *
 * Each fact belongs to the first unit whose table factor it contains, so
 * 3×7 is learnt with ×3 and 7×9 with ×9.
 */
export const UNIT_DEFS = [
  { id: 'u10', title: '×10', table: 10 },
  { id: 'u2', title: '×2', table: 2 },
  { id: 'u5', title: '×5', table: 5 },
  { id: 'u1', title: '×1', table: 1 },
  { id: 'u4', title: '×4', table: 4 },
  { id: 'u3', title: '×3', table: 3 },
  { id: 'usq', title: 'Kvadrattal', table: 'square' },
  { id: 'u9', title: '×9', table: 9 },
  { id: 'u6', title: '×6', table: 6 },
  { id: 'u78', title: '×7 och ×8', table: 8 },
] as const;

export type UnitDef = (typeof UNIT_DEFS)[number];

export function unitFor(a: number, b: number): UnitDef {
  for (const def of UNIT_DEFS) {
    if (def.table === 'square') {
      if (a === b) return def;
    } else if (a === def.table || b === def.table) {
      return def;
    }
  }
  return UNIT_DEFS[UNIT_DEFS.length - 1] as UnitDef;
}

/** The factor the fact is "in the table of", and the other factor. */
export function tableAndOther(a: number, b: number): { table: number; other: number; tableFirst: boolean } {
  const def = unitFor(a, b);
  const table = def.table === 'square' ? a : def.table;
  const tableFirst = a === table;
  return { table, other: tableFirst ? b : a, tableFirst };
}

/**
 * How the strategy splits the rectangle, along the side of the table factor:
 * 8 × 7 = dubbla 4 × 7 is rows [4, 4]; 9 × 6 = 10 × 6 − 6 is rows [9, 1]
 * drawn as 10 rows where the last part is taken away (`removeLast`).
 */
export interface ArrayParts {
  axis: 'rows' | 'cols';
  sizes: number[];
  removeLast?: boolean;
}

export interface Strategy {
  kind: string;
  text: string;
  from: ItemId[];
  parts?: ArrayParts;
}

/**
 * Derivation of a fact from easier, already known facts, written as a short
 * Swedish sentence, e.g. "8 × 7 = dubbla 4 × 7 = 28 + 28 = 56".
 */
export function strategyFor(a: number, b: number): Strategy {
  const ans = a * b;
  const { table, other: o, tableFirst } = tableAndOther(a, b);
  // The same fact with the table factor replaced, keeping operand positions.
  const e = (t: number) => (tableFirst ? formatFact(t, o) : formatFact(o, t));
  const id = (t: number) => (tableFirst ? factId(t, o) : factId(o, t));
  const self = formatFact(a, b);
  const axis = tableFirst ? 'rows' : 'cols';
  const parts = (sizes: number[], removeLast?: boolean): ArrayParts => (removeLast ? { axis, sizes, removeLast } : { axis, sizes });

  if (unitFor(a, b).table === 'square') {
    switch (a) {
      case 6:
        return { kind: 'plusGroup', text: `6 × 6 = 5 × 6 + 6 = 30 + 6 = 36`, from: [factId(5, 6)], parts: parts([5, 1]) };
      case 7:
        return { kind: 'split', text: `7 × 7 = 5 × 7 + 2 × 7 = 35 + 14 = 49`, from: [factId(5, 7), factId(2, 7)], parts: parts([5, 2]) };
      case 8:
        return { kind: 'doubleOf', text: `8 × 8 = dubbla 4 × 8 = 32 + 32 = 64`, from: [factId(4, 8)], parts: parts([4, 4]) };
      default:
        return { kind: 'minusGroup', text: `9 × 9 = 10 × 9 − 9 = 90 − 9 = 81`, from: [factId(10, 9)], parts: parts([9, 1], true) };
    }
  }

  switch (table) {
    case 10:
      return { kind: 'tens', text: `${self} = ${o} tiotal = ${ans}`, from: [] };
    case 1:
      return {
        kind: 'ones',
        text: tableFirst ? `${self}: en grupp med ${o} = ${ans}` : `${self}: ${o} grupper med 1 = ${ans}`,
        from: [],
      };
    case 2:
      return { kind: 'double', text: `${self} = ${o} + ${o} = ${ans}`, from: [], parts: parts([1, 1]) };
    case 5:
      return { kind: 'halfOfTen', text: `${self} = hälften av ${e(10)} = hälften av ${10 * o} = ${ans}`, from: [id(10)], parts: parts([5, 5], true) };
    case 4:
      return { kind: 'doubleOf', text: `${self} = dubbla ${e(2)} = ${2 * o} + ${2 * o} = ${ans}`, from: [id(2)], parts: parts([2, 2]) };
    case 3:
      return { kind: 'plusGroup', text: `${self} = ${e(2)} + ${o} = ${2 * o} + ${o} = ${ans}`, from: [id(2)], parts: parts([2, 1]) };
    case 9:
      return { kind: 'minusGroup', text: `${self} = ${e(10)} − ${o} = ${10 * o} − ${o} = ${ans}`, from: [id(10)], parts: parts([9, 1], true) };
    case 6:
      return { kind: 'plusGroup', text: `${self} = ${e(5)} + ${o} = ${5 * o} + ${o} = ${ans}`, from: [id(5)], parts: parts([5, 1]) };
    case 8:
      return { kind: 'doubleOf', text: `${self} = dubbla ${e(4)} = ${4 * o} + ${4 * o} = ${ans}`, from: [id(4)], parts: parts([4, 4]) };
    default:
      throw new Error(`No strategy for ${self}`);
  }
}

export function hintsFor(a: number, b: number): Hint[] {
  const strategy = strategyFor(a, b);
  const hints: Hint[] = [
    { kind: 'strategy', text: strategy.text, data: { strategy: strategy.kind, from: strategy.from, parts: strategy.parts } },
    { kind: 'array', data: { rows: a, cols: b } },
  ];
  if (a !== b) {
    hints.push({
      kind: 'swap',
      text: `${formatFact(a, b)} är lika mycket som ${formatFact(b, a)}`,
      data: { pairId: factId(b, a) },
    });
  }
  return hints;
}

export function buildFacts(): Item[] {
  const items: Item[] = [];
  for (let a = MIN_FACTOR; a <= MAX_FACTOR; a++) {
    for (let b = MIN_FACTOR; b <= MAX_FACTOR; b++) {
      const unit = unitFor(a, b);
      const { table, other, tableFirst } = tableAndOther(a, b);
      const strategy = strategyFor(a, b);
      const tags = [`table:${table}`, `a:${a}`, `b:${b}`];
      if (a === b) tags.push('square');
      items.push({
        id: factId(a, b),
        prompt: formatFact(a, b),
        answer: String(a * b),
        unitId: unit.id,
        tags,
        derivedFrom: strategy.from,
        hints: hintsFor(a, b),
        pairId: a === b ? undefined : factId(b, a),
        // Smaller "other" factor first; "o × table" (how Swedish tables are
        // usually recited, e.g. 3 · 2) before its mirror.
        order: other * 2 + (tableFirst ? 1 : 0),
      });
    }
  }
  return items;
}

/**
 * A short, kind note when a wrong answer is a typical confusion: the product
 * of a neighbouring fact ("48 är 6 × 8 – nära!") or the sum instead of the
 * product. Returns undefined for other wrong answers.
 */
export function confusionNote(a: number, b: number, given: string): string | undefined {
  const g = Number(given);
  if (!Number.isInteger(g) || g === a * b) return undefined;
  const neighbours: [number, number][] = [
    [a - 1, b],
    [a + 1, b],
    [a, b - 1],
    [a, b + 1],
  ];
  for (const [x, y] of neighbours) {
    if (x >= 1 && y >= 1 && x <= MAX_FACTOR && y <= MAX_FACTOR && x * y === g) return `${g} är ${formatFact(x, y)} – nära!`;
  }
  if (g === a + b) return `${g} är ${a} + ${b}. Här ska det vara ${a} gånger ${b}.`;
  return undefined;
}
