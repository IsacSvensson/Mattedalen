import { describe, expect, it } from 'vitest';
import { createAdditionPack } from '../../src/content/addition';
import { createHundredPack } from '../../src/content/hundred';
import { createMultiplicationPack } from '../../src/content/multiplication';

/** Words beside the numbers and signs: what a child has to read (docs/PLAN-ENKLARE.md, E3). */
const words = (text: string) => (text.match(/[A-Za-zÅÄÖåäö]+/g) ?? []).length;

/** Measured in E3: no way to think had more than 8 such words, once the baskets in the garden were shortened. */
const MOST_WORDS = 8;

describe('ways to think are short to read', () => {
  for (const [place, pack] of [
    ['Bäcken', createAdditionPack()],
    ['Stigen', createHundredPack()],
    ['Trädgården', createMultiplicationPack({ division: true })],
  ] as const) {
    it(`${place}: at most ${MOST_WORDS} words beside the numbers`, () => {
      const long = pack.items
        .map((i) => i.hints.find((x) => x.kind === 'strategy')?.text)
        .filter((t): t is string => !!t && words(t) > MOST_WORDS);
      expect(long).toEqual([]);
    });
  }
});
