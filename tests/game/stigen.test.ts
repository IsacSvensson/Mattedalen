import { describe, expect, it } from 'vitest';
import { emptyState, type ItemState } from '../../src/engine';
import { createHundredPack } from '../../src/content/hundred';
import { currentPart, LIT_AT, litCount } from '../../src/places/stigen/components/trail';
import { lanterns, partProgress, pathMood } from '../../src/places/stigen/logic';

const pack = createHundredPack();
const at = (itemId: string, status: ItemState['status']): ItemState => ({ ...emptyState(itemId), status });
const unit = (id: string) => pack.units.find((u) => u.id === id)!.itemIds;

describe('Stigen without the DOM', () => {
  it('waits for its first lanterns, has something to show until the day is done, then rests', () => {
    expect(pathMood({}, false)).toBe('new');
    expect(pathMood({ 'tens:3': at('tens:3', 'learning') }, false)).toBe('thirsty');
    expect(pathMood({ 'tens:3': at('tens:3', 'fluent') }, true)).toBe('asleep');
  });

  it('has one lantern per part in order: lit when most of the part sits, the flame as large as what sits', () => {
    const states = Object.fromEntries([...unit('tiotal').map((id) => at(id, 'fluent')), ...unit('tiental').slice(0, 11).map((id) => at(id, 'automatic'))].map((s) => [s.itemId, s]));
    const lights = lanterns(pack, states, new Set(['tiotal', 'tiental', 'dubbla']));
    expect(lights.map((l) => l.title)).toEqual([
      'Hela tiotal',
      'Tiotal och ental',
      'Ental utan att gå över',
      'Till nästa tiotal',
      'Över tiotalet',
      'Hoppa tio',
      'Dubbla och halvera',
      'Tvåsiffrigt plus tvåsiffrigt',
    ]);
    expect(lights.map((l) => l.open)).toEqual([true, true, false, false, false, false, true, false]);
    expect(lights[0]!.known).toBe(1);
    expect(lights[1]!.known).toBe(0.5);
    expect(litCount(lights)).toBe(1);
    // The animal stands by the first open part that is not lit yet.
    expect(currentPart(lights)).toBe(1);
    expect(partProgress(pack, states, new Set(['tiotal'])).find((p) => p.id === 'tiental')).toMatchObject({ open: false, known: 11, total: 22, understanding: true });
  });

  it('puts the animal by the last open part when every open lantern is lit', () => {
    const lit = { title: '', open: true, known: LIT_AT };
    const closed = { title: '', open: false, known: 0 };
    expect(currentPart([lit, lit, closed])).toBe(1);
    expect(currentPart([closed, closed])).toBe(0);
  });
});
