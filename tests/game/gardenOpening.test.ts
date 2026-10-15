import { describe, expect, it } from 'vitest';
import { emptyState, type ItemState } from '../../src/engine';
import { createAdditionPack } from '../../src/content/addition';
import { gardenOpens, OPENS_AFTER } from '../../src/places/tradgarden/opening';
import { gardenIsOpen } from '../../src/places/tradgarden/isOpen';
import { pack as gardenPack } from '../../src/places/tradgarden/pack';
import { DEFAULT_SETTINGS, MemoryProgressStore, type Profile } from '../../src/storage';
import type { AppContext } from '../../src/shell/app';

const brookPack = createAdditionPack();
const at = (itemId: string, status: ItemState['status']): ItemState => ({ ...emptyState(itemId), status, box: 3 });
const unit = (id: string) => brookPack.units.find((u) => u.id === id)!;

/** The brook with the given share of each opening part fluent. */
function brook(share: number) {
  const states: Record<string, ItemState> = {};
  for (const id of OPENS_AFTER) {
    const ids = unit(id).itemIds;
    ids.forEach((itemId, i) => (states[itemId] = at(itemId, i < Math.ceil(ids.length * share) ? 'fluent' : 'learning')));
  }
  return { pack: brookPack, states };
}

describe('when the garden opens', () => {
  it('is closed to a new child, who starts at the brook', () => {
    expect(gardenOpens({ gardenStates: {}, brook: { pack: brookPack, states: {} }, openedByAdult: false })).toBe(false);
  });

  it('opens when the child already has progress in the garden', () => {
    expect(gardenOpens({ gardenStates: { '2x3': at('2x3', 'learning') }, brook: brook(0), openedByAdult: false })).toBe(true);
  });

  it('opens when doubles and going over ten sit at the brook', () => {
    expect(gardenOpens({ gardenStates: {}, brook: brook(0.8), openedByAdult: false })).toBe(true);
    expect(gardenOpens({ gardenStates: {}, brook: brook(0.7), openedByAdult: false })).toBe(false);
  });

  it('needs both parts: doubles alone are not enough', () => {
    const states = brook(1).states;
    for (const id of unit('overtio').itemIds) states[id] = at(id, 'learning');
    expect(gardenOpens({ gardenStates: {}, brook: { pack: brookPack, states }, openedByAdult: false })).toBe(false);
  });

  it('opens when a grown-up opens it', () => {
    expect(gardenOpens({ gardenStates: {}, brook: brook(0), openedByAdult: true })).toBe(true);
  });
});

describe('once the garden is open', () => {
  it('stays open when a fact at the brook slips back', async () => {
    const store = new MemoryProgressStore();
    const ctx = { store, places: [{ pack: brookPack }, { pack: gardenPack }] } as unknown as AppContext;
    const profile: Profile = { id: 'p', name: 'Alva', avatar: '🦊', createdAt: 0, settings: { ...DEFAULT_SETTINGS } };
    await store.saveProfile(profile);
    const saveBrook = (states: Record<string, ItemState>) =>
      store.save({ profileId: 'p', packId: brookPack.id, packVersion: brookPack.version, states, meta: { pacingGap: 8, unlockedUnitIds: [], accuracyEma: null, sessionsCompleted: 0, lastSessionDay: null }, updatedAt: 0 });

    await saveBrook(brook(0.8).states);
    expect(await gardenIsOpen(ctx, profile)).toBe(true);

    await saveBrook(brook(0.7).states);
    const reloaded = (await store.getProfile('p'))!;
    expect(reloaded.settings.gardenOpen).toBe(true);
    expect(await gardenIsOpen(ctx, reloaded)).toBe(true);
  });

  it('is not marked open before it opens', async () => {
    const store = new MemoryProgressStore();
    const ctx = { store, places: [{ pack: brookPack }, { pack: gardenPack }] } as unknown as AppContext;
    const profile: Profile = { id: 'p', name: 'Alva', avatar: '🦊', createdAt: 0, settings: { ...DEFAULT_SETTINGS } };
    await store.saveProfile(profile);
    expect(await gardenIsOpen(ctx, profile)).toBe(false);
    expect((await store.getProfile('p'))!.settings.gardenOpen).toBeUndefined();
  });
});
