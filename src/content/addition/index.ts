import type { ContentPack, Item, ItemId, Unit } from '../../engine';
import { buildEqualities, EQUALITIES, equalityDistractors, equalityId, equalityNote, type Equality } from './equality';
import { additionDistractors, additionNote } from './distractors';
import { buildFacts, factId, familyOf, parseFactId, UNIT_DEFS } from './facts';
import { presentFact } from './present';

export * from './facts';
export * from './equality';
export * from './derive';
export { additionDistractors, additionNote } from './distractors';
export { presentFact } from './present';
export * from './check';
export * from './patterns';

/**
 * What a minus fact waits for before it is introduced (docs/PLAN-PLUSFORST.md):
 * the first plus fact of its family (`first`, the app's: 13 − 5 and 13 − 8
 * after 8 + 5), both of them (`family`, as delat med; Stigen opened about four
 * weeks later in the simulation), or nothing (as before). The other two are
 * kept for the simulation.
 */
export type MinusAfter = 'family' | 'first' | 'none';

export interface AdditionPackOptions {
  minusAfter?: MinusAfter;
}

/**
 * Minus after plus: 13 − 5 and 13 − 8 come when 8 + 5 sits (or 8 + 5 and
 * 5 + 8, with `family`), much as a division comes when its multiplications
 * sit. A child who has not met the minus sign learns the plus of the family
 * first; for one who knows plus it changes little.
 */
function withMinusAfter(items: Item[], minusAfter: MinusAfter): Item[] {
  if (minusAfter === 'none') return items;
  return items.map((item) => {
    if (!/^\d+-\d+$/.test(item.id)) return item;
    const { a, b } = familyOf(parseFactId(item.id));
    const plus = [factId('+', b, a), factId('+', a, b)];
    return { ...item, requires: minusAfter === 'first' ? [plus[0]!] : [...new Set(plus)] };
  });
}

/** A unit opens when ~80 % of each prerequisite is at least "fluent". */
export const UNLOCK_FRACTION = 0.8;

const byId = new Map<ItemId, Equality>(EQUALITIES.map((e) => [equalityId(e), e]));

/** Numbers as numbers ("08" is 8), and "Ja"/"Nej" in lower case. */
export function normalizeAnswer(raw: string): string {
  const s = raw.trim().replace(/\s+/g, '').toLowerCase();
  return /^\d+$/.test(s) ? String(Number.parseInt(s, 10)) : s;
}

/** A friendly word about a typical mix-up, for the help card. */
export function confusionNote(id: ItemId, given: string): string | undefined {
  const e = byId.get(id);
  if (e) return equalityNote(e, given);
  return additionNote(parseFactId(id), given);
}

/**
 * Bäcken: addition and subtraction within 20 as fact families, and the equal
 * sign (Vågen). See docs/PLAN-BACKEN.md.
 */
export function createAdditionPack({ minusAfter = 'first' }: AdditionPackOptions = {}): ContentPack {
  const items = [...withMinusAfter(buildFacts(), minusAfter), ...buildEqualities()];
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
    ...('understanding' in def
      ? {
          kind: 'understanding' as const,
          // Understanding shows on different days and in different forms, not in speed.
          status: { fluentRtMs: Number.MAX_SAFE_INTEGER, automaticRtMs: Number.MAX_SAFE_INTEGER, automaticFormats: ['choice', 'free'] as const },
        }
      : {}),
  })) as Unit[];

  return {
    id: 'addition',
    version: 1,
    title: 'Addition och subtraktion inom 20',
    items,
    units,
    normalizeAnswer,
    distractorCandidates(item) {
      const e = byId.get(item.id);
      return e ? equalityDistractors(e) : additionDistractors(parseFactId(item.id));
    },
    present: presentFact,
  };
}

