import type { ContentPack, FocusSet, Item, Unit } from '../../engine';
import { multiplicationDistractors } from './distractors';
import { buildFacts, MAX_FACTOR, MIN_FACTOR, parseFactId, UNIT_DEFS } from './facts';

export * from './facts';
export * from './derive';
export { multiplicationDistractors } from './distractors';

/** A unit opens when ~80 % of the previous one is at least "fluent". */
export const UNLOCK_FRACTION = 0.8;

export function normalizeNumberAnswer(raw: string): string {
  const s = raw.trim().replace(/\s+/g, '');
  return /^\d+$/.test(s) ? String(Number.parseInt(s, 10)) : s;
}

/** Id of the focus set for one table, e.g. `t7` for ×7. */
export function tableFocusId(table: number): string {
  return `t${table}`;
}

/** The table a focus set id stands for (`t7` → 7), or null. */
export function focusTable(id: string): number | null {
  const m = /^t(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
}

/**
 * One focus set per table: every fact with that factor, in both orders
 * (×7 is 1 × 7 … 10 × 7 and 7 × 1 … 7 × 10), across units.
 */
export function tableFocusSets(items: readonly Item[]): FocusSet[] {
  const sets: FocusSet[] = [];
  for (let t = MIN_FACTOR; t <= MAX_FACTOR; t++) {
    const itemIds = items
      .filter((it) => {
        const { a, b } = parseFactId(it.id);
        return a === t || b === t;
      })
      .map((it) => it.id);
    if (itemIds.length) sets.push({ id: tableFocusId(t), title: `×${t}`, itemIds });
  }
  return sets;
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
    focusSets: tableFocusSets(items),
  };
}
