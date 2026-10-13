import type { DistractorCandidate } from '../../engine';

const MIN_CANDIDATES = 5;

/**
 * Plausible wrong answers for a × b, modelled on common confusions:
 * neighbouring products in the same table (6×8 vs 7×8), adding instead of
 * multiplying, reversed digits, and off-by-one/off-by-ten slips.
 */
export function multiplicationDistractors(a: number, b: number): DistractorCandidate[] {
  const ans = a * b;
  const out: DistractorCandidate[] = [];
  const add = (value: number, weight: number) => {
    if (Number.isInteger(value) && value > 0 && value !== ans && value <= 120) out.push({ value: String(value), weight });
  };

  // Neighbouring facts (one step away in either factor).
  for (const d of [-1, 1]) {
    add((a + d) * b, 3);
    add(a * (b + d), 3);
  }
  // Two steps away.
  for (const d of [-2, 2]) {
    add((a + d) * b, 1);
    add(a * (b + d), 1);
  }
  // Addition instead of multiplication.
  add(a + b, 2);
  // Reversed digits (54 ↔ 45).
  if (ans >= 10 && ans < 100) {
    const reversed = Number(String(ans).split('').reverse().join(''));
    if (reversed >= 10) add(reversed, 1.5);
  }
  // Counting slips.
  add(ans - 1, 0.7);
  add(ans + 1, 0.7);
  if (ans > 10) {
    add(ans - 10, 0.7);
    add(ans + 10, 0.7);
  }
  // Tiny products (1 × 1) have few natural confusions: fill with nearby numbers.
  for (let k = 2; new Set(out.map((c) => c.value)).size < MIN_CANDIDATES; k++) {
    add(ans + k, 0.3);
    add(ans - k, 0.3);
  }
  return out;
}
