import { ImportError, LEGACY_EXPORT_FORMAT, type ProfileExport } from './backup';
import type { ProgressStore } from './ProgressStore';

/**
 * One-time move from Gångerträdgården, which ran on the same origin
 * (isacsvensson.github.io) and kept its data in its own IndexedDB database.
 *
 * On the first start, Mattedalen copies every child (profile, progress,
 * sessions, log), the grown-ups' PIN and a few app settings into its own
 * database. The old database is only read, never changed, so Gångerträdgården
 * keeps working as before.
 */
export const LEGACY_DB_NAME = 'gangertradgarden';

/**
 * Written to the new database before the children are copied and marked done
 * afterwards, so the import happens only once and an interrupted one is
 * finished at the next start.
 */
export const LEGACY_IMPORT_KEY = 'legacyImport';

/** App settings that follow the children (the rest are per-device details). */
const LEGACY_SETTINGS = ['parentPin', 'lastProfileId', 'installBannerDismissed'] as const;

const PROFILE_STORES = ['profiles', 'progress', 'sessions', 'attempts', 'daySummaries'] as const;

export interface LegacyImportRecord {
  from: typeof LEGACY_DB_NAME;
  at: number;
  profiles: number;
  done: boolean;
}

export type LegacyImportResult =
  | { status: 'imported'; profiles: number }
  /** Already imported, or Mattedalen already has children of its own: nothing is touched. */
  | { status: 'skipped' }
  /** No old database, or one without children. Checked again at the next start. */
  | { status: 'none' }
  | { status: 'failed'; error: unknown };

/**
 * Imports the children of Gångerträdgården if this is the first start of
 * Mattedalen on this device. Never throws: the app starts either way.
 */
export async function importLegacyData(
  store: ProgressStore,
  factory: IDBFactory | null = globalThis.indexedDB ?? null,
  now = Date.now(),
): Promise<LegacyImportResult> {
  try {
    if (!factory) return { status: 'none' };
    const earlier = await store.getSetting<LegacyImportRecord>(LEGACY_IMPORT_KEY);
    if (earlier?.done) return { status: 'skipped' };
    if (!earlier && (await store.listProfiles()).length > 0) return { status: 'skipped' };

    const db = await openIfExists(factory, LEGACY_DB_NAME);
    if (!db) return { status: 'none' };
    let data: LegacyData;
    try {
      data = await readAll(db);
    } finally {
      db.close();
    }
    if (data.profiles.length === 0) return { status: 'none' };

    const record: LegacyImportRecord = { from: LEGACY_DB_NAME, at: now, profiles: data.profiles.length, done: false };
    await store.setSetting(LEGACY_IMPORT_KEY, record);
    // Each child is stored atomically, and replacing makes a re-run harmless.
    // A child whose data cannot be read is left behind rather than stopping the others.
    let imported = 0;
    for (const backup of toBackups(data, now)) {
      try {
        await store.import(backup, { onConflict: 'replace' });
        imported++;
      } catch (error) {
        if (!(error instanceof ImportError)) throw error;
      }
    }
    for (const key of LEGACY_SETTINGS) {
      const value = data.settings.get(key);
      if (value !== undefined && (await store.getSetting(key)) === undefined) await store.setSetting(key, value);
    }
    await store.setSetting(LEGACY_IMPORT_KEY, { ...record, profiles: imported, done: true });
    return { status: 'imported', profiles: imported };
  } catch (error) {
    return { status: 'failed', error };
  }
}

/**
 * Opens a database only if it already exists. A plain `open` would create an
 * empty one, so the upgrade that creating it needs is aborted instead (which
 * also removes it again).
 */
export function openIfExists(factory: IDBFactory, name: string): Promise<IDBDatabase | undefined> {
  return new Promise((resolve, reject) => {
    let missing = false;
    const request = factory.open(name);
    request.onupgradeneeded = (event) => {
      if (event.oldVersion === 0) {
        missing = true;
        request.transaction?.abort();
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => {
      if (!missing) return reject(request.error);
      event.preventDefault();
      resolve(undefined);
    };
  });
}

interface LegacyData {
  profiles: Record<string, unknown>[];
  byStore: Record<(typeof PROFILE_STORES)[number], Record<string, unknown>[]>;
  settings: Map<string, unknown>;
}

async function readAll(db: IDBDatabase): Promise<LegacyData> {
  const names = PROFILE_STORES.filter((s) => db.objectStoreNames.contains(s));
  const hasSettings = db.objectStoreNames.contains('settings');
  const byStore = Object.fromEntries(PROFILE_STORES.map((s) => [s, []])) as unknown as LegacyData['byStore'];
  const settings = new Map<string, unknown>();
  if (!names.includes('profiles')) return { profiles: [], byStore, settings };

  const tx = db.transaction(hasSettings ? [...names, 'settings'] : names, 'readonly');
  const all = names.map(async (name) => {
    byStore[name] = (await requestResult(tx.objectStore(name).getAll())).filter(isRecord);
  });
  const keys = hasSettings
    ? LEGACY_SETTINGS.map(async (key) => {
        const value = await requestResult(tx.objectStore('settings').get(key));
        if (value !== undefined) settings.set(key, value);
      })
    : [];
  await Promise.all([...all, ...keys]);
  return { profiles: byStore.profiles, byStore, settings };
}

/** One backup per child, in the old export format; `import` validates and repairs it. */
function toBackups(data: LegacyData, now: number): ProfileExport[] {
  const of = (rows: Record<string, unknown>[], id: unknown) => rows.filter((r) => r.profileId === id);
  return data.profiles
    .filter((p) => typeof p.id === 'string')
    .map(
      (profile) =>
        ({
          format: LEGACY_EXPORT_FORMAT,
          version: 1,
          exportedAt: now,
          profile,
          progress: of(data.byStore.progress, profile.id),
          sessions: of(data.byStore.sessions, profile.id),
          attempts: of(data.byStore.attempts, profile.id),
          daySummaries: of(data.byStore.daySummaries, profile.id),
        }) as unknown as ProfileExport,
    );
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
