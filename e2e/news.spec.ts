import { expect, test, type Page } from '@playwright/test';
import { createProfile, openParent, parentLink } from './helpers';

/** "Nytt i Mattedalen" after an update, and "Nytt i appen" in "För vuxna" (docs/PLAN-UPPDATERING.md, U2). */
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-02-02T16:00:00') });
  await page.goto('/');
});

/** The newest post the device has seen: a post id, or none at all. */
async function seenNews(page: Page, id: string | null): Promise<void> {
  await page.evaluate(async (value) => {
    const db: IDBDatabase = await new Promise((r) => {
      const q = indexedDB.open('mattedalen');
      q.onsuccess = () => r(q.result);
    });
    await new Promise((r) => {
      const tx = db.transaction('settings', 'readwrite');
      if (value === null) tx.objectStore('settings').delete('newsSeen');
      else tx.objectStore('settings').put(value, 'newsSeen');
      tx.oncomplete = r;
    });
    db.close();
  }, id);
}

const box = (page: Page) => page.getByRole('dialog', { name: 'Nytt i Mattedalen' });

test('a new device sees no old news', async ({ page }) => {
  await createProfile(page, 'Alva', 'brook');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Vem spelar?' })).toBeVisible();
  await expect(box(page)).toHaveCount(0);
});

test('after an update, the posts the device has not seen, once', async ({ page }) => {
  await createProfile(page, 'Alva', 'brook');
  await seenNews(page, '2026-10-19-fragan');
  await page.reload();
  await expect(box(page)).toBeVisible();
  await expect(box(page).locator('.news-item > strong')).toHaveText(['En start för vuxna', 'Enklare ord för vuxna']);
  await box(page).getByRole('button', { name: 'Okej' }).click();
  await expect(box(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Vem spelar?' })).toBeVisible();
  await expect(box(page)).toHaveCount(0);
});

test('a device with children from before the news: the two newest, and where the rest are', async ({ page }) => {
  await createProfile(page, 'Alva', 'brook');
  await seenNews(page, null);
  await page.reload();
  await expect(box(page).locator('.news-item > strong')).toHaveCount(2);
  await expect(box(page)).toContainText('Och 5 till under ”Nytt i appen” i ”För vuxna”.');
  await box(page).getByRole('button', { name: 'Okej' }).click();
  await openParent(page);
  await parentLink(page, 'Nytt i appen');
  await expect(page.locator('.news-item > strong')).toHaveText(['En start för vuxna', 'Enklare ord för vuxna', 'Appen frågar ibland hur det går', 'Tillbaka dit du var', 'Plus först vid bäcken', 'Mer hjälp med minus', 'Tyck till']);
  await expect(page.getByRole('heading', { name: '18 okt' })).toBeVisible();
});
