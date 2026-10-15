import { atLeast, type ContentPack, type FocusSet, type Item, type Status, type Unit } from '../../engine';
import { buildDivisions, buildShareItems, DIVISION_UNIT_DEFS, divisionDistractors, isDivisionId, isShareId, parseDivisionId, SHARE_TASKS, shareId } from './division';
import { multiplicationDistractors } from './distractors';
import { buildFacts, isFactId, MAX_FACTOR, MIN_FACTOR, parseFactId, UNIT_DEFS } from './facts';
import { presentMultiplication } from './present';
import { buildGroupItems, GROUP_TASKS, groupDistractors, groupId, isGroupId } from './groups';

export * from './facts';
export * from './derive';
export * from './division';
export * from './check';
export * from './groups';
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
   * The whole garden (version 3): "Lika stora grupper" first, the tables as a
   * graph with ×2 first, and delat med (the divisions, one per square, and
   * "Dela lika"). Without it, the tables in a chain as in Gångerträdgården.
   */
  division?: boolean;
}

/**
 * Delat med has its own lane: new divisions and new multiplications take
 * turns, so a child who already knows many tables does not get every open
 * division before the next table.
 */
export const DIVISION_LANE = 'division';

/** "Dela lika" opens when about one family sits (2 of the 19 facts of ×2). */
export const SHARE_OPENS_AT = 0.1;

/** ×2 opens when about half of "Lika stora grupper" sits: the idea is there, the rest is practised alongside. */
export const GROUPS_OPEN_AT = 0.5;

/**
 * What each table builds on in the garden (docs/PLAN-HUNDRA.md): ×2 on the idea
 * of equal groups, ×10 and ×4, ×3 and ×1 on ×2, ×5 as half of ×10, ×9 as ×10
 * minus a group, ×6 as ×5 plus a group, the squares on ×4 and ×3, and ×7 and
 * ×8 on ×6 and ×4. The order in which new facts come is still `UNIT_DEFS`.
 */
export const TABLE_AFTER: Record<string, string[]> = {
  u2: ['lika'],
  u10: ['u2'],
  u5: ['u10'],
  u1: ['u2'],
  u4: ['u2'],
  u3: ['u2'],
  usq: ['u4', 'u3'],
  u9: ['u10'],
  u6: ['u5'],
  u78: ['u6', 'u4'],
};

export function createMultiplicationPack({ maxUnits = UNIT_DEFS.length, division = false }: PackOptions = {}): ContentPack {
  const defs = UNIT_DEFS.slice(0, maxUnits);
  const unitIds = new Set<string>(defs.map((d) => d.id));
  // The multiplications first, always in the same order: old QR codes and backups hold just these.
  // What came later is added at the end (delat med in version 2, the groups in version 3).
  const facts = buildFacts().filter((it) => unitIds.has(it.unitId));
  const items = division ? [...facts, ...buildShareItems(), ...buildDivisions(), ...buildGroupItems()] : facts;
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

  if (division) units.splice(0, units.length, ...wholeGarden(units, items));

  return {
    id: 'multiplication',
    version: division ? 3 : 1,
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
      if (isGroupId(item.id)) return groupDistractors(GROUP_TASKS.find((t) => groupId(t) === item.id)!);
      const { a, b } = parseFactId(item.id);
      return multiplicationDistractors(a, b);
    },
    focusSets: tableFocusSets(items),
    // Divisions in three forms; without them, every item has one form.
    ...(division ? { present: presentMultiplication } : {}),
  };
}

/** Understanding, as "Dela lika" and Vågen: right answers on different days, never on time. */
const UNDERSTANDING_STATUS = { fluentRtMs: Number.MAX_SAFE_INTEGER, automaticRtMs: Number.MAX_SAFE_INTEGER, automaticFormats: ['choice', 'free'] } as const;

/**
 * The whole garden: "Lika stora grupper", then the tables with delat med woven
 * in: ×2, "Dela lika", Dela med 2, ×10, Dela med 10, and so on, so that a
 * family's division comes soon after its multiplication sits. The tables open
 * by `TABLE_AFTER`; each division part opens after the one before it, and
 * within an open part a division waits for both multiplications of its family
 * (`requires`).
 */
function wholeGarden(tables: readonly Unit[], items: readonly Item[]): Unit[] {
  const groups: Unit = {
    id: 'lika',
    title: 'Lika stora grupper',
    order: 0,
    kind: 'understanding',
    itemIds: GROUP_TASKS.map(groupId),
    status: { ...UNDERSTANDING_STATUS, automaticFormats: [...UNDERSTANDING_STATUS.automaticFormats] },
    unlockRule: { kind: 'always' },
  };
  const [share, ...parts] = divisionUnits(items);
  const out: Unit[] = [groups];
  tables.forEach((table, i) => {
    const after = TABLE_AFTER[table.id] ?? [];
    const fraction = table.id === 'u2' ? GROUPS_OPEN_AT : UNLOCK_FRACTION;
    out.push({ ...table, unlockRule: { kind: 'after', requires: after, fraction, minStatus: 'fluent' } });
    if (i === 0) out.push(share!);
    const part = parts.find((u) => DIVISION_UNIT_DEFS.find((d) => d.id === u.id)?.of === table.id);
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
    status: { ...UNDERSTANDING_STATUS, automaticFormats: [...UNDERSTANDING_STATUS.automaticFormats] },
    unlockRule: { kind: 'after', requires: [UNIT_DEFS[0].id], fraction: SHARE_OPENS_AT, minStatus: 'fluent' },
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

/**
 * The start check's part about delat med (see docs/PLAN-DELAT-MED.md): the
 * division parts in order, each with only the divisions whose family already
 * sits (just placed by the multiplication part). The divisions no longer wait
 * for anything here, and each part is tested only if the one before passed.
 * Empty parts are left out. Returns null if there is nothing to test.
 */
export function divisionPlacementPack(pack: ContentPack, states: Record<string, { status: Status }>): ContentPack | null {
  const sits = (id: string) => atLeast(states[id]?.status ?? 'new', 'fluent');
  const byId = new Map(pack.items.map((it) => [it.id, it]));
  const parts = DIVISION_UNIT_DEFS.map((def) => ({
    def,
    itemIds: (pack.units.find((u) => u.id === def.id)?.itemIds ?? []).filter((id) => byId.get(id)?.requires?.every(sits)),
  })).filter((p) => p.itemIds.length > 0);
  if (!parts.length) return null;
  const ids = new Set(parts.flatMap((p) => p.itemIds));
  return {
    ...pack,
    // Nothing to wait for or derive from here: the check asks only these.
    items: pack.items
      .filter((it) => ids.has(it.id))
      .map(({ requires: _sat, pairId, ...it }) => ({ ...it, derivedFrom: [], ...(pairId && ids.has(pairId) ? { pairId } : {}) })),
    units: parts.map(({ def, itemIds }, i) => ({
      id: def.id,
      title: def.title,
      order: i,
      itemIds,
      unlockRule: i === 0 ? { kind: 'always' } : { kind: 'previous', fraction: UNLOCK_FRACTION, minStatus: 'fluent' },
    })),
  };
}
