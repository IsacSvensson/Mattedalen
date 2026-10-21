import type { Page } from '@playwright/test';

/** Gångerträdgården's data on this origin, as that app left it (e2e/legacy.spec.ts, e2e/staging.spec.ts). */

const state = (itemId: string, status: string, box: number) => ({
  itemId,
  status,
  box,
  dueDay: '2026-10-20',
  introducedDay: '2026-09-01',
  lastSeenAt: null,
  lastWrongDay: null,
  lastRtMs: null,
  seen: 8,
  correct: 8,
  lapses: 0,
  dayBest: {},
  confusions: {},
});

export const LEGACY = {
  profile: { id: 'alva-1', name: 'Alva', avatar: '🐢', createdAt: 1, settings: { sessionMinutes: 10, readAloud: false, allowFree: true } },
  progress: {
    profileId: 'alva-1',
    packId: 'multiplication',
    packVersion: 1,
    states: { '2x3': state('2x3', 'fluent', 3), '10x4': state('10x4', 'automatic', 5), '2x2': state('2x2', 'learning', 1) },
    meta: { pacingGap: 8, unlockedUnitIds: ['u10', 'u2'], accuracyEma: 0.85, sessionsCompleted: 3, lastSessionDay: '2026-10-01' },
    updatedAt: 1,
  },
  session: { id: 's1', profileId: 'alva-1', packId: 'multiplication', mode: 'daily', day: '2026-10-01', startedAt: 1, endedAt: 2, answered: 20, correct: 17, introduced: [] },
  attempt: { profileId: 'alva-1', packId: 'multiplication', itemId: '2x3', ts: 5, sessionId: 's1', format: 'choice', kind: 'due', given: '6', correct: true, rtMs: 2400 },
};

/** Writes Gångerträdgården's database (schema v1) the way that app left it. */
export async function seedGangertradgarden(page: Page): Promise<void> {
  await page.evaluate(async (data) => {
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      const open = indexedDB.open('gangertradgarden', 1);
      open.onupgradeneeded = () => {
        const d = open.result;
        d.createObjectStore('profiles', { keyPath: 'id' });
        d.createObjectStore('progress', { keyPath: ['profileId', 'packId'] }).createIndex('byProfile', 'profileId');
        d.createObjectStore('attempts', { keyPath: 'id', autoIncrement: true }).createIndex('byProfileTs', ['profileId', 'ts']);
        d.createObjectStore('sessions', { keyPath: ['profileId', 'id'] }).createIndex('byProfileStart', ['profileId', 'startedAt']);
        d.createObjectStore('daySummaries', { keyPath: ['profileId', 'packId', 'day', 'itemId'] }).createIndex('byProfile', 'profileId');
        d.createObjectStore('settings');
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    await new Promise((resolve) => {
      const tx = db.transaction(['profiles', 'progress', 'attempts', 'sessions', 'settings'], 'readwrite');
      tx.objectStore('profiles').put(data.profile);
      tx.objectStore('progress').put(data.progress);
      tx.objectStore('attempts').add(data.attempt);
      tx.objectStore('sessions').put(data.session);
      tx.objectStore('settings').put('2580', 'parentPin');
      tx.objectStore('settings').put('alva-1', 'lastProfileId');
      tx.oncomplete = resolve;
    });
    db.close();
  }, LEGACY);
}
