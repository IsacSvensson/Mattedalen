import type { ItemId } from '../../engine';
import { factId, formatFact, parseFactId, strategyFor, type Fact } from './facts';

/**
 * Derivation paths ("räknestigar") for a hard fact: start from what the child
 * knows and walk there in steps. Only the last step is the answer to the
 * question; it does not count as evidence, and the fact comes back later
 * without help.
 *
 * - over ten: 8 + 2 = 10 → 10 + 3 → 8 + 5
 * - nine plus: 10 + 6 → 16 − 1 → 9 + 6
 * - near doubles: 6 + 6 → 12 + 1 → 6 + 7
 * - down to ten: 13 − 3 = 10 → 10 − 2 → 13 − 5
 * - count up, when the numbers are close: 9 + 1 = 10 → 10 + 2 = 12 → 1 + 2 → 12 − 9
 */
export interface DeriveStep {
  kind: 'known' | 'combine' | 'target';
  label: string;
  prompt: string;
  answer: number;
  itemId?: ItemId;
}

const known = (label: string, op: '+' | '-', x: number, y: number): DeriveStep => ({
  kind: 'known',
  label,
  prompt: formatFact(op, x, y),
  answer: op === '+' ? x + y : x - y,
  itemId: factId(op, x, y),
});

const combine = (label: string, op: '+' | '-', x: number, y: number): DeriveStep => ({
  kind: 'combine',
  label,
  prompt: formatFact(op, x, y),
  answer: op === '+' ? x + y : x - y,
});

/** Steps for a fact, or null when it has no path (it is learnt directly). */
export function derivationSteps(id: ItemId): DeriveStep[] | null {
  const f: Fact = parseFactId(id);
  const target: DeriveStep = { kind: 'target', label: 'Alltså', prompt: formatFact(f.op, f.x, f.y), answer: f.answer };
  const { x, y } = f;
  switch (strategyFor(f).kind) {
    case 'bridge': {
      const big = Math.max(x, y);
      const small = Math.min(x, y);
      const fill = 10 - big;
      return [known('Fyll upp till tio', '+', big, fill), combine('Lägg till resten', '+', 10, small - fill), target];
    }
    case 'nine': {
      const small = Math.min(x, y);
      return [known('Tänk tio i stället för nio', '+', 10, small), combine('Ta bort en', '-', 10 + small, 1), target];
    }
    case 'nearDouble': {
      const a = Math.min(x, y);
      return [known('Börja med dubblan', '+', a, a), combine('En till', '+', 2 * a, 1), target];
    }
    case 'downToTen': {
      const ones = x - 10;
      return [known('Ner till tio', '-', x, ones), combine('Ta resten', '-', 10, y - ones), target];
    }
    case 'countUp': {
      const ones = x - 10;
      return [
        known('Upp till tio', '+', y, 10 - y),
        known(`Upp till ${x}`, '+', 10, ones),
        combine('Lägg ihop hoppen', '+', 10 - y, ones),
        target,
      ];
    }
    default:
      return null;
  }
}
