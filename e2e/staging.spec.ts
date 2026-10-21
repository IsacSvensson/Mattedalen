import { expect, test, type Page } from '@playwright/test';
import { createProfile } from './helpers';
import { seedGangertradgarden } from './legacyData';

/** The test version in /test/, on the same origin as the real app (docs/PLAN-TESTVERSION.md). */

const cacheNames = (page: Page) => page.evaluate(() => caches.keys());

test('the test version says so, and is named apart from the real app', async ({ page }) => {
  await page.goto('/test/');
  await expect(page.getByText('Testversion. Barnen här är skilda från den vanliga appen.')).toBeVisible();
  await expect(page.locator('html.staging')).toHaveCount(1);
  await expect(page).toHaveTitle('Mattedalen test');
  const manifest = await (await page.request.get('/test/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ name: 'Mattedalen test', short_name: 'Mattedalen test' });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Vad heter du?' })).toBeVisible();
  await expect(page.locator('html.staging')).toHaveCount(0);
  await expect(page.getByText(/Testversion/)).toHaveCount(0);
  await expect(page).toHaveTitle('Mattedalen');
});

test('the children in the test version are apart from the real ones', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Alva', 'brook');
  await page.goto('/test/');
  await expect(page.getByRole('heading', { name: 'Vad heter du?' })).toBeVisible();
  await createProfile(page, 'Bo', 'brook');
  await page.goto('/test/');
  await expect(page.locator('.profile-tile:not(.add)')).toHaveText(['Bo']);
  await page.goto('/');
  await expect(page.locator('.profile-tile:not(.add)')).toHaveText(['Alva']);
  const names = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name).sort());
  expect(names).toEqual(['mattedalen', 'mattedalen-test']);
});

test("the real app's worker leaves the test version alone, and each keeps its own files", async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  // Opened under the real app's worker, before the test version has its own.
  await page.goto('/test/');
  await expect(page.locator('html.staging')).toHaveCount(1);
  await expect(page.getByText('Testversion. Barnen här är skilda från den vanliga appen.')).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.endsWith('/test/sw.js') ?? false);
  await expect.poll(async () => (await cacheNames(page)).map((n) => n.replace(/[0-9a-f]{12}$/, '')).sort()).toEqual(['mattedalen-', 'staging-mattedalen-']);
  // Both still offline after going back and forth.
  await page.goto('/');
  await expect(page.locator('html.staging')).toHaveCount(0);
  await page.context().setOffline(true);
  await page.goto('/test/');
  await expect(page.locator('html.staging')).toHaveCount(1);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Vad heter du?' })).toBeVisible();
  await page.context().setOffline(false);
});

test('children from Gångerträdgården come along to the real app only, never to the test version', async ({ page }) => {
  // A page on the same origin that does not start the app.
  await page.goto('/manifest.webmanifest');
  await seedGangertradgarden(page);
  await page.goto('/test/');
  await expect(page.getByRole('heading', { name: 'Vad heter du?' })).toBeVisible();
  await expect(page.getByText('Alva')).toHaveCount(0);
  await page.goto('/');
  await expect(page.locator('.profile-tile:not(.add)')).toHaveText(['Alva']);
});

