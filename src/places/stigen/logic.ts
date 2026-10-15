import { atLeast, type ContentPack, type ItemId, type ItemState } from '../../engine';
import type { Lantern } from './components/trail';

/**
 * What Stigen shows, without the DOM. As in the other places, the place shows
 * what the child knows, never what they have earned.
 *
 * - `new`: nothing practised yet
 * - `thirsty`: today's session is still to do
 * - `asleep`: today's session is done (the path rests)
 */
export type PathMood = 'new' | 'thirsty' | 'asleep';

export const MOOD_TEXT: Record<PathMood, string> = {
  new: 'Nya lyktor väntar på stigen.',
  thirsty: 'Stigen har något att visa dig.',
  asleep: 'Stigen vilar. Kom tillbaka i morgon!',
};

export function pathMood(states: Record<ItemId, ItemState>, dailyDone: boolean): PathMood {
  if (dailyDone) return 'asleep';
  return Object.values(states).some((s) => s.status !== 'new') ? 'thirsty' : 'new';
}

const sits = (s: ItemState | undefined) => s !== undefined && atLeast(s.status, 'fluent');

/** One lantern per part, in the parts' order: open or not, and how much of it sits. */
export function lanterns(pack: ContentPack, states: Record<ItemId, ItemState>, unlocked: ReadonlySet<string>): Lantern[] {
  return [...pack.units]
    .sort((a, b) => a.order - b.order)
    .map((u) => ({
      title: u.title,
      open: unlocked.has(u.id),
      known: u.itemIds.length ? u.itemIds.filter((id) => sits(states[id])).length / u.itemIds.length : 0,
    }));
}

/** The parts with how much of each sits, for words beside the path and the parent view. */
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
