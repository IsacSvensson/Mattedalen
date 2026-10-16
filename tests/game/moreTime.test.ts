import { describe, expect, it } from 'vitest';
import { createEngine, DEFAULT_CONFIG, emptyState, type ItemState } from '../../src/engine';
import { createMultiplicationPack } from '../../src/content/multiplication';
import { DEFAULT_SETTINGS, decodeTransfer, encodeTransfer, EXPORT_FORMAT, MemoryProgressStore, parseExport, type Profile } from '../../src/storage';
import { engineFor, moreTime } from '../../src/shell/play';
import { bestTimes, QUICK_FACTS, SLOW_QUICK_MS, slowButRight, slowFacts } from '../../src/shell/stats';
import { transferOf } from '../../src/shell/transfer';

/** "Ge mer tid" and the facts it would help with (docs/PLAN-GRANSKNING.md, S2). */
const pack = createMultiplicationPack();
const profile: Profile = { id: 'p', name: 'Alva', avatar: '🦊', createdAt: 0, settings: { ...DEFAULT_SETTINGS } };
const deps = { store: new MemoryProgressStore(), pack };
const facts = pack.items.map((it) => it.id);

/** A sprout answered right, without help, on two days, the best time `rtMs` each day. */
const sprout = (id: string, rtMs: number): ItemState => ({
  ...emptyState(id),
  status: 'learning',
  introducedDay: '2026-02-01',
  dayBest: { '2026-02-02': { choice: rtMs }, '2026-02-04': { free: rtMs + 500 } },
});
const states = (rtMs: (i: number) => number, n: number) => Object.fromEntries(facts.slice(0, n).map((id, i) => [id, sprout(id, rtMs(i))]));

describe('Ge mer tid', () => {
  it('doubles the time for a bush and a tree, and nothing else', () => {
    const plain = engineFor(profile, deps).config.status;
    const more = engineFor({ ...profile, settings: { ...profile.settings, moreTime: true } }, deps).config.status;
    expect(plain).toMatchObject({ fluentRtMs: 5000, automaticRtMs: 4000 });
    expect(more).toEqual({ ...plain, fluentRtMs: 10_000, automaticRtMs: 8000 });
    expect(moreTime(DEFAULT_CONFIG.status)).toEqual({ fluentRtMs: 10_000, automaticRtMs: 8000 });
  });

  it('travels in backups and QR codes', () => {
    const backup = (settings: Record<string, unknown>) => ({
      format: EXPORT_FORMAT,
      version: 1,
      exportedAt: 1,
      profile: { id: 'p', name: 'Alva', avatar: '🦊', createdAt: 1, settings: { sessionMinutes: 12, readAloud: false, allowFree: true, ...settings } },
      progress: [],
      sessions: [],
      attempts: [],
    });
    expect(parseExport(backup({ moreTime: true })).profile.settings.moreTime).toBe(true);
    expect(parseExport(backup({ moreTime: 'ja' })).profile.settings.moreTime).toBeUndefined();
    const code = (settings: Partial<Profile['settings']>) =>
      decodeTransfer(encodeTransfer(transferOf({ ...profile, settings: { ...profile.settings, ...settings } }, [{ pack, states: {} }])));
    expect(code({ moreTime: true }).moreTime).toBe(true);
    expect(code({}).moreTime).toBeUndefined();
  });
});

describe('the facts more time would help with', () => {
  const engine = createEngine({ pack });

  it('counts sprouts right on two days but never under the limit', () => {
    expect(slowButRight(engine, states(() => 7000, 10))).toBe(10);
    // Under the limit they would already be bushes; one good day is not enough either.
    expect(slowButRight(engine, states(() => 3000, 10))).toBe(0);
    const once = { [facts[0]!]: { ...sprout(facts[0]!, 7000), dayBest: { '2026-02-02': { choice: 7000 } } } };
    expect(slowButRight(engine, once)).toBe(0);
  });

  it('knows a child slow in itself from one who has trouble remembering', () => {
    const helps = (...places: Record<string, ItemState>[]) => slowFacts(places.map((st) => ({ slow: slowButRight(engine, st), bestTimes: bestTimes(st) })));
    // Slow in itself: even the quickest facts take more than 3.7 s.
    const slow = states((i) => 4500 + i * 100, 12);
    expect(bestTimes(slow)[QUICK_FACTS - 1]).toBeGreaterThanOrEqual(SLOW_QUICK_MS);
    expect(helps(slow)).toBe(12);
    // Trouble remembering: the easiest facts are quick, the rest are worked out slowly.
    const weak = states((i) => (i < 10 ? 2500 : 8000), 20);
    expect(slowButRight(engine, weak)).toBe(10);
    expect(helps(weak)).toBe(0);
    // The child's speed is the child's own: its quickest facts may be at another place.
    const brook = Object.fromEntries(facts.slice(40, 50).map((id) => [id, { ...emptyState(id), status: 'automatic' as const, dayBest: { '2026-02-03': { free: 2200 } } }]));
    expect(helps(states(() => 8000, 12), brook)).toBe(0);
    // Too little to tell.
    expect(helps(states(() => 6000, 9))).toBe(0);
  });
});
