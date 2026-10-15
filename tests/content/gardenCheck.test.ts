import { describe, expect, it } from 'vitest';
import { emptyState, Placement, seededRng, validatePack, type ItemState } from '../../src/engine';
import {
  buildGardenCheck,
  createMultiplicationPack,
  divisionPlacementPack,
  GARDEN_CHECK_CATEGORIES,
  isDivisionId,
  summarizeGardenCheck,
  tableFocusId,
} from '../../src/content/multiplication';
import { focusWithDivisions } from '../../src/places/tradgarden/division';

const pack = createMultiplicationPack({ division: true });
const at = (id: string, status: ItemState['status']): ItemState => ({ ...emptyState(id), status, box: 3 });

describe('Trädgårdens koll', () => {
  it('has the same kinds of tasks every time, with right answers', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const check = buildGardenCheck(seededRng(seed));
      expect(check).toHaveLength(12);
      for (const { id, count } of GARDEN_CHECK_CATEGORIES) expect(check.filter((c) => c.category === id)).toHaveLength(count);
      for (const c of check) {
        const n = c.prompt.match(/\d+/g)!.map(Number);
        if (c.category === 'times') expect(Number(c.answer)).toBe(n[0]! * n[1]!);
        if (c.category === 'division') expect(Number(c.answer)).toBe(n[0]! / n[1]!);
        if (c.category === 'missing') expect(Number(c.answer) * n[0]!).toBe(n[1]!);
        if (c.category === 'share') expect(c.share).toBeDefined();
        // Not the easiest tables.
        if (c.category !== 'share') expect(n.slice(0, 2).every((x) => x >= 2)).toBe(true);
      }
    }
  });

  it('never asks a family twice in one check, so one task does not give another away', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const families = buildGardenCheck(seededRng(seed))
        .filter((c) => c.category !== 'share')
        .map((c) => {
          const n = c.prompt.match(/\d+/g)!.map(Number);
          const [x, y] = c.category === 'times' ? [n[0]!, n[1]!] : c.category === 'division' ? [n[0]! / n[1]!, n[1]!] : [n[1]! / n[0]!, n[0]!];
          return `${Math.min(x, y)}:${Math.max(x, y)}`;
        });
      expect(new Set(families).size).toBe(families.length);
    }
  });

  it('is summarized per kind: right answers and how many were quick', () => {
    const check = buildGardenCheck(seededRng(4));
    const out = summarizeGardenCheck(check.map((item, i) => ({ item, given: i % 2 ? item.answer : '0', rtMs: i < 6 ? 1500 : 6000 })));
    const total = GARDEN_CHECK_CATEGORIES.reduce((sum, { id }) => sum + out[`${id}:total`]!, 0);
    expect(total).toBe(12);
    expect(GARDEN_CHECK_CATEGORIES.reduce((sum, { id }) => sum + out[`${id}:right`]!, 0)).toBe(6);
    expect(GARDEN_CHECK_CATEGORIES.reduce((sum, { id }) => sum + out[`${id}:quick`]!, 0)).toBe(3);
  });
});

describe('the start check with delat med', () => {
  it('tests only the divisions of families that sit, part after part', () => {
    expect(divisionPlacementPack(pack, {})).toBeNull();
    const states: Record<string, ItemState> = {};
    for (const t of [10, 2]) for (let n = 1; n <= 10; n++) for (const id of [`${t}x${n}`, `${n}x${t}`]) states[id] = at(id, 'fluent');
    const part = divisionPlacementPack(pack, states)!;
    expect(() => validatePack(part)).not.toThrow();
    expect(part.units.map((u) => u.id)).toEqual(['d10', 'd2']);
    expect(part.units[1]!.unlockRule).toMatchObject({ kind: 'previous' });
    const ids = part.units.flatMap((u) => u.itemIds);
    expect(ids).toContain('30/10');
    expect(ids).toContain('6/2');
    // 6 ÷ 3 is in Dela med 2 too (the family {2, 3, 6}), and it sits since 2 × 3 and 3 × 2 do.
    expect(ids).toContain('6/3');
    // 15 ÷ 5 waits: 3 × 5 does not sit.
    expect(ids).not.toContain('15/5');
    expect(part.items.every((it) => isDivisionId(it.id) && !it.requires)).toBe(true);
    // The engine's check runs on it like on any pack.
    const placement = new Placement(part, seededRng(1));
    for (let item = placement.next(); item; item = placement.next()) placement.submit(item.answer, 1500);
    expect(placement.result().passedUnitIds).toEqual(['d10', 'd2']);
  });
});

describe('Öva en tabell with delat med', () => {
  const set = pack.focusSets!.find((s) => s.id === tableFocusId(2))!;

  it('leaves delat med out until its part is open', () => {
    expect(focusWithDivisions(set, {}, ['u10', 'u2'])).toBe(set);
  });

  it('takes the divisions of open parts, and those met already', () => {
    const withOpen = focusWithDivisions(set, {}, ['u10', 'delalika', 'd10', 'u2', 'd2']);
    expect(withOpen.itemIds.slice(0, set.itemIds.length)).toEqual(set.itemIds);
    expect(withOpen.itemIds).toEqual(expect.arrayContaining(['20/10', '20/2', '4/2', '14/2', '14/7']));
    // Dela med 2 not open yet: only the family {2, 10, 20}, which belongs to Dela med 10.
    const tensOnly = focusWithDivisions(set, {}, ['u10', 'delalika', 'd10', 'u2']);
    expect(tensOnly.itemIds.filter(isDivisionId).sort()).toEqual(['20/10', '20/2']);
    const met = focusWithDivisions(set, { '14/7': at('14/7', 'learning') }, ['u10', 'u2']);
    expect(met.itemIds.filter(isDivisionId)).toEqual(['14/7']);
  });
});
