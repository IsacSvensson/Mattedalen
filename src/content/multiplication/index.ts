import type { ContentPack, Unit } from '../../engine';
import { multiplicationDistractors } from './distractors';
import { buildFacts, parseFactId, UNIT_DEFS } from './facts';

export * from './facts';
export { multiplicationDistractors } from './distractors';

/** A unit opens when ~80 % of the previous one is at least "fluent". */
export const UNLOCK_FRACTION = 0.8;

export function normalizeNumberAnswer(raw: string): string {
  const s = raw.trim().replace(/\s+/g, '');
  return /^\d+$/.test(s) ? String(Number.parseInt(s, 10)) : s;
}

export interface PackOptions {
  /** Only include the first N units (the game can release units gradually). */
  maxUnits?: number;
}

export function createMultiplicationPack({ maxUnits = UNIT_DEFS.length }: PackOptions = {}): ContentPack {
  const defs = UNIT_DEFS.slice(0, maxUnits);
  const unitIds = new Set<string>(defs.map((d) => d.id));
  const items = buildFacts().filter((it) => unitIds.has(it.unitId));
  const units: Unit[] = defs.map((def, i) => ({
    id: def.id,
    title: def.title,
    order: i,
    itemIds: items
      .filter((it) => it.unitId === def.id)
      .sort((x, y) => x.order - y.order)
      .map((it) => it.id),
    unlockRule: i === 0 ? { kind: 'always' } : { kind: 'previous', fraction: UNLOCK_FRACTION, minStatus: 'fluent' },
  }));

  return {
    id: 'multiplication',
    version: 1,
    title: 'Multiplikationstabellen',
    items,
    units,
    normalizeAnswer: normalizeNumberAnswer,
    distractorCandidates(item) {
      const { a, b } = parseFactId(item.id);
      return multiplicationDistractors(a, b);
    },
  };
}
