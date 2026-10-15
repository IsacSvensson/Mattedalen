import type { ItemId, ItemState } from '../../engine';
import { divisionInSquare, isFactId, parseFactId } from '../../content/multiplication';
import { bears, bloomFor, stageFor, STAGE_ORDER, type Bloom, type Stage } from '../../shell/components/plant';

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

/** Cells in the small bed drawn on the map. */
export const MINI_BED_CELLS = 8;

export function gardenMood(states: Record<ItemId, ItemState>, dailyDone: boolean): PlaceMood {
  if (dailyDone) return 'asleep';
  return Object.values(states).some((s) => s.status !== 'new') ? 'thirsty' : 'new';
}

/** A plant in the small bed: how far the multiplication has grown, and the delat med on it. */
export interface MiniPlant {
  stage: Stage;
  bloom: Bloom;
}

const BLOOM_ORDER: Bloom[] = ['none', 'blossom', 'kart', 'fruit'];

/**
 * The plants in the small bed on the map: the child's furthest grown facts
 * first (fruit before blossoms on the same kind of plant), then dug earth.
 * A child's first trees show up there right away.
 */
export function miniBedPlants(states: Record<ItemId, ItemState>, cells = MINI_BED_CELLS): MiniPlant[] {
  const rank = (p: MiniPlant) => STAGE_ORDER.indexOf(p.stage) * 10 + BLOOM_ORDER.indexOf(p.bloom);
  const grown = Object.values(states)
    .filter((s) => isFactId(s.itemId))
    .map((s): MiniPlant => {
      const stage = stageFor(s, true);
      const { a, b } = parseFactId(s.itemId);
      return { stage, bloom: bears(stage) ? bloomFor(states[divisionInSquare(a, b)]) : 'none' };
    })
    .filter((p) => STAGE_ORDER.indexOf(p.stage) > STAGE_ORDER.indexOf('soil'))
    .sort((x, y) => rank(y) - rank(x))
    .slice(0, cells);
  return [...grown, ...Array.from({ length: cells - grown.length }, (): MiniPlant => ({ stage: 'soil', bloom: 'none' }))];
}

/** The stages in the small bed (see `miniBedPlants`). */
export const miniBed = (states: Record<ItemId, ItemState>, cells = MINI_BED_CELLS): Stage[] => miniBedPlants(states, cells).map((p) => p.stage);
