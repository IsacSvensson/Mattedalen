import { diffDays, type ContentPack, type DayKey, type ItemId, type ItemState } from '../../engine';
import { partSits } from '../../shell/parts';

/**
 * A table opens when the steps of its räknestigar can be taken
 * (docs/PLAN-HUNDRA.md): ×10 waits for whole tens on Stigen, ×5 and ×4 for
 * doubling and halving, ×3, ×9 and ×6 for going over the ten, and the squares,
 * ×7 and ×8 for two-digit sums. ×2 and ×1 wait for nothing. A table that is
 * already open or started never waits (the engine's `heldUnitIds`).
 */
export const TABLES_WAIT: Record<string, readonly string[]> = {
  u10: ['tiotal'],
  u5: ['dubbla'],
  u4: ['dubbla'],
  u3: ['overtio'],
  u9: ['overtio'],
  u6: ['overtio'],
  usq: ['tvasiffr'],
  u78: ['tvasiffr'],
};

/**
 * A table waits at most this long after it could have opened (its own rule in
 * the garden met). Simulated children showed hard waits to stall the garden
 * for months (docs/PLAN-HUNDRA.md, Fynd från H5); three weeks keeps the order
 * and costs little.
 */
export const WAIT_DAYS_MAX = 21;

/** The day an adult opened a table: long enough ago that it waits no more. */
export const OPENED_BY_ADULT: DayKey = '2000-01-01';

/**
 * Which of the waiting tables are held today. `ready` is the day each table
 * could first have opened; tables that can open today and have no day yet get
 * today (returned in `ready`, to be kept).
 */
export function heldTables(
  waiting: readonly string[],
  couldOpen: ReadonlySet<string>,
  ready: Readonly<Record<string, DayKey>>,
  today: DayKey,
  maxDays = WAIT_DAYS_MAX,
): { held: string[]; ready: Record<string, DayKey>; changed: boolean } {
  const out = { ...ready };
  let changed = false;
  for (const u of waiting) {
    if (couldOpen.has(u) && out[u] === undefined) {
      out[u] = today;
      changed = true;
    }
  }
  const held = waiting.filter((u) => out[u] === undefined || diffDays(out[u]!, today) < maxDays);
  return { held, ready: out, changed };
}

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
    garden !== undefined && Object.entries(TABLES_WAIT).some(([table, needs]) => needs.includes(part) && partSits(garden.pack, garden.states, table));
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
