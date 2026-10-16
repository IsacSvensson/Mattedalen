import type { ContentPack, ItemId, Unit } from '../../engine';
import { hundredDistractors, hundredNote } from './distractors';
import { buildItems } from './items';
import { presentHundred } from './present';
import { parseTaskId, UNIT_DEFS } from './tasks';

export * from './tasks';
export { buildItems, halfSplit, hintsFor, landings, strategyFor, taskWithAnswer } from './items';
export * from './derive';
export { hundredDistractors, hundredNote, onesTurned } from './distractors';
export { presentHundred } from './present';

/** A part opens when ~80 % of each part it builds on is at least "fluent". */
export const UNLOCK_FRACTION = 0.8;

/** Numbers as numbers ("08" is 8). */
export function normalizeAnswer(raw: string): string {
  const s = raw.trim().replace(/\s+/g, '').toLowerCase();
  return /^\d+$/.test(s) ? String(Number.parseInt(s, 10)) : s;
}

/** A friendly word about a typical mix-up, for the help card. */
export function confusionNote(id: ItemId, given: string): string | undefined {
  return hundredNote(parseTaskId(id), given);
}

/**
 * Stigen: the numbers to 100. See docs/PLAN-HUNDRA.md and docs/STIGEN.md.
 * Not used by any place yet: Stigen is built in phases and turned on in H5.
 */
export function createHundredPack(): ContentPack {
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
    ...('understanding' in def
      ? {
          kind: 'understanding' as const,
          // Understanding shows on different days and in different forms, not in speed.
          status: { fluentRtMs: Number.MAX_SAFE_INTEGER, automaticRtMs: Number.MAX_SAFE_INTEGER, automaticFormats: ['choice', 'free'] as const },
        }
      : {}),
  })) as Unit[];

  return {
    id: 'hundred',
    version: 1,
    title: 'Talen till 100',
    items,
    units,
    normalizeAnswer,
    distractorCandidates: (item) => hundredDistractors(parseTaskId(item.id)),
    present: presentHundred,
  };
}
export * from './check';
