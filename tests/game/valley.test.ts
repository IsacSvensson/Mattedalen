import { describe, expect, it } from 'vitest';
import { emptyState, type ItemState } from '../../src/engine';
import { gardenMood } from '../../src/places/tradgarden/valley';

const at = (itemId: string, status: ItemState['status'], box = 0): ItemState => ({ ...emptyState(itemId), status, box });
const record = (...states: ItemState[]) => Object.fromEntries(states.map((s) => [s.itemId, s]));

describe('the garden in the valley', () => {
  it('waits for its first seeds, is thirsty until the day is done, then sleeps', () => {
    expect(gardenMood(record(at('2x2', 'new')), false)).toBe('new');
    expect(gardenMood(record(at('2x2', 'new'), at('2x3', 'learning')), false)).toBe('thirsty');
    expect(gardenMood(record(at('2x3', 'automatic')), true)).toBe('asleep');
    expect(gardenMood({}, false)).toBe('new');
  });
});
