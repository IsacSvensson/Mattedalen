import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { createProfile, openParent, parentLink, switchPlayer } from './helpers';

/*
 * Publishing a new version is simulated by changing the version in the served
 * sw.js (same length, so the preview server's cached file size still fits).
 * Only one project runs this, since it edits the shared build.
 */
const SW = 'dist/sw.js';

function publish(version: string): void {
  const source = readFileSync(SW, 'utf8');
  writeFileSync(SW, source.replace(/const VERSION = "[0-9a-z]{12}";/, `const VERSION = "${version}";`));
}

/** Cache names; empty while the page is reloading into the new version. */
const cacheNames = (page: Page) => page.evaluate(() => caches.keys()).catch(() => [] as string[]);
const lookForUpdate = (page: Page) =>
  page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg?.update();
  });

test.describe.configure({ mode: 'serial' });

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'phone', 'edits the shared build');
});

let original = '';
test.beforeAll(() => {
  original = readFileSync(SW, 'utf8');
});
// Every test starts from the built version.
test.afterEach(() => {
  if (original) writeFileSync(SW, original);
});

test('a new version is offered on any screen except during a game, and taken into use', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await createProfile(page, 'Alva');

  publish('aaaaaaaaaaaa');
  await page.getByRole('button', { name: 'Vattna trädgården' }).click();
  await lookForUpdate(page);
  // Never in the middle of a game.
  await page.waitForTimeout(1500);
  await expect(page.locator('#update-bar')).toHaveCount(0);

  await page.getByRole('button', { name: 'Tillbaka till trädgården' }).click();
  const update = page.getByRole('button', { name: 'Ny version finns – uppdatera' });
  await expect(update).toBeVisible();
  await update.click();
  await expect.poll(async () => (await cacheNames(page)).join()).toContain('mattedalen-aaaaaaaaaaaa');
  await expect(page.getByRole('heading', { name: 'Vem spelar?' })).toBeVisible();
  await expect(page.locator('#update-bar')).toHaveCount(0);
});

test('a version downloaded earlier is started when the app opens again', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  publish('bbbbbbbbbbbb');
  await lookForUpdate(page);
  await expect(page.locator('#update-bar')).toBeVisible();

  // Opening the app again (the installed app is often never fully closed) starts it.
  await page.reload();
  await expect.poll(async () => (await cacheNames(page)).join()).toBe('mattedalen-bbbbbbbbbbbb');
  await expect(page.locator('#update-bar')).toHaveCount(0);
});

test('grown-ups can look for an update and see the version', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await createProfile(page, 'Bo');
  await switchPlayer(page);
  await openParent(page);
  await parentLink(page, 'Den här enheten');
  await expect(page.getByText(/^Appen: \d{4}-\d{2}-\d{2}/)).toBeVisible();

  const look = page.getByRole('button', { name: 'Sök efter uppdatering' });
  await look.click();
  await expect(page.getByText('Du har den senaste versionen')).toBeVisible();

  publish('cccccccccccc');
  await look.click();
  await expect.poll(async () => (await cacheNames(page)).join()).toBe('mattedalen-cccccccccccc');
});

test('a page open since the very first visit also starts the new version', async ({ page }) => {
  // No reload after the first install: the worker took over the open page by itself.
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.evaluate(() => ((window as unknown as { before: boolean }).before = true));

  publish('dddddddddddd');
  await lookForUpdate(page);
  const update = page.getByRole('button', { name: 'Ny version finns – uppdatera' });
  await expect(update).toBeVisible();
  await update.click();
  await expect.poll(async () => (await cacheNames(page)).join()).toBe('mattedalen-dddddddddddd');
  // The page was reloaded into the new version, and the button is gone.
  await expect.poll(() => page.evaluate(() => (window as unknown as { before?: boolean }).before ?? false).catch(() => true)).toBe(false);
  await expect(page.locator('#update-bar')).toHaveCount(0);
});
