import type { DistractorCandidate, Hint, Item, ItemId } from '../../engine';
import { factId, MAX_FACTOR, MIN_FACTOR, unitFor } from './facts';

/**
 * Delat med in the garden (see docs/PLAN-DELAT-MED.md). Every square of the
 * bed holds a multiplication and its division: square a × b also holds
 * ab ÷ b = a (square 3 × 7 holds 21 ÷ 7 = 3). A family {3, 7, 21} is the two
 * mirrored squares, with 3 × 7, 7 × 3, 21 ÷ 3 and 21 ÷ 7.
 *
 * A division is introduced only when both multiplications of its family are
 * fluent (`requires`), and only after the understanding part "Dela lika".
 */

/** `21/3` is 21 divided by 3. */
export function divisionId(dividend: number, divisor: number): ItemId {
  return `${dividend}/${divisor}`;
}

export const isDivisionId = (id: ItemId) => /^\d+\/\d+$/.test(id);

export function parseDivisionId(id: ItemId): { dividend: number; divisor: number; quotient: number } {
  const m = /^(\d+)\/(\d+)$/.exec(id);
  if (!m) throw new Error(`Not a division fact id: ${id}`);
  const dividend = Number(m[1]);
  const divisor = Number(m[2]);
  return { dividend, divisor, quotient: dividend / divisor };
}

/** The canonical prompt; the screens draw it with the child's sign (fraction bar by default). */
export function formatDivision(dividend: number, divisor: number): string {
  return `${dividend} ÷ ${divisor}`;
}

/** The division in square a × b: ab ÷ b = a. */
export const divisionInSquare = (a: number, b: number) => divisionId(a * b, b);

/** The divisions in the squares of one table (row t and column t of the bed): 7 ÷ 1 … 70 ÷ 10 and 7 ÷ 7 … 70 ÷ 7. */
export function divisionsOfTable(t: number): ItemId[] {
  const ids = new Set<ItemId>();
  for (let n = MIN_FACTOR; n <= MAX_FACTOR; n++) {
    ids.add(divisionInSquare(t, n));
    ids.add(divisionInSquare(n, t));
  }
  return [...ids];
}

/** The division units follow the multiplication units: a family belongs to the first table it is in. */
export const DIVISION_UNIT_DEFS = [
  { id: 'd2', title: 'Dela med 2', of: 'u2' },
  { id: 'd10', title: 'Dela med 10', of: 'u10' },
  { id: 'd5', title: 'Dela med 5', of: 'u5' },
  { id: 'd1', title: 'Dela med 1', of: 'u1' },
  { id: 'd4', title: 'Dela med 4', of: 'u4' },
  { id: 'd3', title: 'Dela med 3', of: 'u3' },
  { id: 'dsq', title: 'Kvadrattal delat med', of: 'usq' },
  { id: 'd9', title: 'Dela med 9', of: 'u9' },
  { id: 'd6', title: 'Dela med 6', of: 'u6' },
  { id: 'd78', title: 'Dela med 7 och 8', of: 'u78' },
] as const;

const divisionUnitOf = (multUnit: string) => DIVISION_UNIT_DEFS.find((d) => d.of === multUnit)!.id;

/** How to think about ab ÷ b: think multiplication, halve, or go via ten. */
export function divisionStrategy(a: number, b: number): { kind: string; text: string; from: ItemId[] } {
  const ab = a * b;
  const div = formatDivision(ab, b);
  if (b === 1) return { kind: 'one', text: `${div} = ${a}: ${a} delat i en grupp är ${a}.`, from: [factId(a, 1)] };
  if (a === 1) return { kind: 'self', text: `${div} = 1: ett tal delat med sig självt blir 1.`, from: [factId(1, b)] };
  if (b === 10) return { kind: 'ten', text: `${div} = ${a}: ${ab} är ${a} tiotal.`, from: [factId(a, 10)] };
  if (b === 2) return { kind: 'half', text: `${div} = ${a}: hälften av ${ab} är ${a}.`, from: [factId(a, 2)] };
  if (b === 5 && ab % 10 === 0)
    return {
      kind: 'viaTen',
      text: `${div} = ${a}: ${ab} ÷ 10 = ${ab / 10}, och femmorna är dubbelt så många: ${a}.`,
      from: [factId(ab / 10, 10)],
    };
  return { kind: 'thinkTimes', text: `${div} = ${a}: tänk gånger. ${a} × ${b} = ${ab}.`, from: [factId(a, b)] };
}

/** Where a derivation path for ab ÷ b counts groups from: 2, 5 or 10 groups of b. */
export const pathAnchor = (a: number) => (a < 5 ? 2 : a < 8 ? 5 : 10);

/** Whether the path's known fact would give the answer away (quotient 1, 2, 5 or 10). */
export const anchorGivesAway = (a: number) => [1, 2, 5, 10].includes(a);

/** The facts a derivation path for ab ÷ b starts from (see `divisionDerivationSteps`). */
export function divisionPathFrom(a: number, b: number): ItemId[] {
  const s = divisionStrategy(a, b);
  if (s.kind === 'viaTen') return [divisionId(a * b, 10)];
  if (s.kind === 'thinkTimes' && !anchorGivesAway(a)) return [factId(pathAnchor(a), b)];
  return s.from;
}

function divisionHints(a: number, b: number): Hint[] {
  const s = divisionStrategy(a, b);
  return [
    { kind: 'strategy', text: s.text, data: { strategy: s.kind, from: s.from } },
    // The rectangle of a × b, split into rows: ab dots in b columns, a in each.
    { kind: 'array', data: { rows: a, cols: b } },
  ];
}

/** The 100 divisions, one per square, in the same units and order as the multiplications. */
export function buildDivisions(): Item[] {
  const items: Item[] = [];
  for (let a = MIN_FACTOR; a <= MAX_FACTOR; a++) {
    for (let b = MIN_FACTOR; b <= MAX_FACTOR; b++) {
      const id = divisionInSquare(a, b);
      const family = a === b ? [factId(a, b)] : [factId(a, b), factId(b, a)];
      items.push({
        id,
        prompt: formatDivision(a * b, b),
        answer: String(a),
        unitId: divisionUnitOf(unitFor(a, b).id),
        tags: ['division', `divisor:${b}`, `a:${a}`, `b:${b}`],
        derivedFrom: divisionPathFrom(a, b),
        hints: divisionHints(a, b),
        // 21 ÷ 3 and 21 ÷ 7 are twins, as 3 × 7 and 7 × 3 are.
        pairId: a === b ? undefined : divisionInSquare(b, a),
        requires: family,
        order: Math.min(a, b) * 2 + (a < b ? 0 : 1),
      });
    }
  }
  return items;
}

/** Wrong answers children typically give to ab ÷ b. */
export function divisionDistractors(dividend: number, divisor: number): DistractorCandidate[] {
  const q = dividend / divisor;
  const out: DistractorCandidate[] = [];
  const add = (value: number, weight: number) => {
    if (Number.isInteger(value) && value > 0 && value !== q && value <= 120 && !out.some((c) => c.value === String(value))) {
      out.push({ value: String(value), weight });
    }
  };
  // Neighbouring facts in the same table.
  add(q - 1, 3);
  add(q + 1, 3);
  add(q - 2, 1);
  add(q + 2, 1);
  // The divisor itself, taking away, and multiplying instead.
  add(divisor, 2);
  add(dividend - divisor, 1);
  add(dividend * divisor, 0.5);
  return out;
}

/** A friendly word for the typical mix-ups. */
export function divisionNote(dividend: number, divisor: number, given: string): string | undefined {
  const g = Number(given);
  const q = dividend / divisor;
  if (g === divisor && divisor !== q) return `${g} är det vi delar med. Hur många blir det i varje grupp?`;
  if (g === dividend - divisor) return `${g} är ${dividend} − ${divisor}. Här delar vi ${dividend} lika i ${divisor} grupper.`;
  if (g === dividend * divisor) return `${g} är ${dividend} × ${divisor}. Delat med blir mindre: ${dividend} lika i ${divisor} grupper.`;
  if (Math.abs(g - q) === 1) return `${g} är ett för ${g > q ? 'mycket' : 'lite'} – nära!`;
  return undefined;
}

/**
 * "Dela lika": what dividing means, before the first division fact. Two kinds,
 * both needed, since children mostly meet the first:
 * - sharing: 12 strawberries shared equally in 3 baskets – how many in each?
 * - grouping: 12 strawberries, 4 in each basket – how many baskets?
 */
export interface ShareTask {
  kind: 'share' | 'group';
  total: number;
  /** Baskets (share) or berries in each basket (group). */
  by: number;
  answer: number;
}

export const SHARE_TASKS: ShareTask[] = (
  [
    ['share', 6, 2],
    ['group', 6, 3],
    ['share', 8, 2],
    ['group', 8, 4],
    ['share', 9, 3],
    ['group', 10, 5],
    ['share', 12, 3],
    ['group', 12, 4],
    ['share', 10, 2],
    ['group', 15, 5],
    ['share', 12, 4],
    ['group', 12, 3],
    ['share', 15, 3],
    ['group', 16, 4],
    ['share', 20, 5],
    ['group', 18, 6],
  ] as const
).map(([kind, total, by]) => ({ kind, total, by, answer: total / by }));

export const shareId = (t: ShareTask) => `share:${t.kind}:${t.total}:${t.by}`;
export const isShareId = (id: ItemId) => id.startsWith('share:');

export function shareText(t: ShareTask): string {
  return t.kind === 'share'
    ? `${t.total} jordgubbar delas lika i ${t.by} korgar. Hur många i varje korg?`
    : `${t.total} jordgubbar, ${t.by} i varje korg. Hur många korgar?`;
}

/** The share tasks as items of the understanding unit `delalika`. */
export function buildShareItems(): Item[] {
  return SHARE_TASKS.map((t, order) => ({
    id: shareId(t),
    prompt: shareText(t),
    answer: String(t.answer),
    unitId: 'delalika',
    tags: [`share:${t.kind}`],
    derivedFrom: [],
    hints: [
      { kind: 'share', data: t },
      {
        kind: 'strategy',
        text:
          t.kind === 'share'
            ? `Lägg en i taget i varje korg tills det är slut: ${t.answer} i varje.`
            : `Fyll en korg i taget med ${t.by}: det blir ${t.answer} korgar.`,
      },
    ],
    formats: ['choice'],
    order,
  }));
}
