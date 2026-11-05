import type { ContentPack, Unit } from '../../engine';
import { clockDistractors } from './distractors';
import { buildItems } from './items';
import { presentClock } from './present';
import { parseTaskId, UNIT_DEFS } from './tasks';
import { normalizeAnswer } from './time';

export * from './time';
export * from './tasks';
export { buildItems, strategyFor, type ClockShow } from './items';
export { candidates, clockDistractors, clockNote, mistakeOf, type Mistake } from './distractors';
export { presentClock } from './present';

/** A part opens when ~80 % of each part it builds on is at least "fluent". */
export const UNLOCK_FRACTION = 0.8;

/**
 * Klocktornet: reading the clock, steps 0–5 (docs/PLAN-KLOCKAN.md, KL2). Every
 * part is understanding: shown on different days and in different forms, never
 * timed. Not used by any place yet: the tower comes in KL3 and KL4.
 */
export function createClockPack(): ContentPack {
  const items = buildItems();
  const units: Unit[] = UNIT_DEFS.map((def, order) => ({
    id: def.id,
    title: def.title,
    order,
    itemIds: items
      .filter((it) => it.unitId === def.id)
      .sort((x, y) => x.order - y.order)
      .map((it) => it.id),
    unlockRule:
      def.requires.length === 0
        ? { kind: 'always' }
        : { kind: 'after', requires: [...def.requires], fraction: UNLOCK_FRACTION, minStatus: 'fluent' },
    ...('lane' in def ? { lane: def.lane } : {}),
    kind: 'understanding' as const,
    status: { fluentRtMs: Number.MAX_SAFE_INTEGER, automaticRtMs: Number.MAX_SAFE_INTEGER, automaticFormats: ['choice', 'free'] as const },
  })) as Unit[];

  return {
    id: 'clock',
    version: 1,
    title: 'Klockan',
    items,
    units,
    normalizeAnswer,
    distractorCandidates: (item) => clockDistractors(parseTaskId(item.id)),
    present: presentClock,
  };
}
