import { describe, expect, it } from 'vitest';
import { emptyState, type ItemState } from '../../src/engine';
import { gardenMood, miniBed, MINI_BED_CELLS } from '../../src/game/valley';

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
    const states = record(at('a', 'learning', 0), at('b', 'automatic'), at('c', 'new'), at('d', 'fluent'), at('e', 'learning', 2));
    expect(miniBed(states)).toEqual(['tree', 'bush', 'sprout', 'seed', 'soil', 'soil', 'soil', 'soil']);
    expect(miniBed({})).toEqual(Array(MINI_BED_CELLS).fill('soil'));
  });

  it('never shows more plants than it has cells', () => {
    const many = record(...Array.from({ length: 30 }, (_, i) => at(`f${i}`, i < 3 ? 'automatic' : 'fluent')));
    expect(miniBed(many)).toEqual(['tree', 'tree', 'tree', 'bush', 'bush', 'bush', 'bush', 'bush']);
  });
});
