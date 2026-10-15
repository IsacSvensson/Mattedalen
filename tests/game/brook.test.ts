import { describe, expect, it } from 'vitest';
import { emptyState, type ItemState } from '../../src/engine';
import { createAdditionPack } from '../../src/content/addition';
import { laidCount, LAID_AT } from '../../src/places/backen/components/bridge';
import { bridgeStones, brookMood, partProgress } from '../../src/places/backen/logic';
import { MIN_PLACE_MINUTES, placeMinutes } from '../../src/shell/play';

const pack = createAdditionPack();
const at = (itemId: string, status: ItemState['status'], box = 0): ItemState => ({ ...emptyState(itemId), status, box });
const record = (...states: ItemState[]) => Object.fromEntries(states.map((s) => [s.itemId, s]));
const unit = (id: string) => pack.units.find((u) => u.id === id)!;

describe('the brook on the valley map', () => {
  it('waits with new stones, has something to show until the day is done, then rests', () => {
    expect(brookMood({}, false)).toBe('new');
    expect(brookMood(record(at('1+1', 'new')), false)).toBe('new');
    expect(brookMood(record(at('1+1', 'learning')), false)).toBe('thirsty');
    expect(brookMood(record(at('1+1', 'learning')), true)).toBe('asleep');
  });
});

describe('the bridge', () => {
  it('has one block per part about facts, in order; the equal sign is not a block', () => {
    const stones = bridgeStones(pack, {}, new Set(['ettmer', 'noll']));
    expect(stones.map((s) => s.title)).toEqual(
      [...pack.units].sort((a, b) => a.order - b.order).filter((u) => u.kind !== 'understanding').map((u) => u.title),
    );
    expect(stones.some((s) => s.title === 'Likhetstecknet')).toBe(false);
    expect(stones.filter((s) => s.open).map((s) => s.title)).toEqual(['Ett mer, ett mindre', 'Noll']);
  });

  it('fills a block with the share of its facts that sit (fluent or better)', () => {
    const ids = unit('sma').itemIds;
    expect(ids).toHaveLength(4);
    const states = record(at(ids[0]!, 'automatic'), at(ids[1]!, 'fluent'), at(ids[2]!, 'learning', 3), at(ids[3]!, 'new'));
    const sma = bridgeStones(pack, states, new Set(['sma'])).find((s) => s.title === 'Små summor')!;
    expect(sma.known).toBe(0.5);
  });

  it('counts a block as laid from about as much as opens what comes after it', () => {
    const stone = (known: number, open = true) => ({ title: 'x', open, known });
    expect(LAID_AT).toBe(0.8);
    expect(laidCount([stone(1), stone(0.8), stone(0.79), stone(1, false)])).toBe(2);
  });

  it('lists every part with how many of its facts sit, the equal sign marked as understanding', () => {
    const ids = unit('noll').itemIds;
    const states = record(...ids.slice(0, 10).map((id) => at(id, 'fluent')));
    const parts = partProgress(pack, states, new Set(['ettmer', 'noll']));
    expect(parts).toHaveLength(pack.units.length);
    expect(parts.find((p) => p.id === 'noll')).toMatchObject({ open: true, known: 10, total: 42 });
    expect(parts.find((p) => p.id === 'overtio')).toMatchObject({ open: false, known: 0, total: 48 });
    expect(parts.find((p) => p.id === 'vagen')).toMatchObject({ understanding: true, total: 24 });
  });
});

describe('the day is shared between the places', () => {
  it('gives one place all of the time, and several places their share, never under five minutes', () => {
    expect(placeMinutes(12)).toBe(12);
    expect(placeMinutes(12, 1 / 2)).toBe(6);
    expect(placeMinutes(15, 1 / 2)).toBe(8);
    expect(placeMinutes(10, 1 / 3)).toBe(MIN_PLACE_MINUTES);
  });
});
