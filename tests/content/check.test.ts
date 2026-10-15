import { describe, expect, it } from 'vitest';
import { seededRng } from '../../src/engine';
import { buildCheck, CHECK_CATEGORIES, EQUALITIES, equalityId, summarizeCheck, type CheckItem } from '../../src/content/addition';
import { checkDue, CHECK_EVERY_PLAY_DAYS } from '../../src/places/backen/check';
import type { SessionRecord } from '../../src/storage';

/** The value of one side of a prompt, with x for the blank: "8 + 4", "x + 5", "13 − 5". */
function side(text: string, x: number): number {
  const tokens = text.replace('__', String(x)).match(/\d+|[+−]/g)!;
  let v = Number(tokens[0]);
  for (let i = 1; i < tokens.length; i += 2) v += (tokens[i] === '+' ? 1 : -1) * Number(tokens[i + 1]);
  return v;
}

/** The blank that makes both sides equal. */
function solve(item: CheckItem): number {
  const [l, r] = item.prompt.split('=') as [string, string];
  for (let x = 0; x <= 20; x++) if (side(l, x) === side(r, x)) return x;
  throw new Error(`no answer for ${item.prompt}`);
}

describe('Bäckens koll', () => {
  it('has the same blueprint every time: 3 within ten, 3 plus and 3 minus over ten, 4 new equalities', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const items = buildCheck(seededRng(seed));
      for (const { id, count } of CHECK_CATEGORIES) expect(items.filter((i) => i.category === id)).toHaveLength(count);
      expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    }
  });

  it('draws at random within each kind, so it is not chosen after what the child knows', () => {
    const a = buildCheck(seededRng(1)).map((i) => i.id);
    const b = buildCheck(seededRng(2)).map((i) => i.id);
    expect(a).not.toEqual(b);
    expect(buildCheck(seededRng(1)).map((i) => i.id)).toEqual(a);
  });

  it('mixes the kinds and has the right answers', () => {
    const items = buildCheck(seededRng(7));
    expect(items.slice(0, 4).map((i) => i.category)).toEqual(['inom10', 'plus', 'minus', 'equality']);
    for (let seed = 1; seed <= 30; seed++) for (const item of buildCheck(seededRng(seed))) expect(String(solve(item)), item.prompt).toBe(item.answer);
  });

  it('checks the kinds it says: within ten, over ten, and the equal sign in forms never practised', () => {
    const practised = new Set(EQUALITIES.map((e) => equalityId(e).replace('eq:', '')));
    for (let seed = 1; seed <= 30; seed++) {
      for (const item of buildCheck(seededRng(seed))) {
        const numbers = item.prompt.match(/\d+/g)!.map(Number);
        if (item.category === 'inom10') expect(Math.max(...numbers, Number(item.answer))).toBeLessThanOrEqual(10);
        if (item.category === 'plus') expect(Number(item.answer)).toBeGreaterThan(10);
        if (item.category === 'minus') expect(numbers[0]).toBeGreaterThan(10);
        if (item.category === 'equality') {
          expect(item.prompt).toMatch(/__/);
          expect(practised.has(item.id.replace('chk:', ''))).toBe(false);
        }
      }
    }
  });

  it('is summed up per kind, with quick answers and every task kept', () => {
    const items = buildCheck(seededRng(3));
    const answers = items.map((item, i) => ({ item, given: i % 2 ? item.answer : '0', rtMs: i % 4 === 1 ? 1200 : 4500 }));
    const sum = summarizeCheck(answers);
    const right = CHECK_CATEGORIES.reduce((n, c) => n + sum[`${c.id}:right`]!, 0);
    expect(right).toBe(answers.filter((a) => a.given === a.item.answer).length);
    expect(CHECK_CATEGORIES.reduce((n, c) => n + sum[`${c.id}:total`]!, 0)).toBe(items.length);
    expect(CHECK_CATEGORIES.reduce((n, c) => n + sum[`${c.id}:quick`]!, 0)).toBe(answers.filter((a, i) => a.given === a.item.answer && i % 4 === 1).length);
    expect(sum[`item:${items[0]!.id}`]).toBe(-1);
    expect(sum[`item:${items[1]!.id}`]).toBe(1200);
  });
});

describe('when the check comes', () => {
  const session = (day: string, mode: SessionRecord['mode'] = 'daily', answered = 5): SessionRecord => ({
    id: `${mode}-${day}`,
    profileId: 'p',
    packId: 'addition',
    mode,
    day,
    startedAt: 0,
    endedAt: 1,
    answered,
    correct: answered,
    introduced: [],
  });
  const days = (n: number, from = 1) => Array.from({ length: n }, (_, i) => `2026-03-${String(from + i).padStart(2, '0')}`);

  it('comes first on the second day at the brook, as a baseline', () => {
    expect(checkDue([], 'addition', '2026-03-01')).toBe(false);
    expect(checkDue([session('2026-03-01')], 'addition', '2026-03-01')).toBe(false);
    expect(checkDue([session('2026-03-01')], 'addition', '2026-03-05')).toBe(true);
    // Days in another place, or days without answers, do not count.
    expect(checkDue([{ ...session('2026-03-01'), packId: 'multiplication' }], 'addition', '2026-03-05')).toBe(false);
    expect(checkDue([session('2026-03-01', 'daily', 0)], 'addition', '2026-03-05')).toBe(false);
  });

  it('then comes about every seventh play day', () => {
    const before = [session('2026-02-27'), session('2026-02-28', 'check')];
    const six = days(CHECK_EVERY_PLAY_DAYS - 1).map((d) => session(d));
    expect(checkDue([...before, ...six.slice(0, -1)], 'addition', '2026-03-20')).toBe(false);
    expect(checkDue([...before, ...six], 'addition', '2026-03-20')).toBe(true);
  });

  it('never twice a day, and waits when the child said "not now"', () => {
    expect(checkDue([session('2026-03-01'), session('2026-03-05', 'check')], 'addition', '2026-03-05')).toBe(false);
    expect(checkDue([session('2026-03-01')], 'addition', '2026-03-05', '2026-03-05')).toBe(false);
    expect(checkDue([session('2026-03-01')], 'addition', '2026-03-06', '2026-03-05')).toBe(true);
  });
});
