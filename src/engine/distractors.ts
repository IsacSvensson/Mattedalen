import { shuffle, weightedPick, type Rng } from './clock';
import type { ContentPack, DistractorCandidate, Item, ItemState } from './types';

/** Extra weight for wrong answers this learner has given before. */
const CONFUSION_BASE_WEIGHT = 4;

const maxAnswers = new WeakMap<ContentPack, number | null>();

/** The largest number that answers an item in the pack (20 at the brook), or null when no answer is a number. */
export function maxAnswer(pack: ContentPack): number | null {
  if (!maxAnswers.has(pack)) {
    const numbers = pack.items.map((it) => Number(it.answer)).filter((n) => Number.isFinite(n));
    maxAnswers.set(pack, numbers.length ? Math.max(...numbers) : null);
  }
  return maxAnswers.get(pack) ?? null;
}

/**
 * Whether a wrong answer could be an answer at all in the pack
 * (docs/PLAN-MINUSTECKNET.md): words such as "ja" always, numbers from 0 up to
 * the pack's largest answer. "695" for 0 + 4 is a guess, not a mix-up.
 */
export function plausibleAnswer(pack: ContentPack, value: string): boolean {
  const n = Number(value);
  if (value.trim() === '' || !Number.isFinite(n)) return true;
  const max = maxAnswer(pack);
  return max === null || (n >= 0 && n <= max);
}

/** How many digits the number pad takes: those of the pack's largest answer (2 at the brook), else 3. */
export function answerDigits(pack: ContentPack): number {
  const max = maxAnswer(pack);
  return max === null ? 3 : String(max).length;
}

/**
 * Multiple-choice options: the correct answer plus `count - 1` plausible
 * wrong answers. The content pack proposes candidates; the learner's own
 * earlier mistakes are mixed in with a high weight so they get practised, but
 * only those that could be an answer at all: a guess picked again would
 * otherwise come back more and more often.
 */
export function buildChoices(pack: ContentPack, item: Item, state: ItemState | undefined, rng: Rng, count: number): string[] {
  const correct = pack.normalizeAnswer(item.answer);
  const pool = new Map<string, number>();
  const add = (c: DistractorCandidate) => {
    const v = pack.normalizeAnswer(c.value);
    if (v === '' || v === correct) return;
    pool.set(v, (pool.get(v) ?? 0) + c.weight);
  };
  for (const c of pack.distractorCandidates(item)) add(c);
  for (const [value, n] of Object.entries(state?.confusions ?? {})) if (plausibleAnswer(pack, value)) add({ value, weight: CONFUSION_BASE_WEIGHT + n });

  let candidates = [...pool.entries()];
  const picked: string[] = [];
  while (picked.length < count - 1 && candidates.length > 0) {
    const choice = weightedPick(rng, candidates, ([, w]) => w);
    if (!choice) break;
    picked.push(choice[0]);
    candidates = candidates.filter(([v]) => v !== choice[0]);
  }
  return shuffle(rng, [correct, ...picked]);
}
