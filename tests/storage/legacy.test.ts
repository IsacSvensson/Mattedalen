import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { openDB } from 'idb';
import { createEngine, ManualClock, seededRng } from '../../src/engine';
import { createMultiplicationPack } from '../../src/content/multiplication';
import {
  DEFAULT_SETTINGS,
  importLegacyData,
  IndexedDbProgressStore,
  LEGACY_DB_NAME,
  LEGACY_IMPORT_KEY,
  MIGRATIONS,
  MemoryProgressStore,
  openIfExists,
  openProgressDb,
  type LegacyImportRecord,
  type Profile,
} from '../../src/storage';

const pack = createMultiplicationPack();
const alva: Profile = { id: 'alva', name: 'Alva', avatar: '🦊', createdAt: 1, settings: { ...DEFAULT_SETTINGS, sessionMinutes: 10 } };
const bo: Profile = { id: 'bo', name: 'Bo', avatar: '🐢', createdAt: 2, settings: { ...DEFAULT_SETTINGS, readAloud: true } };

let n = 0;
const newStore = () => IndexedDbProgressStore.open(`mattedalen-test-${++n}`);

/** Gångerträdgården's database as it is on a child's device: schema v1, written through its own store. */
async function seedLegacy(): Promise<void> {
  const db = await openProgressDb(LEGACY_DB_NAME, MIGRATIONS.slice(0, 1));
  const old = new IndexedDbProgressStore(db);
  const clock = new ManualClock(Date.UTC(2026, 9, 1, 15));
  const engine = createEngine({ pack, clock, rng: seededRng(3) });
  for (const profile of [alva, bo]) {
    await old.saveProfile(profile);
    const session = engine.startSession({ states: engine.initialStates(), meta: engine.initialMeta() });
    for (let q = session.next(); q; q = session.next()) {
      clock.advance(4000);
      const fb = session.submit(q.seq % 4 === 0 ? '1' : q.item.answer, 2500);
      await old.appendAttempt({ ...fb.attempt, profileId: profile.id, packId: pack.id });
    }
    await old.save({
      profileId: profile.id,
      packId: pack.id,
      packVersion: pack.version,
      states: session.stateRecord(),
      meta: session.summary().meta,
      updatedAt: clock.now(),
    });
    await old.saveSession({
      id: `s-${profile.id}`,
      profileId: profile.id,
      packId: pack.id,
      mode: 'daily',
      day: '2026-10-01',
      startedAt: 1,
      endedAt: 2,
      answered: 20,
      correct: 16,
      introduced: [],
    });
  }
  await old.compactLog(bo.id, 5);
  await old.setSetting('parentPin', '2580');
  await old.setSetting('lastProfileId', bo.id);
  await old.setSetting('installBannerDismissed', true);
  await old.setSetting('somethingElse', 'stays behind');
  old.close();
}

/** Every record of a database, to check that it was left exactly as it was. */
async function snapshot(name: string): Promise<Record<string, unknown[]>> {
  const db = await openDB(name);
  const out: Record<string, unknown[]> = {};
  for (const store of db.objectStoreNames) out[store] = await db.getAll(store);
  out.settingKeys = await db.getAllKeys('settings');
  out.version = [db.version];
  db.close();
  return out;
}

async function databaseNames(): Promise<string[]> {
  return (await indexedDB.databases()).map((d) => d.name!);
}

afterEach(async () => {
  await new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(LEGACY_DB_NAME);
    request.onsuccess = request.onerror = resolve;
  });
});

describe('import from Gångerträdgården', () => {
  it('brings every child, their progress, log and sessions, and the grown-ups’ code', async () => {
    await seedLegacy();
    const before = await snapshot(LEGACY_DB_NAME);
    const old = new IndexedDbProgressStore(await openProgressDb(LEGACY_DB_NAME, MIGRATIONS.slice(0, 1)));
    const store = await newStore();

    expect(await importLegacyData(store, indexedDB, 1234)).toEqual({ status: 'imported', profiles: 2 });

    // The children come along unchanged, with the garden they played open in Mattedalen.
    const open = (p: Profile) => ({ ...p, settings: { ...p.settings, gardenOpen: true } });
    expect(await store.listProfiles()).toEqual([open(alva), open(bo)]);
    for (const p of [alva, bo]) {
      expect(await store.load(p.id, pack.id)).toEqual(await old.load(p.id, pack.id));
      expect(await store.listSessions(p.id)).toEqual(await old.listSessions(p.id));
      expect(await store.listDaySummaries(p.id)).toEqual(await old.listDaySummaries(p.id));
      const strip = (xs: { id?: number }[]) => xs.map(({ id: _id, ...rest }) => rest);
      expect(strip(await store.listAttempts(p.id))).toEqual(strip(await old.listAttempts(p.id)));
    }
    expect(await store.listDaySummaries(bo.id)).not.toEqual([]);
    expect(await store.getSetting('parentPin')).toBe('2580');
    expect(await store.getSetting('lastProfileId')).toBe(bo.id);
    expect(await store.getSetting('installBannerDismissed')).toBe(true);
    expect(await store.getSetting('somethingElse')).toBeUndefined();
    expect(await store.getSetting<LegacyImportRecord>(LEGACY_IMPORT_KEY)).toEqual({ from: LEGACY_DB_NAME, at: 1234, profiles: 2, done: true });

    old.close();
    // The old app keeps its data exactly as it was.
    expect(await snapshot(LEGACY_DB_NAME)).toEqual(before);
  });

  it('happens only once, even if every child is later removed', async () => {
    await seedLegacy();
    const store = await newStore();
    expect((await importLegacyData(store)).status).toBe('imported');
    await store.deleteProfile(alva.id);
    await store.deleteProfile(bo.id);
    expect(await importLegacyData(store)).toEqual({ status: 'skipped' });
    expect(await store.listProfiles()).toEqual([]);
  });

  it('leaves a device that already has children in Mattedalen alone', async () => {
    await seedLegacy();
    const store = await newStore();
    const sixten: Profile = { ...alva, id: 'sixten', name: 'Sixten' };
    await store.saveProfile(sixten);
    expect(await importLegacyData(store)).toEqual({ status: 'skipped' });
    expect(await store.listProfiles()).toEqual([sixten]);
  });

  it('finishes an interrupted import at the next start, without copies', async () => {
    await seedLegacy();
    const store = await newStore();
    // The app was closed after the first child had been stored.
    await store.setSetting(LEGACY_IMPORT_KEY, { from: LEGACY_DB_NAME, at: 1, profiles: 2, done: false });
    const old = new IndexedDbProgressStore(await openProgressDb(LEGACY_DB_NAME, MIGRATIONS.slice(0, 1)));
    await store.import(await old.export(alva.id));
    old.close();

    expect(await importLegacyData(store)).toEqual({ status: 'imported', profiles: 2 });
    expect((await store.listProfiles()).map((p) => p.name)).toEqual(['Alva', 'Bo']);
  });

  it('does nothing, and creates nothing, when Gångerträdgården was never used here', async () => {
    const store = await newStore();
    expect(await importLegacyData(store)).toEqual({ status: 'none' });
    expect(await databaseNames()).not.toContain(LEGACY_DB_NAME);
    expect(await openIfExists(indexedDB, LEGACY_DB_NAME)).toBeUndefined();
    expect(await databaseNames()).not.toContain(LEGACY_DB_NAME);
    // Not marked as done: checked again at the next start.
    expect(await store.getSetting(LEGACY_IMPORT_KEY)).toBeUndefined();
  });

  it('skips a child whose data cannot be read and brings the rest', async () => {
    await seedLegacy();
    const db = await openDB(LEGACY_DB_NAME);
    await db.put('profiles', { id: 'broken', createdAt: 0 });
    await db.put('profiles', { id: 42, name: 'Fel id' } as never);
    db.close();
    const store = await newStore();
    expect(await importLegacyData(store)).toEqual({ status: 'imported', profiles: 2 });
    expect((await store.listProfiles()).map((p) => p.id)).toEqual([alva.id, bo.id]);
  });

  it('treats an old database without children as nothing to import', async () => {
    await openProgressDb(LEGACY_DB_NAME, MIGRATIONS.slice(0, 1)).then((db) => db.close());
    const store = await newStore();
    expect(await importLegacyData(store)).toEqual({ status: 'none' });
  });

  it('never stops the app from starting', async () => {
    await seedLegacy();
    const store = new MemoryProgressStore();
    store.import = () => Promise.reject(new Error('disk full'));
    const result = await importLegacyData(store);
    expect(result.status).toBe('failed');
    expect(await importLegacyData(new MemoryProgressStore(), null)).toEqual({ status: 'none' });
  });
});
