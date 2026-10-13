import { shuffle, weightedPick, type Rng } from './clock';
import type { ContentPack, DistractorCandidate, Item, ItemState } from './types';

/** Extra weight for wrong answers this learner has given before. */
const CONFUSION_BASE_WEIGHT = 4;

/**
 * Multiple-choice options: the correct answer plus `count - 1` plausible
 * wrong answers. The content pack proposes candidates; the learner's own
 * earlier mistakes are mixed in with a high weight so they get practised.
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
  for (const [value, n] of Object.entries(state?.confusions ?? {})) add({ value, weight: CONFUSION_BASE_WEIGHT + n });

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
