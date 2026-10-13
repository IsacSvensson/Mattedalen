import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { emptyState, initialLearnerMeta, DEFAULT_CONFIG } from '../../src/engine';
import {
  DEFAULT_SETTINGS,
  EXPORT_FORMAT,
  ImportError,
  IndexedDbProgressStore,
  maybeCompactLog,
  MemoryProgressStore,
  type Profile,
  type Progress,
  type ProgressStore,
  type SessionRecord,
  type StoredAttempt,
} from '../../src/storage';

let dbCounter = 0;
let idCounter = 0;
const newId = () => `id-${++idCounter}`;

const implementations: [string, () => Promise<ProgressStore>][] = [
  ['memory', async () => new MemoryProgressStore(newId)],
  ['indexeddb', () => IndexedDbProgressStore.open(`test-${++dbCounter}`, newId)],
];

const profile = (id: string, name = 'Alva', createdAt = 1): Profile => ({ id, name, avatar: '🦊', createdAt, settings: { ...DEFAULT_SETTINGS } });

const progress = (profileId: string, packId = 'multiplication'): Progress => {
  const s = { ...emptyState('3x7'), status: 'fluent' as const, box: 3, dueDay: '2026-03-01', confusions: { '24': 2 } };
  return {
    profileId,
    packId,
    packVersion: 1,
    states: { '3x7': s, '2x2': emptyState('2x2') },
    meta: initialLearnerMeta(DEFAULT_CONFIG, ['u10']),
    updatedAt: 5,
  };
};

const attempt = (profileId: string, ts: number, itemId = '3x7', correct = true, rtMs = 2000): StoredAttempt => ({
  profileId,
  packId: 'multiplication',
  itemId,
  ts,
  sessionId: 's1',
  format: 'choice',
  kind: 'mixed',
  given: correct ? '21' : '24',
  correct,
  rtMs,
});

const session = (profileId: string, id: string, startedAt: number): SessionRecord => ({
  id,
  profileId,
  packId: 'multiplication',
  mode: 'daily',
  day: '2026-02-02',
  startedAt,
  endedAt: startedAt + 720_000,
  answered: 100,
  correct: 87,
  introduced: ['3x7'],
});

describe.each(implementations)('ProgressStore (%s)', (_name, open) => {
  it('stores and lists profiles in creation order', async () => {
    const store = await open();
    await store.saveProfile(profile('b', 'Bo', 2));
    await store.saveProfile(profile('a', 'Alva', 1));
    expect((await store.listProfiles()).map((p) => p.name)).toEqual(['Alva', 'Bo']);
    await store.saveProfile({ ...profile('a', 'Alva'), avatar: '🐢' });
    expect((await store.getProfile('a'))!.avatar).toBe('🐢');
    expect(await store.getProfile('x')).toBeUndefined();
  });

  it('saves and loads progress per profile and pack', async () => {
    const store = await open();
    await store.save(progress('a'));
    await store.save(progress('a', 'glosor'));
    const loaded = await store.load('a', 'multiplication');
    expect(loaded).toEqual(progress('a'));
    expect(await store.load('b', 'multiplication')).toBeUndefined();
    expect((await store.listProgress('a')).map((p) => p.packId).sort()).toEqual(['glosor', 'multiplication']);
  });

  it('appends and queries the attempt log', async () => {
    const store = await open();
    for (const ts of [30, 10, 20]) await store.appendAttempt(attempt('a', ts));
    await store.appendAttempt(attempt('b', 15));
    expect((await store.listAttempts('a')).map((a) => a.ts)).toEqual([10, 20, 30]);
    expect((await store.listAttempts('a', { since: 20 })).map((a) => a.ts)).toEqual([20, 30]);
    expect((await store.listAttempts('a', { limit: 2 })).map((a) => a.ts)).toEqual([20, 30]);
    expect((await store.listAttempts('a', { packId: 'glosor' })).length).toBe(0);
    expect(await store.countAttempts('a')).toBe(3);
  });

  it('keeps sessions per profile without id clashes', async () => {
    const store = await open();
    await store.saveSession(session('a', 's1', 200));
    await store.saveSession(session('a', 's2', 100));
    await store.saveSession(session('b', 's1', 300));
    expect((await store.listSessions('a')).map((s) => s.id)).toEqual(['s2', 's1']);
    expect((await store.listSessions('b')).map((s) => s.id)).toEqual(['s1']);
  });

  it('deletes a profile with everything that belongs to it, and nothing else', async () => {
    const store = await open();
    for (const id of ['a', 'b']) {
      await store.saveProfile(profile(id));
      await store.save(progress(id));
      await store.appendAttempt(attempt(id, 1));
      await store.saveSession(session(id, 's1', 1));
    }
    await store.compactLog('a', 0);
    await store.deleteProfile('a');
    expect(await store.getProfile('a')).toBeUndefined();
    expect(await store.load('a', 'multiplication')).toBeUndefined();
    expect(await store.listAttempts('a')).toEqual([]);
    expect(await store.listSessions('a')).toEqual([]);
    expect(await store.listDaySummaries('a')).toEqual([]);
    expect(await store.getProfile('b')).toBeDefined();
    expect(await store.countAttempts('b')).toBe(1);
  });

  it('compacts old attempts into per-day summaries', async () => {
    const store = await open();
    const day1 = new Date(2026, 1, 2, 16).getTime();
    const day2 = new Date(2026, 1, 3, 16).getTime();
    await store.appendAttempt(attempt('a', day1, '3x7', true, 1000));
    await store.appendAttempt(attempt('a', day1 + 1, '3x7', false, 3000));
    await store.appendAttempt(attempt('a', day1 + 2, '2x2', true, 500));
    await store.appendAttempt(attempt('a', day2, '3x7', true, 1500));
    await store.appendAttempt(attempt('a', day2 + 1, '3x7', true, 1500));

    expect(await store.compactLog('a', 2)).toBe(3);
    expect((await store.listAttempts('a')).map((a) => a.ts)).toEqual([day2, day2 + 1]);
    const sums = (await store.listDaySummaries('a')).sort((x, y) => x.itemId.localeCompare(y.itemId));
    expect(sums).toEqual([
      { profileId: 'a', packId: 'multiplication', day: '2026-02-02', itemId: '2x2', attempts: 1, correct: 1, totalRtMs: 500 },
      { profileId: 'a', packId: 'multiplication', day: '2026-02-02', itemId: '3x7', attempts: 2, correct: 1, totalRtMs: 4000 },
    ]);

    // Compacting again merges into the existing summaries.
    expect(await store.compactLog('a', 0)).toBe(2);
    const merged = (await store.listDaySummaries('a')).find((s) => s.day === '2026-02-03')!;
    expect(merged).toMatchObject({ attempts: 2, correct: 2, totalRtMs: 3000 });
    expect(await store.compactLog('a', 0)).toBe(0);
  });

  it('compacts only after enough slack has built up', async () => {
    const store = await open();
    for (let i = 0; i < 12; i++) await store.appendAttempt(attempt('a', i));
    expect(await maybeCompactLog(store, 'a', 5, 10)).toBe(0);
    await store.appendAttempt(attempt('a', 99));
    await store.appendAttempt(attempt('a', 100));
    await store.appendAttempt(attempt('a', 101));
    await store.appendAttempt(attempt('a', 102));
    expect(await maybeCompactLog(store, 'a', 5, 10)).toBe(11);
    expect(await store.countAttempts('a')).toBe(5);
  });

  it('stores small settings', async () => {
    const store = await open();
    expect(await store.getSetting('pin')).toBeUndefined();
    await store.setSetting('pin', '1234');
    await store.setSetting('lastProfile', { id: 'a' });
    expect(await store.getSetting('pin')).toBe('1234');
    expect(await store.getSetting('lastProfile')).toEqual({ id: 'a' });
  });

  it('exports a profile and restores it on another device', async () => {
    const source = await open();
    await source.saveProfile(profile('a'));
    await source.save(progress('a'));
    await source.saveSession(session('a', 's1', 1));
    for (let i = 0; i < 5; i++) await source.appendAttempt(attempt('a', i));
    await source.compactLog('a', 3);
    const backup = await source.export('a');
    expect(backup.format).toBe(EXPORT_FORMAT);

    // Through JSON, as when saved to a file.
    const target = await open();
    const imported = await target.import(JSON.parse(JSON.stringify(backup)));
    expect(imported).toEqual(profile('a'));
    expect(await target.load('a', 'multiplication')).toEqual(progress('a'));
    expect(await target.listSessions('a')).toEqual([session('a', 's1', 1)]);
    expect((await target.listAttempts('a')).map((x) => x.ts)).toEqual([2, 3, 4]);
    expect(await target.listDaySummaries('a')).toEqual(await source.listDaySummaries('a'));
  });

  it('imports next to an existing profile as a copy by default', async () => {
    const store = await open();
    await store.saveProfile(profile('a'));
    await store.save(progress('a'));
    const backup = await store.export('a');
    const copy = await store.import(backup);
    expect(copy.id).not.toBe('a');
    expect(copy.name).toBe('Alva (kopia)');
    expect((await store.listProfiles()).length).toBe(2);
    expect((await store.load(copy.id, 'multiplication'))!.profileId).toBe(copy.id);
  });

  it('can replace an existing profile', async () => {
    const store = await open();
    await store.saveProfile(profile('a'));
    await store.save(progress('a'));
    await store.appendAttempt(attempt('a', 1));
    const backup = await store.export('a');
    await store.appendAttempt(attempt('a', 2));
    await store.save({ ...progress('a'), updatedAt: 99 });
    await store.import(backup, { onConflict: 'replace' });
    expect((await store.listProfiles()).length).toBe(1);
    expect((await store.load('a', 'multiplication'))!.updatedAt).toBe(5);
    expect((await store.listAttempts('a')).map((x) => x.ts)).toEqual([1]);
  });

  it('rejects files that are not backups', async () => {
    const store = await open();
    await expect(store.import({ hello: 'world' } as never)).rejects.toBeInstanceOf(ImportError);
    await expect(store.import('not json' as never)).rejects.toThrow('JSON');
    await expect(store.import({ format: EXPORT_FORMAT, version: 99 } as never)).rejects.toThrow('nyare version');
    expect(await store.listProfiles()).toEqual([]);
  });
});
