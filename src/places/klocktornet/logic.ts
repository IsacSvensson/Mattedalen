import type { ItemId, ItemState } from '../../engine';

/**
 * What the tower shows, without the DOM, as Stigen does:
 * - `new`: nothing practised yet
 * - `thirsty`: today's session is still to do
 * - `asleep`: today's session is done (the tower rests)
 */
export type TowerMood = 'new' | 'thirsty' | 'asleep';

export const MOOD_TEXT: Record<TowerMood, string> = {
  new: 'Tornet väntar på dig.',
  thirsty: 'Tornet har något att visa dig.',
  asleep: 'Tornet vilar. Kom tillbaka i morgon!',
};

export function towerMood(states: Record<ItemId, ItemState>, dailyDone: boolean): TowerMood {
  if (dailyDone) return 'asleep';
  return Object.values(states).some((s) => s.status !== 'new') ? 'thirsty' : 'new';
}
