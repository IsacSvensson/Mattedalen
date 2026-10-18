import { describe, expect, it } from 'vitest';
import { NEWS, newsSince } from '../../src/shell/news';

describe('what is new (docs/PLAN-UPPDATERING.md, U2)', () => {
  it('posts are newest first, each with its own id and one to three short points', () => {
    expect(new Set(NEWS.map((n) => n.id)).size).toBe(NEWS.length);
    for (let i = 1; i < NEWS.length; i++) expect(NEWS[i - 1]!.day >= NEWS[i]!.day).toBe(true);
    for (const n of NEWS) {
      expect(n.points.length).toBeGreaterThanOrEqual(1);
      expect(n.points.length).toBeLessThanOrEqual(3);
    }
  });

  it('shows the posts newer than the one seen; all of them when the seen one is gone', () => {
    expect(newsSince(NEWS[0]!.id)).toEqual([]);
    expect(newsSince(NEWS[2]!.id)).toEqual([NEWS[0], NEWS[1]]);
    expect(newsSince('an old post')).toEqual([...NEWS]);
  });
});
