import { describe, expect, it } from 'vitest';
import { emptyState, type ItemState } from '../../src/engine';
import { divisionsOfTable } from '../../src/content/multiplication';
import { bloomFor } from '../../src/shell/components/plant';
import { harvestTables } from '../../src/places/tradgarden/division';
import { canChallenge, challengePool, duelPool } from '../../src/places/tradgarden/challenge';

const at = (itemId: string, status: ItemState['status']): ItemState => ({ ...emptyState(itemId), status, box: 3 });
const record = (...states: ItemState[]) => Object.fromEntries(states.map((s) => [s.itemId, s]));

describe('delat med in the garden', () => {
  it('grows blossoms while a division is practised, kart once it sits and ripe fruit once it is automatic', () => {
    expect(bloomFor(undefined)).toBe('none');
    expect(bloomFor(at('21/3', 'new'))).toBe('none');
    expect(bloomFor(at('21/3', 'learning'))).toBe('blossom');
    expect(bloomFor(at('21/3', 'fluent'))).toBe('kart');
    expect(bloomFor(at('21/3', 'automatic'))).toBe('fruit');
  });

  it('gives a table its harvest basket when all delat med in its squares sits', () => {
    const seven = divisionsOfTable(7);
    // Row 7 and column 7: 7 ÷ 1 … 70 ÷ 10, 7 ÷ 7 … 70 ÷ 7, with 49 ÷ 7 once.
    expect(seven).toHaveLength(19);
    expect(seven).toEqual(expect.arrayContaining(['21/3', '21/7', '49/7', '70/10', '70/7']));
    const states = record(...seven.map((id) => at(id, 'fluent')));
    expect(harvestTables(states).has(7)).toBe(true);
    expect(harvestTables({ ...states, '21/3': at('21/3', 'learning') }).has(7)).toBe(false);
    expect(harvestTables({}).size).toBe(0);
  });

  it('keeps Slå rekord and Mot en vuxen to the multiplications for now', () => {
    const states = record(at('3x7', 'fluent'), at('21/3', 'automatic'), at('share:share:6:2', 'fluent'), at('7x3', 'learning'));
    expect(challengePool(states)).toEqual(['3x7']);
    expect(duelPool(states)).toEqual(['3x7', '7x3']);
    const divisionsOnly = record(...['10/2', '20/2', '30/3', '40/4', '50/5', '60/6'].map((id) => at(id, 'automatic')));
    expect(canChallenge(divisionsOnly)).toBe(false);
  });
});
