import { atLeast, type ContentPack, type ItemId, type ItemState } from '../../engine';
import type { BridgeStone } from './components/bridge';

/**
 * What Bäcken shows, without the DOM. Like the garden: the place shows what
 * the child knows, never what they have earned.
 *
 * - `new`: nothing practised yet
 * - `thirsty`: today's session is still to do
 * - `asleep`: today's session is done (the brook rests)
 */
export type BrookMood = 'new' | 'thirsty' | 'asleep';

export const MOOD_TEXT: Record<BrookMood, string> = {
  new: 'Nya stenar väntar vid bäcken.',
  thirsty: 'Bäcken har något att visa dig.',
  asleep: 'Bäcken vilar. Kom tillbaka i morgon!',
};

export function brookMood(states: Record<ItemId, ItemState>, dailyDone: boolean): BrookMood {
  if (dailyDone) return 'asleep';
  return Object.values(states).some((s) => s.status !== 'new') ? 'thirsty' : 'new';
}

const sits = (s: ItemState | undefined) => s !== undefined && atLeast(s.status, 'fluent');

/** One bridge stone per part about facts; the equal sign (an understanding part) is the scale beside it. */
export function bridgeStones(pack: ContentPack, states: Record<ItemId, ItemState>, unlocked: ReadonlySet<string>): BridgeStone[] {
  return [...pack.units]
    .sort((a, b) => a.order - b.order)
    .filter((u) => u.kind !== 'understanding')
    .map((u) => ({
      title: u.title,
      open: unlocked.has(u.id),
      known: u.itemIds.length ? u.itemIds.filter((id) => sits(states[id])).length / u.itemIds.length : 0,
    }));
}

/** The parts with how much of each sits, for words beside the bridge and the parent view. */
export function partProgress(pack: ContentPack, states: Record<ItemId, ItemState>, unlocked: ReadonlySet<string>) {
  return [...pack.units]
    .sort((a, b) => a.order - b.order)
    .map((u) => ({
      id: u.id,
      title: u.title,
      open: unlocked.has(u.id),
      understanding: u.kind === 'understanding',
      known: u.itemIds.filter((id) => sits(states[id])).length,
      total: u.itemIds.length,
    }));
}
