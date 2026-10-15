import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createEngine, ManualClock, seededRng } from '../../src/engine';
import { createMultiplicationPack } from '../../src/content/multiplication';
import {
  DEFAULT_SETTINGS,
  EXPORT_FORMAT,
  exportFileName,
  ImportError,
  IndexedDbProgressStore,
  MIGRATIONS,
  openProgressDb,
  parseExport,
  persistenceStatus,
  requestPersistence,
  storageEstimate,
  type Migration,
  type Profile,
} from '../../src/storage';

let n = 0;
const dbName = () => `idb-test-${++n}`;
const alva: Profile = { id: 'a', name: 'Alva', avatar: '🦊', createdAt: 1, settings: { ...DEFAULT_SETTINGS } };

describe('IndexedDB store', () => {
  it('keeps data when the app is reopened', async () => {
    const name = dbName();
    const first = await IndexedDbProgressStore.open(name);
    await first.saveProfile(alva);
    first.close();
    const second = await IndexedDbProgressStore.open(name);
    expect(await second.listProfiles()).toEqual([alva]);
  });

  it('runs only the migrations that are missing', async () => {
    const name = dbName();
    const v1 = await openProgressDb(name);
    expect(v1.version).toBe(MIGRATIONS.length);
    await v1.put('profiles', { ...alva, name: 'alva' });
    v1.close();

    const ran: number[] = [];
    // A future v2 that tidies names. Data written by v1 must survive.
    const v2: Migration = (_db, tx) => {
      ran.push(2);
      void tx
        .objectStore('profiles')
        .openCursor()
        .then(async function fix(cursor): Promise<void> {
          if (!cursor) return;
          await cursor.update({ ...cursor.value, name: cursor.value.name.toUpperCase() });
          return fix(await cursor.continue());
        });
    };
    const spyV1: Migration = () => ran.push(1);
    const upgraded = await openProgressDb(name, [spyV1, v2]);
    expect(upgraded.version).toBe(2);
    expect(ran).toEqual([2]);
    expect((await upgraded.get('profiles', 'a'))!.name).toBe('ALVA');
  });

  it('carries a real session through storage and back', async () => {
    const name = dbName();
    const clock = new ManualClock(Date.UTC(2026, 1, 2, 15));
    const pack = createMultiplicationPack();
    const engine = createEngine({ pack, clock, rng: seededRng(1) });
    let store = await IndexedDbProgressStore.open(name);
    await store.saveProfile(alva);

    // Play a session, saving after every answer like the game will.
    const session = engine.startSession({ states: engine.initialStates(), meta: engine.initialMeta() });
    for (let q = session.next(); q; q = session.next()) {
      clock.advance(4000);
      const fb = session.submit(q.seq % 5 === 0 ? '0' : q.item.answer, 2500);
      await store.appendAttempt({ ...fb.attempt, profileId: alva.id, packId: pack.id });
      await store.save({
        profileId: alva.id,
        packId: pack.id,
        packVersion: pack.version,
        states: session.stateRecord(),
        meta: session.summary().meta,
        updatedAt: clock.now(),
      });
    }
    const summary = session.summary();
    store.close();

    // Reopen (new page load) and continue the next day.
    store = await IndexedDbProgressStore.open(name);
    const loaded = (await store.load(alva.id, pack.id))!;
    expect(loaded.states).toEqual(session.stateRecord());
    expect(loaded.meta).toEqual(summary.meta);
    expect(engine.dailyDone(loaded.meta)).toBe(true);
    expect(await store.countAttempts(alva.id)).toBe(summary.answered);
    const confused = Object.values(loaded.states).filter((s) => s.confusions['0']);
    expect(confused.length).toBeGreaterThan(0);

    clock.advance(86_400_000);
    const next = engine.startSession({ states: loaded.states, meta: loaded.meta });
    expect(next.next()).not.toBeNull();
  });
});

describe('persistent storage', () => {
  it('reports when the browser grants persistence', async () => {
    let granted = false;
    const manager = { persisted: async () => granted, persist: async () => (granted = true) };
    expect(await persistenceStatus(manager)).toBe('not-persisted');
    expect(await requestPersistence(manager)).toBe('persisted');
    expect(await persistenceStatus(manager)).toBe('persisted');
  });

  it('handles refusal and missing support', async () => {
    expect(await requestPersistence({ persisted: async () => false, persist: async () => false })).toBe('not-persisted');
    expect(await requestPersistence({ persist: async () => Promise.reject(new Error('nope')) })).toBe('not-persisted');
    expect(await requestPersistence({})).toBe('unsupported');
    expect(await persistenceStatus(undefined)).toBe('unsupported');
  });

  it('estimates usage', async () => {
    expect(await storageEstimate({ estimate: async () => ({ usage: 10, quota: 100 }) })).toEqual({ usage: 10, quota: 100 });
    expect(await storageEstimate({})).toBeUndefined();
  });
});

describe('backup files', () => {
  it('repairs damaged item states instead of failing', () => {
    const data = parseExport({
      format: 'gangertradgarden-profil',
      version: 1,
      profile: { id: 'a', name: 'Alva' },
      progress: [{ packId: 'multiplication', states: { '3x7': { status: 'banana', box: -2, seen: 'x' } }, meta: {} }],
      attempts: [{ itemId: '3x7', ts: 1, id: 7 }, { nonsense: true }],
    });
    // A child from Gångerträdgården has the garden open.
    expect(data.profile.settings).toEqual({ ...DEFAULT_SETTINGS, gardenOpen: true });
    expect(data.progress[0]!.states['3x7']).toMatchObject({ status: 'new', box: 0, seen: 0 });
    expect(data.progress[0]!.meta.pacingGap).toBe(8);
    expect(data.attempts).toHaveLength(1);
    expect(data.attempts[0]).not.toHaveProperty('id');
    expect(data.sessions).toEqual([]);
  });

  it('reads backups from Mattedalen and from Gångerträdgården', () => {
    const backup = { version: 1, profile: { id: 'a', name: 'Alva' } };
    expect(parseExport({ ...backup, format: 'mattedalen-profil' }).format).toBe(EXPORT_FORMAT);
    expect(parseExport({ ...backup, format: 'gangertradgarden-profil' }).format).toBe(EXPORT_FORMAT);
    expect(() => parseExport({ ...backup, format: 'annan-app' })).toThrow(ImportError);
  });

  it('names files after the child and the date', () => {
    expect(exportFileName({ ...alva, name: 'Åsa Öberg' }, new Date(2026, 9, 13))).toBe('mattedalen-asa-oberg-2026-10-13.json');
    expect(exportFileName({ ...alva, name: '🦊' }, new Date(2026, 0, 1))).toBe('mattedalen-profil-2026-01-01.json');
  });
});
