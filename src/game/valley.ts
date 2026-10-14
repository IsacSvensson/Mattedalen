import type { ItemId, ItemState } from '../engine';
import { stageFor, STAGE_ORDER, type Stage } from './components/plant';

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
  new: 'Här väntar nya frön.',
  thirsty: 'Trädgården är törstig.',
  asleep: 'Trädgården sover. Kom tillbaka i morgon!',
};

/** Cells in the small bed drawn on the map. */
export const MINI_BED_CELLS = 8;

export function gardenMood(states: Record<ItemId, ItemState>, dailyDone: boolean): PlaceMood {
  if (dailyDone) return 'asleep';
  return Object.values(states).some((s) => s.status !== 'new') ? 'thirsty' : 'new';
}

/**
 * The plants in the small bed on the map: the child's furthest grown facts
 * first, then dug earth. A child's first trees show up there right away.
 */
export function miniBed(states: Record<ItemId, ItemState>, cells = MINI_BED_CELLS): Stage[] {
  const rank = (stage: Stage) => STAGE_ORDER.indexOf(stage);
  const grown = Object.values(states)
    .map((s) => stageFor(s, true))
    .filter((stage) => rank(stage) > rank('soil'))
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, cells);
  return [...grown, ...Array<Stage>(cells - grown.length).fill('soil')];
}
