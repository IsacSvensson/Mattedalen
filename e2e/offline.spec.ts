import { expect, test } from '@playwright/test';
import { answer, createProfile, openParent, switchPlayer } from './helpers';

test('works fully offline after the first visit, without any outside traffic', async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const foreign: string[] = [];
  context.on('request', (r) => {
    if (!r.url().startsWith(origin) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) foreign.push(r.url());
  });

  // First visit: the service worker installs and caches the app.
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  // No network from here on.
  await context.setOffline(true);
  const notFromWorker: string[] = [];
  page.on('response', (r) => {
    if (!r.fromServiceWorker() && r.url().startsWith(origin)) notFromWorker.push(r.url());
  });
  await page.reload();
  await createProfile(page, 'Alva');
  await page.getByRole('button', { name: 'Vattna trädgården' }).click();
  for (let i = 0; i < 5; i++) await answer(page);

  // The lazily loaded QR reader also works offline.
  await page.getByRole('button', { name: 'Tillbaka till trädgården' }).click();
  await switchPlayer(page);
  await openParent(page);
  await page.getByRole('button', { name: 'Visa QR-kod' }).click();
  const qr = await page.locator('.qr-code svg').screenshot();
  await page.getByRole('button', { name: 'Klar' }).click();
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'qr.png', mimeType: 'image/png', buffer: qr });
  await expect(page.getByRole('heading', { name: /Hämta Alva\?/ })).toBeVisible();

  // App files are served by the worker; nothing reaches other hosts.
  const manifest = await page.evaluate(async () => (await fetch('./manifest.webmanifest')).json());
  expect(manifest.name).toBe('Mattedalen');
  expect(notFromWorker).toEqual([]);
  expect(foreign).toEqual([]);
});

test('is installable: manifest, icons and service worker are in place', async ({ page }) => {
  await page.goto('/');
  const href = await page.locator('link[rel=manifest]').getAttribute('href');
  const manifest = await (await page.request.get(href!)).json();
  expect(manifest).toMatchObject({ display: 'standalone', start_url: './', scope: './', lang: 'sv' });
  for (const icon of manifest.icons as { src: string }[]) expect((await page.request.get(icon.src)).ok()).toBe(true);
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
  expect((await page.request.get(await page.locator('link[rel=apple-touch-icon]').getAttribute('href') as string)).ok()).toBe(true);
  // The licenses of bundled libraries and fonts ship with the app (and work offline).
  const notices = await (await page.request.get('THIRD-PARTY-LICENSES.txt')).text();
  for (const part of ['PolyForm Noncommercial', 'jsQR', 'Apache License', 'Open Font License']) expect(notices).toContain(part);
  const sw = await (await page.request.get('sw.js')).text();
  expect(sw).toContain('./THIRD-PARTY-LICENSES.txt');
  expect(sw).toContain('./index.html');
  expect(sw).toMatch(/\.\/assets\/jsQR-[\w-]+\.js/);
});

test('shows how to add the app to the home screen', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Alva');
  await switchPlayer(page);
  await page.getByRole('button', { name: 'Visa hur' }).click();
  await expect(page.getByRole('dialog')).toContainText('Lägg till på hemskärmen');
  await page.getByRole('button', { name: 'Klar' }).click();
  await page.getByRole('button', { name: 'Inte nu' }).click();
  await expect(page.locator('.install-banner')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.profile-tile', { hasText: 'Alva' })).toBeVisible();
  await expect(page.locator('.install-banner')).toHaveCount(0);
});
