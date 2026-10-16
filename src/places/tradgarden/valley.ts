import type { ItemId, ItemState } from '../../engine';

/**
 * What a place in the valley shows, without the DOM. The valley shows what a
 * child knows, never what they have earned: a place is open when its content
 * exists, and how it looks follows the child's knowledge.
 */

/**
 * - `new`: nothing planted yet.
 * - `thirsty`: today's session is still to do (something needs watering).
 * - `asleep`: today's session is done.
 */
export type PlaceMood = 'new' | 'thirsty' | 'asleep';

export const MOOD_TEXT: Record<PlaceMood, string> = {
  new: 'Nya frön väntar i trädgården.',
  thirsty: 'Trädgården är törstig.',
  asleep: 'Trädgården sover. Kom tillbaka i morgon!',
};

export function gardenMood(states: Record<ItemId, ItemState>, dailyDone: boolean): PlaceMood {
  if (dailyDone) return 'asleep';
  return Object.values(states).some((s) => s.status !== 'new') ? 'thirsty' : 'new';
}
