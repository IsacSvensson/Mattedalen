import { describe, expect, it } from 'vitest';
import { seededRng } from '../../src/engine';
import { buildPathCheck, CHECK_CATEGORIES, crossesTen, parseTaskId, summarizePathCheck, taskAnswer } from '../../src/content/hundred';

describe('Stigens koll', () => {
  it('has the same number of each kind every time, drawn from all numbers to 100', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const items = buildPathCheck(seededRng(seed));
      expect(items).toHaveLength(16);
      for (const { id, count } of CHECK_CATEGORIES) expect(items.filter((i) => i.category === id)).toHaveLength(count);
      expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
      for (const item of items) {
        const t = parseTaskId(item.id);
        expect(String(taskAnswer(t))).toBe(item.answer);
        expect(Number(item.answer)).toBeLessThanOrEqual(100);
        expect(item.prompt).toContain('__');
        if (item.category === 'plus' || item.category === 'minus') expect(crossesTen(t)).toBe(true);
        seen.add(item.id);
      }
    }
    // Not only Stigen's own tasks: 47 + 8 is practised, but most over-ten tasks in the check are not.
    expect(seen.size).toBeGreaterThan(300);
  });

  it('counts right and quick answers per kind', () => {
    const items = buildPathCheck(seededRng(1));
    const out = summarizePathCheck(items.map((item, i) => ({ item, given: i === 0 ? '0' : item.answer, rtMs: 2000 })));
    expect(out[`${items[0]!.category}:right`]).toBe(CHECK_CATEGORIES.find((c) => c.id === items[0]!.category)!.count - 1);
    expect(out[`item:${items[0]!.id}`]).toBe(-1);
  });
});
