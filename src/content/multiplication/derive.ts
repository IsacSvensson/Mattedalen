import type { ItemId } from '../../engine';
import { anchorGivesAway, divisionId, divisionStrategy, formatDivision, isDivisionId, parseDivisionId, pathAnchor } from './division';
import { factId, formatFact, parseFactId, strategyFor } from './facts';

/**
 * A derivation path ("räknestig") for a hard fact: start from facts the child
 * knows, combine them, and arrive at the fact itself, e.g. for 6 × 7:
 * 5 × 7 = 35 → 35 + 7 = 42 → 6 × 7 = 42.
 */
export interface DeriveStep {
  kind: 'known' | 'combine' | 'target';
  /** Short instruction shown above the step. */
  label: string;
  prompt: string;
  answer: number;
  /** The known fact used in a `known` step. */
  itemId?: ItemId;
}

const COMBINE: Record<string, (known: number[], answer: number) => { label: string; prompt: string } | null> = {
  plusGroup: ([k = 0], ans) => ({ label: 'Lägg till en grupp till', prompt: `${k} + ${ans - k}` }),
  split: (known) => ({ label: 'Lägg ihop', prompt: known.join(' + ') }),
  doubleOf: ([k = 0]) => ({ label: 'Dubbla', prompt: `${k} + ${k}` }),
  minusGroup: ([k = 0], ans) => ({ label: 'Ta bort en grupp', prompt: `${k} − ${k - ans}` }),
  halfOfTen: ([k = 0]) => ({ label: 'Ta hälften', prompt: `hälften av ${k}` }),
};

/** Steps for a × b, or null when the fact has no derivation from other facts (×1, ×2, ×10). */
export function derivationSteps(a: number, b: number): DeriveStep[] | null {
  const strategy = strategyFor(a, b);
  const combine = COMBINE[strategy.kind];
  if (!combine || strategy.from.length === 0) return null;
  const answer = a * b;
  const known: DeriveStep[] = strategy.from.map((id) => {
    const f = parseFactId(id);
    return { kind: 'known', label: 'Börja med det du kan', prompt: formatFact(f.a, f.b), answer: f.a * f.b, itemId: id };
  });
  const step = combine(
    known.map((k) => k.answer),
    answer,
  );
  if (!step) return null;
  if (known.length > 1) known[1] = { ...(known[1] as DeriveStep), label: 'Och det här kan du också' };
  return [...known, { kind: 'combine', ...step, answer }, { kind: 'target', label: 'Alltså', prompt: formatFact(a, b), answer }];
}

/**
 * A derivation path for ab ÷ b: count groups of b from a fact the child knows,
 * e.g. for 42 ÷ 6: 5 × 6 = 30 → 30 + 6 + 6 = 42 → 42 ÷ 6 = 7 (two more than
 * five groups). No prompt shows the answer before the last step. Null when the known
 * fact would give the answer away (÷ 1, ÷ 10, quotient 1, 2, 5 or 10).
 */
export function divisionDerivationSteps(id: ItemId): DeriveStep[] | null {
  const { dividend: ab, divisor: b, quotient: a } = parseDivisionId(id);
  const target: DeriveStep = { kind: 'target', label: 'Alltså, hur många grupper?', prompt: formatDivision(ab, b), answer: a };
  const strategy = divisionStrategy(a, b).kind;

  if (strategy === 'half') return [{ kind: 'combine', label: 'Ta hälften', prompt: `hälften av ${ab}`, answer: a }, { ...target, label: 'Alltså' }];
  if (strategy === 'viaTen') {
    const tens = ab / 10;
    return [
      { kind: 'known', label: 'Börja med det du kan', prompt: formatDivision(ab, 10), answer: tens, itemId: divisionId(ab, 10) },
      { kind: 'combine', label: 'Femmorna är dubbelt så många', prompt: `${tens} + ${tens}`, answer: a },
      { ...target, label: 'Alltså' },
    ];
  }
  if (strategy !== 'thinkTimes' || anchorGivesAway(a)) return null;

  // From 2, 5 or 10 groups, add or take away one group at a time.
  const from = pathAnchor(a);
  const groups = Math.abs(a - from);
  const sign = a > from ? '+' : '−';
  const known: DeriveStep = { kind: 'known', label: 'Börja med det du kan', prompt: formatFact(from, b), answer: from * b, itemId: factId(from, b) };
  const label = a > from ? (groups === 1 ? 'Lägg till en grupp till' : 'Lägg till två grupper till') : groups === 1 ? 'Ta bort en grupp' : 'Ta bort två grupper';
  return [known, { kind: 'combine', label, prompt: [from * b, ...Array<number>(groups).fill(b)].join(` ${sign} `), answer: ab }, target];
}

/** The path for any item of the pack: a multiplication or a division. */
export function derivationStepsFor(id: ItemId): DeriveStep[] | null {
  if (isDivisionId(id)) return divisionDerivationSteps(id);
  if (!/^\d+x\d+$/.test(id)) return null;
  const { a, b } = parseFactId(id);
  return derivationSteps(a, b);
}
