import type { Rng } from '../../engine';
import { formatDivision, SHARE_TASKS, shareId, shareText, type ShareTask } from './division';
import { formatFact } from './facts';

/**
 * Trädgårdens koll: separate check tasks, the same blueprint every time and
 * not adapted to the child (as Bäckens koll). In an adaptive session the share
 * of right answers is pushed towards the target and does not show what the
 * child can, so this is the measure of mastery: multiplications, divisions in
 * the usual form and with a missing factor, and "Dela lika" with a picture.
 * The easiest tables (×1 and ×10) are left out of the facts.
 */

export type GardenCheckCategory = 'times' | 'division' | 'missing' | 'share';

/** The kinds of tasks, with a short name for narrow tables. */
export const GARDEN_CHECK_CATEGORIES: { id: GardenCheckCategory; title: string; short: string; count: number }[] = [
  { id: 'times', title: 'Gånger', short: 'Gånger', count: 4 },
  { id: 'division', title: 'Delat med', short: 'Delat med', count: 3 },
  { id: 'missing', title: 'Saknad faktor (__ × 3 = 21)', short: 'Saknad faktor', count: 2 },
  { id: 'share', title: 'Dela lika, med bild', short: 'Dela lika', count: 3 },
];

export interface GardenCheckItem {
  /** A fact id (`3x7`, `21/3`), a missing factor (`chk:_x3=21`) or a "Dela lika" task. */
  id: string;
  /** As shown, with `__` for the blank. */
  prompt: string;
  answer: string;
  category: GardenCheckCategory;
  /** The picture for a "Dela lika" task. */
  share?: ShareTask;
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const pairs = () => range(2, 9).flatMap((a) => range(2, 9).map((b) => [a, b] as const));

const POOLS: Record<GardenCheckCategory, () => GardenCheckItem[]> = {
  times: () => pairs().map(([a, b]) => ({ id: `${a}x${b}`, prompt: `${formatFact(a, b)} = __`, answer: String(a * b), category: 'times' })),
  division: () =>
    pairs().map(([a, b]) => ({ id: `${a * b}/${b}`, prompt: `${formatDivision(a * b, b)} = __`, answer: String(a), category: 'division' })),
  missing: () => pairs().map(([a, b]) => ({ id: `chk:_x${b}=${a * b}`, prompt: `__ × ${b} = ${a * b}`, answer: String(a), category: 'missing' })),
  share: () => SHARE_TASKS.map((t) => ({ id: shareId(t), prompt: shareText(t), answer: String(t.answer), category: 'share', share: t })),
};

function pick<T>(pool: T[], n: number, rng: Rng): T[] {
  const left = [...pool];
  const out: T[] = [];
  while (out.length < n && left.length) out.push(left.splice(Math.floor(rng.next() * left.length), 1)[0]!);
  return out;
}

/**
 * One check: the same number of tasks of each kind every time, drawn at
 * random within each kind (never chosen after what the child knows), taken in
 * turns so that the kinds are mixed. A division is never the family of a
 * multiplication in the same check, so one does not give the other away.
 */
export function buildGardenCheck(rng: Rng): GardenCheckItem[] {
  const drawn: GardenCheckItem[][] = [];
  const families = new Set<string>();
  const family = (it: GardenCheckItem) => {
    const n = it.id.match(/\d+/g)?.map(Number) ?? [];
    if (it.category === 'times') return `${Math.min(n[0]!, n[1]!)}:${Math.max(n[0]!, n[1]!)}`;
    const [x, y] = it.category === 'division' ? [n[0]! / n[1]!, n[1]!] : [n[1]! / n[0]!, n[0]!];
    return `${Math.min(x, y)}:${Math.max(x, y)}`;
  };
  for (const { id, count } of GARDEN_CHECK_CATEGORIES) {
    const chosen: GardenCheckItem[] = [];
    // In random order, skipping families already drawn (also within the kind: 3 × 7 and 7 × 3).
    for (const it of pick(POOLS[id](), Number.MAX_SAFE_INTEGER, rng)) {
      if (chosen.length === count) break;
      if (id !== 'share' && families.has(family(it))) continue;
      chosen.push(it);
      if (id !== 'share') families.add(family(it));
    }
    drawn.push(chosen);
  }
  const out: GardenCheckItem[] = [];
  for (let i = 0; drawn.some((d) => d.length > i); i++) for (const d of drawn) if (d[i]) out.push(d[i]!);
  return out;
}

export interface GardenCheckAnswer {
  item: GardenCheckItem;
  given: string;
  rtMs: number;
}

/** An answer counts as quick when it came within this time (as for "automatic"). */
export const GARDEN_QUICK_MS = 3000;

/**
 * The check as numbers for the session record: per kind how many were right
 * and how many of those were quick, and per task the time of a right answer
 * (or -1).
 */
export function summarizeGardenCheck(answers: GardenCheckAnswer[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { id } of GARDEN_CHECK_CATEGORIES) Object.assign(out, { [`${id}:total`]: 0, [`${id}:right`]: 0, [`${id}:quick`]: 0 });
  for (const a of answers) {
    const right = a.given.trim() === a.item.answer;
    const cat = a.item.category;
    out[`${cat}:total`]!++;
    if (right) out[`${cat}:right`]!++;
    if (right && a.rtMs <= GARDEN_QUICK_MS) out[`${cat}:quick`]!++;
    out[`item:${a.item.id}`] = right ? Math.round(a.rtMs) : -1;
  }
  return out;
}
