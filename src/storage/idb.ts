import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames } from 'idb';
import type { ProfileExport } from './backup';
import { summarizeAttempts } from './compact';
import type { AttemptQuery, ImportOptions, ProgressStore } from './ProgressStore';
import { exportProfile, prepareImport } from './shared';
import { STAGING } from '../staging';
import type { AttemptDaySummary, Profile, Progress, SessionRecord, StoredAttempt } from './types';

/** The test version keeps its own children, apart from the real app's on the same origin. */
export const DB_NAME = STAGING ? 'mattedalen-test' : 'mattedalen';

export interface ProgressDB extends DBSchema {
  profiles: { key: string; value: Profile };
  progress: { key: [string, string]; value: Progress; indexes: { byProfile: string } };
  attempts: { key: number; value: StoredAttempt; indexes: { byProfileTs: [string, number] } };
  sessions: { key: [string, string]; value: SessionRecord; indexes: { byProfileStart: [string, number] } };
  daySummaries: { key: [string, string, string, string]; value: AttemptDaySummary; indexes: { byProfile: string } };
  settings: { key: string; value: unknown };
}

type UpgradeTx = IDBPTransaction<ProgressDB, StoreNames<ProgressDB>[], 'versionchange'>;
export type Migration = (db: IDBPDatabase<ProgressDB>, tx: UpgradeTx) => void;

/**
 * Schema migrations, indexed by the version they upgrade *to*. Never edit a
 * released migration; append a new one and the database version follows.
 */
export const MIGRATIONS: Migration[] = [
  // v1: initial schema
  (db) => {
    db.createObjectStore('profiles', { keyPath: 'id' });
    db.createObjectStore('progress', { keyPath: ['profileId', 'packId'] }).createIndex('byProfile', 'profileId');
    db.createObjectStore('attempts', { keyPath: 'id', autoIncrement: true }).createIndex('byProfileTs', ['profileId', 'ts']);
    db.createObjectStore('sessions', { keyPath: ['profileId', 'id'] }).createIndex('byProfileStart', ['profileId', 'startedAt']);
    db.createObjectStore('daySummaries', { keyPath: ['profileId', 'packId', 'day', 'itemId'] }).createIndex('byProfile', 'profileId');
    db.createObjectStore('settings');
  },
];

export async function openProgressDb(name = DB_NAME, migrations: Migration[] = MIGRATIONS): Promise<IDBPDatabase<ProgressDB>> {
  const db: IDBPDatabase<ProgressDB> = await openDB<ProgressDB>(name, migrations.length, {
    upgrade(upgradeDb, oldVersion, _newVersion, tx) {
      for (let v = oldVersion; v < migrations.length; v++) migrations[v]?.(upgradeDb, tx);
    },
    blocking() {
      // A newer version of the app (another tab) wants to upgrade: let it.
      db.close();
    },
  });
  return db;
}

const PROFILE_STORES = ['profiles', 'progress', 'attempts', 'sessions', 'daySummaries'] as const;
type ProfileTx = IDBPTransaction<ProgressDB, (typeof PROFILE_STORES)[number][], 'readwrite'>;

const profileRange = (profileId: string, from = -Infinity) => IDBKeyRange.bound([profileId, from], [profileId, Infinity]);

export class IndexedDbProgressStore implements ProgressStore {
  constructor(
    private readonly db: IDBPDatabase<ProgressDB>,
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {}

  static async open(name = DB_NAME, newId?: () => string): Promise<IndexedDbProgressStore> {
    return new IndexedDbProgressStore(await openProgressDb(name), newId);
  }

  close(): void {
    this.db.close();
  }

  async listProfiles() {
    return (await this.db.getAll('profiles')).sort((a, b) => a.createdAt - b.createdAt);
  }
  getProfile(id: string) {
    return this.db.get('profiles', id);
  }
  async saveProfile(profile: Profile) {
    await this.db.put('profiles', profile);
  }

  async deleteProfile(id: string) {
    const tx = this.db.transaction(PROFILE_STORES, 'readwrite');
    await deleteProfileIn(tx, id);
    await tx.done;
  }

  load(profileId: string, packId: string) {
    return this.db.get('progress', [profileId, packId]);
  }
  async save(progress: Progress) {
    await this.db.put('progress', progress);
  }
  listProgress(profileId: string) {
    return this.db.getAllFromIndex('progress', 'byProfile', profileId);
  }

  async appendAttempt(attempt: StoredAttempt) {
    const { id: _id, ...rest } = attempt;
    await this.db.add('attempts', rest);
  }

  async listAttempts(profileId: string, query: AttemptQuery = {}) {
    let out = await this.db.getAllFromIndex('attempts', 'byProfileTs', profileRange(profileId, query.since));
    if (query.packId !== undefined) out = out.filter((a) => a.packId === query.packId);
    if (query.limit !== undefined) out = out.slice(-query.limit);
    return out;
  }
  countAttempts(profileId: string) {
    return this.db.countFromIndex('attempts', 'byProfileTs', profileRange(profileId));
  }
  listDaySummaries(profileId: string) {
    return this.db.getAllFromIndex('daySummaries', 'byProfile', profileId);
  }

  async compactLog(profileId: string, keep: number) {
    const tx = this.db.transaction(['attempts', 'daySummaries'], 'readwrite');
    const index = tx.objectStore('attempts').index('byProfileTs');
    const total = await index.count(profileRange(profileId));
    const removeCount = total - keep;
    if (removeCount <= 0) {
      await tx.done;
      return 0;
    }
    const old: StoredAttempt[] = [];
    let cursor = await index.openCursor(profileRange(profileId));
    while (cursor && old.length < removeCount) {
      old.push(cursor.value);
      await cursor.delete();
      cursor = await cursor.continue();
    }
    const summaries = tx.objectStore('daySummaries');
    const existing = await summaries.index('byProfile').getAll(profileId);
    for (const s of summarizeAttempts(old, existing)) await summaries.put(s);
    await tx.done;
    return old.length;
  }

  async saveSession(session: SessionRecord) {
    await this.db.put('sessions', session);
  }
  listSessions(profileId: string) {
    return this.db.getAllFromIndex('sessions', 'byProfileStart', profileRange(profileId));
  }

  export(profileId: string) {
    return exportProfile(this, profileId);
  }

  /** Imports atomically: either the whole backup is stored or nothing changes. */
  async import(input: ProfileExport, options: ImportOptions = {}) {
    const { data, replace } = await prepareImport(this, input, options, this.newId);
    const tx = this.db.transaction(PROFILE_STORES, 'readwrite');
    if (replace) await deleteProfileIn(tx, data.profile.id);
    const writes: Promise<unknown>[] = [tx.objectStore('profiles').put(data.profile)];
    for (const p of data.progress) writes.push(tx.objectStore('progress').put(p));
    for (const s of data.sessions) writes.push(tx.objectStore('sessions').put(s));
    for (const { id: _id, ...a } of data.attempts) writes.push(tx.objectStore('attempts').add(a));
    for (const s of data.daySummaries) writes.push(tx.objectStore('daySummaries').put(s));
    await Promise.all([...writes, tx.done]);
    return data.profile;
  }

  async getSetting<T>(key: string) {
    return (await this.db.get('settings', key)) as T | undefined;
  }
  async setSetting<T>(key: string, value: T) {
    await this.db.put('settings', value, key);
  }
}

async function deleteProfileIn(tx: ProfileTx, id: string): Promise<void> {
  const progress = tx.objectStore('progress');
  const attempts = tx.objectStore('attempts');
  const sessions = tx.objectStore('sessions');
  const summaries = tx.objectStore('daySummaries');
  const [progressKeys, attemptKeys, sessionKeys, summaryKeys] = await Promise.all([
    progress.index('byProfile').getAllKeys(id),
    attempts.index('byProfileTs').getAllKeys(profileRange(id)),
    sessions.index('byProfileStart').getAllKeys(profileRange(id)),
    summaries.index('byProfile').getAllKeys(id),
  ]);
  await Promise.all([
    tx.objectStore('profiles').delete(id),
    ...progressKeys.map((k) => progress.delete(k)),
    ...attemptKeys.map((k) => attempts.delete(k)),
    ...sessionKeys.map((k) => sessions.delete(k)),
    ...summaryKeys.map((k) => summaries.delete(k)),
  ]);
}
