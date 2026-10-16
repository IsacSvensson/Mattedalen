import type { DistractorCandidate } from '../../engine';
import { crossesTen, formatFact, type Fact } from './facts';

const MIN_CANDIDATES = 5;

/**
 * Plausible wrong answers, each from a known misconception:
 *
 * - ±1: counting the start stone too, or one hop short
 * - the other operation (8 − 5 for 8 + 5)
 * - reversed digits (12 for 21 or the other way)
 * - over ten: forgetting the ten (8 + 5 = 3), or one off at the ten (8 + 5 = 12)
 * - taking the smaller ones digit from the larger (13 − 5 = 12)
 */
export function additionDistractors(f: Fact): DistractorCandidate[] {
  const { op, x, y, answer } = f;
  const out: DistractorCandidate[] = [];
  const add = (value: number, weight: number) => {
    if (Number.isInteger(value) && value >= 0 && value <= 40 && value !== answer) out.push({ value: String(value), weight });
  };

  add(answer + 1, 3);
  add(answer - 1, 3);
  if (op === '+') {
    add(Math.abs(x - y), 2);
    if (crossesTen(f)) add(answer - 10, 2);
  } else {
    add(x + y, 2);
    const ones = x % 10;
    // 13 − 5: "5 − 3 = 2", written after the ten: 12.
    if (x > 10 && y > ones) add(10 + (y - ones), 2.5);
    if (crossesTen(f)) add(answer + 10, 1);
  }
  if (answer >= 10 && answer < 100) {
    const reversed = Number(String(answer).split('').reverse().join(''));
    if (reversed !== answer) add(reversed, 1.5);
  }
  add(answer + 2, 0.5);
  add(answer - 2, 0.5);
  for (let k = 3; new Set(out.map((c) => c.value)).size < MIN_CANDIDATES; k++) {
    add(answer + k, 0.3);
    add(answer - k, 0.3);
  }
  return out;
}

/** A short, kind note when a wrong answer is a typical mix-up; undefined otherwise. */
export function additionNote(f: Fact, given: string): string | undefined {
  const g = Number(given);
  const { op, x, y, answer } = f;
  if (given.trim() === '' || !Number.isInteger(g) || g === answer) return undefined;
  if (g === answer + 1 || g === answer - 1) return `${g} är ett ${g > answer ? 'för mycket' : 'för lite'} – nära!`;
  if (op === '+' && g === Math.abs(x - y)) return `${g} är ${formatFact('-', Math.max(x, y), Math.min(x, y))}. Här ska det vara plus.`;
  if (op === '-' && g === x + y) return `${g} är ${formatFact('+', x, y)}. Här ska det vara minus.`;
  if (op === '-' && x > 10 && y > x % 10 && g === 10 + (y - (x % 10)))
    return `${x % 10} räcker inte till ${y}. Gå ner till 10 först: ${x} − ${x % 10} = 10.`;
  if (op === '+' && crossesTen(f) && g === answer - 10) return `Glöm inte tiotalet: ${formatFact(op, x, y)} är mer än 10.`;
  return undefined;
}
