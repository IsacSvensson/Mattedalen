import type { ItemId } from '../../engine';
import { halfSplit, strategyFor } from './items';
import { formatFact, onesOf, parseTaskId, taskAnswer, taskId, taskPrompt, tenAbove, tenBelow, type Task } from './tasks';

/**
 * Räknestigar for a hard task, as at the brook: start from what the child
 * knows and walk there in steps. Only the last step is the task itself.
 *
 * - over the ten: 47 + 3 = 50 → 50 + 5 → 47 + 8
 * - down to the ten: 52 − 2 = 50 → 50 − 4 → 52 − 6
 * - two-digit: 47 + 30 = 77 → 77 + 6 → 47 + 36
 * - doubles: 20 + 20 = 40 → 8 + 8 = 16 → 40 + 16 → 28 + 28
 * - halves: hälften av 40 → hälften av 16 → 20 + 8 → hälften av 56
 */
export interface DeriveStep {
  kind: 'known' | 'combine' | 'target';
  label: string;
  prompt: string;
  answer: number;
  /** The task used in a `known` step, when it is one of Stigen's (8 + 8 is the brook's). */
  itemId?: ItemId;
}

const known = (label: string, t: Task): DeriveStep => ({
  kind: 'known',
  label,
  prompt: stepPrompt(t),
  // The way up to a ten is worked out as 47 + 3, so its answer is the ten.
  answer: t.kind === 'next' ? tenAbove(t.n) : taskAnswer(t),
  itemId: taskId(t),
});
const fromBrook = (label: string, prompt: string, answer: number): DeriveStep => ({ kind: 'known', label, prompt, answer });
const combine = (label: string, prompt: string, answer: number): DeriveStep => ({ kind: 'combine', label, prompt, answer });

/** A step is a calculation to work out: the way up to a ten is shown as 47 + 3, not 47 + __ = 50. */
function stepPrompt(t: Task): string {
  if (t.kind === 'next') return formatFact('+', t.n, taskAnswer(t));
  return taskPrompt(t);
}

/** Steps for a task, or null when it has no path (it is learnt directly). */
export function derivationSteps(id: ItemId): DeriveStep[] | null {
  const t = parseTaskId(id);
  const answer = taskAnswer(t);
  const target: DeriveStep = { kind: 'target', label: 'Alltså', prompt: taskPrompt(t), answer };
  const kind = strategyFor(t).kind;

  if (t.kind === 'half') {
    if (t.n % 20 === 0) return null;
    const { tens, rest } = halfSplit(t.n);
    if (!tens) return null;
    return [
      known('Börja med tiotalen', { kind: 'half', n: tens }),
      fromBrook('Och resten', `hälften av ${rest}`, rest / 2),
      combine('Lägg ihop', formatFact('+', tens / 2, rest / 2), answer),
      target,
    ];
  }
  if (t.kind !== 'fact') return null;
  const { op, x, y } = t;
  switch (kind) {
    case 'bridge': {
      const fill = tenAbove(x) - x;
      return [known('Upp till tiotalet', { kind: 'next', n: x }), combine('Lägg till resten', formatFact('+', tenAbove(x), y - fill), answer), target];
    }
    case 'downToTen': {
      if (op !== '-' || y === onesOf(x)) return null;
      const ones = onesOf(x);
      return [known('Ner till tiotalet', { kind: 'fact', op: '-', x, y: ones }), combine('Ta resten', formatFact('-', tenBelow(x), y - ones), answer), target];
    }
    case 'jumpTens': {
      const tens = tenBelow(y);
      return [known('Hoppa tiotalen först', { kind: 'fact', op: '+', x, y: tens }), combine('Sedan entalen', formatFact('+', x + tens, onesOf(y)), answer), target];
    }
    case 'double': {
      const [tens, ones] = [tenBelow(x), onesOf(x)];
      return [
        known('Dubbla tiotalen', { kind: 'fact', op: '+', x: tens, y: tens }),
        fromBrook('Dubbla entalen', formatFact('+', ones, ones), 2 * ones),
        combine('Lägg ihop', formatFact('+', 2 * tens, 2 * ones), answer),
        target,
      ];
    }
    default:
      return null;
  }
}
