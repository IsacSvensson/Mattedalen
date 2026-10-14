import { expect, test, type Page } from '@playwright/test';
import { enterGarden, openParent, switchPlayer } from './helpers';

/*
 * Gångerträdgården ran on the same origin before Mattedalen. Its children,
 * their gardens and the grown-ups' code come along on the first start, and
 * its own database is left untouched.
 */

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

const LEGACY = {
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
async function seedGangertradgarden(page: Page): Promise<void> {
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

/** Every record of Gångerträdgården's database, or null if it does not exist. */
function readGangertradgarden(page: Page) {
  return page.evaluate(async () => {
    if (!(await indexedDB.databases()).some((d) => d.name === 'gangertradgarden')) return null;
    const db: IDBDatabase = await new Promise((resolve) => {
      const open = indexedDB.open('gangertradgarden');
      open.onsuccess = () => resolve(open.result);
    });
    const out: Record<string, unknown> = { version: db.version };
    for (const name of Array.from(db.objectStoreNames)) {
      out[name] = await new Promise((resolve) => {
        const all = db.transaction(name).objectStore(name).getAll();
        all.onsuccess = () => resolve(all.result);
      });
    }
    db.close();
    return out;
  });
}

const databaseNames = (page: Page) => page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));

test('children from Gångerträdgården come along, and the old app keeps its data', async ({ page }) => {
  // A page on the same origin that does not start the app.
  await page.goto('/manifest.webmanifest');
  await seedGangertradgarden(page);
  const before = await readGangertradgarden(page);

  await page.goto('/');
  await enterGarden(page, 'Alva');
  await expect(page.getByRole('heading', { name: 'Alvas trädgård' })).toBeVisible();
  await expect(page.locator('.grid-cell.stage-bush')).toHaveCount(1);
  await expect(page.locator('.grid-cell.stage-tree')).toHaveCount(1);
  await expect(page.locator('.grid-cell.stage-sprout')).toHaveCount(1);

  // The grown-ups' code came along: it is asked for, not chosen anew.
  await switchPlayer(page);
  await page.getByRole('button', { name: 'För vuxna' }).click();
  await expect(page.getByRole('heading', { name: 'Vuxenkod' })).toBeVisible();
  await openParentWithCode(page);
  await expect(page.getByText(/^Ett barn hämtades från Gångerträdgården \d+ \w+\./)).toBeVisible();

  expect(await readGangertradgarden(page)).toEqual(before);
  expect(await databaseNames(page)).toEqual(expect.arrayContaining(['gangertradgarden', 'mattedalen']));

  // Only once: a child removed in Mattedalen does not come back.
  await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((resolve) => {
      const open = indexedDB.open('mattedalen');
      open.onsuccess = () => resolve(open.result);
    });
    await new Promise((resolve) => {
      const tx = db.transaction('profiles', 'readwrite');
      tx.objectStore('profiles').clear();
      tx.oncomplete = resolve;
    });
    db.close();
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Vad heter du?' })).toBeVisible();
});

test('a device that never had Gångerträdgården gets no database of it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Vad heter du?' })).toBeVisible();
  await expect.poll(() => databaseNames(page)).toContain('mattedalen');
  expect(await databaseNames(page)).not.toContain('gangertradgarden');
  expect(await readGangertradgarden(page)).toBeNull();
});

test('a backup file saved in Gångerträdgården can be restored', async ({ page }) => {
  await page.goto('/');
  await openParent(page, '1111', /annan enhet/);
  const backup = {
    format: 'gangertradgarden-profil',
    version: 1,
    exportedAt: 1,
    profile: LEGACY.profile,
    progress: [LEGACY.progress],
    sessions: [LEGACY.session],
    attempts: [LEGACY.attempt],
    daySummaries: [],
  };
  await page
    .locator('input[type=file][accept*=json]')
    .setInputFiles({ name: 'gangertradgarden-alva-2026-10-01.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.getByText('Alva är återställd')).toBeVisible();
  await page.getByRole('button', { name: 'Stäng föräldravyn' }).click();
  await enterGarden(page, 'Alva');
  await expect(page.locator('.grid-cell.stage-tree')).toHaveCount(1);
});

test('the service worker leaves Gångerträdgården\u2019s caches alone', async ({ page }) => {
  await page.goto('/manifest.webmanifest');
  await page.evaluate(async () => {
    const cache = await caches.open('gangertradgarden-0123456789ab');
    await cache.put('/Multiplikation/index.html', new Response('Gångerträdgården'));
  });
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => caches.keys())).toEqual(
    expect.arrayContaining(['gangertradgarden-0123456789ab', expect.stringMatching(/^mattedalen-[0-9a-f]{12}$/)]),
  );
});

async function openParentWithCode(page: Page): Promise<void> {
  await page.keyboard.type('2580');
  await expect(page.getByRole('heading', { name: 'Föräldravy' })).toBeVisible();
}
