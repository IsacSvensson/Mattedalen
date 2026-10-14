import type { ItemId } from '../../engine';
import { formatFact, parseFactId, strategyFor } from './facts';

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
