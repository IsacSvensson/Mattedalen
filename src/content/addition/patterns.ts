import type { ItemId } from '../../engine';
import { formatFact, parseFactId } from './facts';

/**
 * Plus read for minus (docs/PLAN-MINUSTECKNET.md): a child who answers the sum
 * on minus facts ("2 − 1 = 3", "4 − 1 = 5") has most likely not met the minus
 * sign yet. One slip is not the pattern; so many different facts are.
 */
export const PLUS_FOR_MINUS_FACTS = 3;

/** How far back the answers are looked at; the pattern goes by itself when the child stops. */
export const PLUS_FOR_MINUS_DAYS = 14;

const MINUS_FACT = /^\d+-\d+$/;

/**
 * The minus facts answered with the sum of their numbers, newest first, once
 * each, with the answer given ("2 − 1 blev 3"). Minus 0 does not count: 5 − 0
 * and 5 + 0 are the same number.
 */
export function plusForMinus(attempts: readonly { itemId: ItemId; given: string; correct: boolean; ts: number }[]): { itemId: ItemId; text: string }[] {
  const out = new Map<ItemId, string>();
  for (const a of [...attempts].sort((x, y) => y.ts - x.ts)) {
    if (a.correct || out.has(a.itemId) || !MINUS_FACT.test(a.itemId)) continue;
    const f = parseFactId(a.itemId);
    if (f.y === 0 || Number(a.given) !== f.x + f.y) continue;
    out.set(a.itemId, `${formatFact('-', f.x, f.y)} blev ${f.x + f.y}`);
  }
  return [...out].map(([itemId, text]) => ({ itemId, text }));
}
