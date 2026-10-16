import type { ContentPack, DayKey, ItemId, ItemState } from '../../engine';
import { partSits } from '../../shell/parts';

/**
 * A table opens when the steps of its räknestigar can be taken
 * (docs/PLAN-HUNDRA.md): ×10 waits for whole tens on Stigen, ×4 for doubling
 * and halving, ×3, ×9 and ×6 for going over the ten, and the squares, ×7 and ×8
 * for two-digit sums. ×2, ×1 and ×5 wait for nothing: ×5 is counting in fives,
 * which most children can, and it comes right after ×10 (docs/PLAN-GRANSKNING.md).
 * A table that is already open or started never waits (the engine's `heldUnitIds`).
 */
export const TABLES_WAIT: Record<string, readonly string[]> = {
  u10: ['tiotal'],
  u4: ['dubbla'],
  u3: ['overtio'],
  u9: ['overtio'],
  u6: ['overtio'],
  usq: ['tvasiffr'],
  u78: ['tvasiffr'],
};

/**
 * A table waits at most this many play days (days the child played anywhere in
 * the valley) after it could have opened (its own rule in the garden met).
 * Simulated children showed hard waits to stall the garden for months
 * (docs/PLAN-HUNDRA.md, Fynd från H5). Play days, not calendar days, so a child
 * who plays twice a week gets as many sessions on Stigen as one who plays every
 * day (docs/PLAN-GRANSKNING.md).
 */
export const WAIT_PLAY_DAYS = 14;

/** The day an adult opened a table: long enough ago that it waits no more. */
export const OPENED_BY_ADULT: DayKey = '2000-01-01';

/**
 * Which of the waiting tables are held today. `ready` is the day each table
 * could first have opened; tables that can open today and have no day yet get
 * today (returned in `ready`, to be kept). `playDays` = the days the child
 * played in the valley; a table is let go after `maxPlayDays` of them from its day.
 */
export function heldTables(
  waiting: readonly string[],
  couldOpen: ReadonlySet<string>,
  ready: Readonly<Record<string, DayKey>>,
  today: DayKey,
  playDays: readonly DayKey[],
  maxPlayDays = WAIT_PLAY_DAYS,
): { held: string[]; ready: Record<string, DayKey>; changed: boolean } {
  const out = { ...ready };
  let changed = false;
  for (const u of waiting) {
    if (couldOpen.has(u) && out[u] === undefined) {
      out[u] = today;
      changed = true;
    }
  }
  const days = new Set(playDays);
  const playedSince = (from: DayKey) => [...days].filter((d) => d >= from).length;
  const held = waiting.filter((u) => out[u] === undefined || (out[u] !== OPENED_BY_ADULT && playedSince(out[u]!) < maxPlayDays));
  return { held, ready: out, changed };
}

/**
 * The tables that show a part of Stigen when they sit in the garden: those that
 * wait for it, and ×5, which is half of ×10.
 */
const SHOWN_BY: Record<string, readonly string[]> = { ...TABLES_WAIT, u5: ['dubbla'] };

/**
 * The tables that wait for Stigen right now. A skill the child already shows in
 * the garden counts as sitting: a child who knows ×5 can halve, so ×4 does not
 * wait for "Dubbla och halvera".
 */
export function tablesWaiting(
  path: ContentPack,
  pathStates: Record<ItemId, ItemState>,
  garden?: { pack: ContentPack; states: Record<ItemId, ItemState> },
): string[] {
  const shown = (part: string) =>
    garden !== undefined && Object.entries(SHOWN_BY).some(([table, needs]) => needs.includes(part) && partSits(garden.pack, garden.states, table));
  return Object.entries(TABLES_WAIT)
    .filter(([, needs]) => needs.some((part) => !partSits(path, pathStates, part) && !shown(part)))
    .map(([table]) => table);
}

const TABLE_NAME: Record<string, string> = {
  u10: '×10',
  u5: '×5',
  u4: '×4',
  u3: '×3',
  u9: '×9',
  u6: '×6',
  usq: 'Kvadrattalen',
  u78: '×7 och ×8',
};

/** What the child learns on Stigen for a table, after "när du kan …". */
const PATH_SKILL: Record<string, string> = {
  tiotal: 'hela tiotal',
  dubbla: 'dubbla och halvera',
  overtio: 'gå över tiotalet',
  tvasiffr: 'lägga ihop tvåsiffriga tal',
};

export const tableName = (unitId: string) => TABLE_NAME[unitId] ?? unitId;

/** "×6 kommer när du kan gå över tiotalet på stigen." */
export function waitText(unitId: string): string {
  const skill = (TABLES_WAIT[unitId] ?? []).map((id) => PATH_SKILL[id] ?? id).join(' och ');
  return `${tableName(unitId)} kommer när du kan ${skill} på stigen.`;
}
