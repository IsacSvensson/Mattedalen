import { describe, expect, it } from 'vitest';
import { emptyState, type ItemState } from '../../src/engine';
import { gardenMood, miniBed, miniBedPlants, MINI_BED_CELLS } from '../../src/places/tradgarden/valley';

const at = (itemId: string, status: ItemState['status'], box = 0): ItemState => ({ ...emptyState(itemId), status, box });
const record = (...states: ItemState[]) => Object.fromEntries(states.map((s) => [s.itemId, s]));

describe('the garden on the valley map', () => {
  it('waits for its first seeds, is thirsty until the day is done, then sleeps', () => {
    expect(gardenMood(record(at('2x2', 'new')), false)).toBe('new');
    expect(gardenMood(record(at('2x2', 'new'), at('2x3', 'learning')), false)).toBe('thirsty');
    expect(gardenMood(record(at('2x3', 'automatic')), true)).toBe('asleep');
    expect(gardenMood({}, false)).toBe('new');
  });

  it('shows the furthest grown plants first, then dug earth', () => {
    const states = record(at('2x3', 'learning', 0), at('3x4', 'automatic'), at('4x5', 'new'), at('5x6', 'fluent'), at('6x7', 'learning', 2));
    expect(miniBed(states)).toEqual(['tree', 'bush', 'sprout', 'seed', 'soil', 'soil', 'soil', 'soil']);
    expect(miniBed({})).toEqual(Array(MINI_BED_CELLS).fill('soil'));
  });

  it('never shows more plants than it has cells', () => {
    const many = record(...Array.from({ length: 30 }, (_, i) => at(`${1 + (i % 10)}x${1 + Math.floor(i / 10)}`, i < 3 ? 'automatic' : 'fluent')));
    expect(miniBed(many)).toEqual(['tree', 'tree', 'tree', 'bush', 'bush', 'bush', 'bush', 'bush']);
  });

  it('shows delat med on the plants, fruit first, and only multiplications as plants', () => {
    // 3 × 7 is a bush with ripe fruit (21 ÷ 7 = 3 is automatic), 4 × 5 a bush with blossoms; 21/7 itself is no plant.
    const states = record(at('3x7', 'fluent'), at('21/7', 'automatic'), at('4x5', 'fluent'), at('20/5', 'learning'), at('2x2', 'learning', 0), at('share:share:6:2', 'fluent'));
    expect(miniBedPlants(states).slice(0, 4)).toEqual([
      { stage: 'bush', bloom: 'fruit' },
      { stage: 'bush', bloom: 'blossom' },
      { stage: 'seed', bloom: 'none' },
      { stage: 'soil', bloom: 'none' },
    ]);
    // A plant that dropped back to a sprout waits for its fruit until it has grown again.
    expect(miniBedPlants(record(at('3x7', 'learning', 2), at('21/7', 'automatic')))[0]).toEqual({ stage: 'sprout', bloom: 'none' });
  });
});
