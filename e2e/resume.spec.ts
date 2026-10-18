import { expect, test, type Page } from '@playwright/test';
import { createProfile } from './helpers';

/**
 * Back to the same screen after an update (docs/PLAN-UPPDATERING.md): when the
 * screen is gone, the nearest one that is there. The update itself is in
 * update.spec.ts; here the mark it leaves is written directly.
 */
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-02-02T16:00:00') });
  await page.goto('/');
});

/** The mark an update leaves just before the reload, then the reload. */
async function reloadAsAfterUpdate(page: Page, where: Record<string, string>): Promise<void> {
  await page.evaluate((w) => sessionStorage.setItem('mattedalen:resume', JSON.stringify({ where: w, at: Date.now() })), where);
  await page.reload();
}

const profileId = (page: Page) =>
  page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((r) => {
      const q = indexedDB.open('mattedalen');
      q.onsuccess = () => r(q.result);
    });
    const profiles: { id: string }[] = await new Promise((r) => {
      const q = db.transaction('profiles').objectStore('profiles').getAll();
      q.onsuccess = () => r(q.result);
    });
    db.close();
    return profiles[0]!.id;
  });

test('a child who is gone: the app starts over at "Vem spelar?"', async ({ page }) => {
  await createProfile(page, 'Alva', 'brook');
  await reloadAsAfterUpdate(page, { kind: 'valley', profileId: 'gone' });
  await expect(page.getByRole('heading', { name: 'Vem spelar?' })).toBeVisible();
});

test('a place that is not open: the valley, standing at that place', async ({ page }) => {
  await createProfile(page, 'Alva', 'brook');
  const id = await profileId(page);
  await reloadAsAfterUpdate(page, { kind: 'place', profileId: id, placeId: 'stigen' });
  await expect(page.getByRole('heading', { name: 'Mattedalen' })).toBeVisible();
  // Once: an ordinary start afterwards begins at "Vem spelar?".
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Vem spelar?' })).toBeVisible();
});

test('the brook, open from the start, comes back as the brook', async ({ page }) => {
  await createProfile(page, 'Alva', 'brook');
  const id = await profileId(page);
  await reloadAsAfterUpdate(page, { kind: 'place', profileId: id, placeId: 'backen' });
  await expect(page.getByRole('heading', { name: 'Alvas bäck' }).or(page.getByRole('heading', { name: 'Kan du redan lite plus och minus?' }))).toBeVisible();
});
