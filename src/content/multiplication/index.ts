import type { ContentPack, FocusSet, Item, Unit } from '../../engine';
import { buildDivisions, buildShareItems, DIVISION_UNIT_DEFS, divisionDistractors, isDivisionId, isShareId, parseDivisionId, SHARE_TASKS, shareId } from './division';
import { multiplicationDistractors } from './distractors';
import { buildFacts, isFactId, MAX_FACTOR, MIN_FACTOR, parseFactId, UNIT_DEFS } from './facts';
import { presentMultiplication } from './present';

export * from './facts';
export * from './derive';
export * from './division';
export { multiplicationDistractors } from './distractors';
export { presentMultiplication, STANDARD_FIRST } from './present';

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
  const facts = items.filter((it) => isFactId(it.id));
  for (let t = MIN_FACTOR; t <= MAX_FACTOR; t++) {
    const itemIds = facts
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
  /**
   * Include delat med (version 2): the divisions, one per square, and the
   * understanding part "Dela lika". Off until the garden can show it.
   */
  division?: boolean;
}

/**
 * Delat med has its own lane: new divisions and new multiplications take
 * turns, so a child who already knows many tables does not get every open
 * division before the next table.
 */
export const DIVISION_LANE = 'division';

/** "Dela lika" opens when about one family sits (2 of the 19 facts of ×10). */
export const SHARE_OPENS_AT = 0.1;

export function createMultiplicationPack({ maxUnits = UNIT_DEFS.length, division = false }: PackOptions = {}): ContentPack {
  const defs = UNIT_DEFS.slice(0, maxUnits);
  const unitIds = new Set<string>(defs.map((d) => d.id));
  // The multiplications first, always in the same order: old QR codes and backups hold just these.
  const facts = buildFacts().filter((it) => unitIds.has(it.unitId));
  const items = division ? [...facts, ...buildShareItems(), ...buildDivisions()] : facts;
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

  if (division) units.splice(0, units.length, ...withDivision(units, items));

  return {
    id: 'multiplication',
    version: division ? 2 : 1,
    title: 'Multiplikationstabellen',
    items,
    units,
    normalizeAnswer: normalizeNumberAnswer,
    distractorCandidates(item) {
      if (isDivisionId(item.id)) {
        const { dividend, divisor } = parseDivisionId(item.id);
        return divisionDistractors(dividend, divisor);
      }
      if (isShareId(item.id)) {
        const n = Number(item.answer);
        return [n - 1, n + 1, n + 2, n * 2].filter((v) => v > 0).map((v) => ({ value: String(v), weight: 1 }));
      }
      const { a, b } = parseFactId(item.id);
      return multiplicationDistractors(a, b);
    },
    focusSets: tableFocusSets(items),
    // Divisions in three forms; without them, every item has one form.
    ...(division ? { present: presentMultiplication } : {}),
  };
}

/**
 * The tables with delat med woven in: ×10, "Dela lika", Dela med 10, ×2, Dela
 * med 2, and so on, so that a family's division comes soon after its
 * multiplication sits, not after the whole table. Each part opens after the one
 * before it of its own kind; within an open part a division waits for both
 * multiplications of its family (`requires`).
 */
function withDivision(tables: readonly Unit[], items: readonly Item[]): Unit[] {
  const [first, ...rest] = divisionUnits(items);
  const share = first!;
  const out: Unit[] = [];
  tables.forEach((table, i) => {
    // Tables open after the table before them (named, since the order now has division parts in between).
    out.push(i === 0 ? table : { ...table, unlockRule: { kind: 'after', requires: [tables[i - 1]!.id], fraction: UNLOCK_FRACTION, minStatus: 'fluent' } });
    if (i === 0) out.push(share);
    const part = rest.find((u) => DIVISION_UNIT_DEFS.find((d) => d.id === u.id)?.of === table.id);
    if (part) out.push(part);
  });
  return out.map((u, order) => ({ ...u, order }));
}

/** "Dela lika" after the first family sits, then the division parts in the order of the tables. */
function divisionUnits(items: readonly Item[]): Unit[] {
  const share: Unit = {
    id: 'delalika',
    title: 'Dela lika',
    order: 0,
    kind: 'understanding',
    lane: DIVISION_LANE,
    itemIds: SHARE_TASKS.map(shareId),
    // Understanding: judged on right answers on different days, never on time.
    status: { fluentRtMs: Number.MAX_SAFE_INTEGER, automaticRtMs: Number.MAX_SAFE_INTEGER, automaticFormats: ['choice', 'free'] },
    unlockRule: { kind: 'after', requires: ['u10'], fraction: SHARE_OPENS_AT, minStatus: 'fluent' },
  };
  const parts = DIVISION_UNIT_DEFS.map(
    (def, i): Unit => ({
      id: def.id,
      title: def.title,
      order: 0,
      lane: DIVISION_LANE,
      itemIds: items
        .filter((it) => it.unitId === def.id)
        .sort((x, y) => x.order - y.order)
        .map((it) => it.id),
      unlockRule: { kind: 'after', requires: [i === 0 ? 'delalika' : DIVISION_UNIT_DEFS[i - 1]!.id], fraction: UNLOCK_FRACTION, minStatus: 'fluent' },
    }),
  );
  return [share, ...parts];
}
