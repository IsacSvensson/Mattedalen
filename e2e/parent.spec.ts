import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { answer, createProfile, openParent, seedStates } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-02-02T16:00:00') });
  await page.goto('/');
});

test('the parent view is behind a PIN', async ({ page }) => {
  await createProfile(page, 'Alva');
  await page.getByRole('button', { name: 'Byt spelare' }).click();
  await openParent(page, '1357');
  await page.getByRole('button', { name: 'Stäng föräldravyn' }).click();

  await page.getByRole('button', { name: /🔒/ }).click();
  await expect(page.getByRole('heading', { name: /Vuxenkod/ })).toBeVisible();
  await page.keyboard.type('0000');
  await expect(page.getByText('Fel kod. Försök igen.')).toBeVisible();
  await page.keyboard.type('1357');
  await expect(page.getByRole('heading', { name: 'Föräldravy' })).toBeVisible();
});

test('shows heatmap, confusions and practised minutes; settings can be changed', async ({ page }) => {
  await createProfile(page, 'Alva');
  await page.getByRole('button', { name: 'Vattna trädgården ▶' }).click();
  await answer(page);
  await answer(page, false);
  await page.getByRole('button', { name: 'Fortsätt ▶' }).click();
  await page.clock.fastForward('12:00');
  await answer(page);
  await page.getByRole('button', { name: 'Till trädgården' }).click();
  await page.getByRole('button', { name: 'Byt spelare' }).click();
  await openParent(page);

  await expect(page.locator('.heat-cell')).toHaveCount(100);
  await expect(page.locator('.heat-cell.heat-learning-0').first()).toBeVisible();
  await expect(page.locator('.confusions li')).toHaveCount(1);
  await expect(page.locator('.confusions li')).toContainText('svarade');
  await expect(page.getByText(/Senaste 7 dagarna: 1[23] minuter/)).toBeVisible();
  await page.locator('.heat-cell.heat-learning-0').first().click();
  await expect(page.locator('.heat-detail')).toContainText('försök');

  await page.getByRole('combobox', { name: 'Passlängd' }).selectOption('15');
  await expect(page.getByRole('combobox', { name: 'Passlängd' })).toHaveValue('15');
  await page.getByRole('textbox', { name: 'Namn' }).fill('Alva-Li');
  await page.getByRole('button', { name: 'Spara', exact: true }).click();
  await expect(page.getByRole('button', { name: '🐢 Alva-Li' })).toBeVisible();
});

test('a JSON backup restores everything on another device', async ({ page, browser }) => {
  await createProfile(page, 'Alva');
  await seedStates(page, { '2x3': { status: 'fluent', box: 3 }, '10x4': { status: 'automatic', box: 5 } });
  await openParent(page);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Spara säkerhetskopia (JSON)' }).click()]);
  expect(download.suggestedFilename()).toBe('gangertradgarden-alva-2026-02-02.json');
  const file = await download.path();

  const other = await browser.newPage();
  await other.goto('/');
  await openParent(other, '1111', /annan enhet/);
  await other.locator('input[type=file][accept*=json]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: await readFile(file) });
  await expect(other.getByText('Alva är återställd')).toBeVisible();
  await other.getByRole('button', { name: 'Stäng föräldravyn' }).click();
  await other.locator('.profile-tile', { hasText: 'Alva' }).click();
  await expect(other.locator('.grid-cell.stage-bush')).toHaveCount(1);
  await expect(other.locator('.grid-cell.stage-tree')).toHaveCount(1);
  await other.close();
});

test('a QR code moves a child to another device', async ({ page, browser }) => {
  await createProfile(page, 'Alva');
  const states: Record<string, { status: string; box: number }> = {};
  for (let n = 1; n <= 10; n++) states[`10x${n}`] = { status: 'automatic', box: 5 };
  for (let n = 1; n <= 9; n++) states[`2x${n}`] = { status: 'fluent', box: 2 };
  states['5x3'] = { status: 'learning', box: 1 };
  await seedStates(page, states);
  await openParent(page);
  await page.getByRole('button', { name: 'Visa QR-kod' }).click();
  const qrImage = await page.locator('.qr-code svg').screenshot();

  // A second device: fresh browser, nothing stored.
  const other = await browser.newPage();
  await other.goto('/');
  await openParent(other, '2222', /annan enhet/);
  await other.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'qr.png', mimeType: 'image/png', buffer: qrImage });
  await expect(other.getByRole('heading', { name: 'Hämta 🐢 Alva?' })).toBeVisible();
  await expect(other.getByText('10 automatiserade, 9 flytande och 1 som övas.')).toBeVisible();
  await other.getByRole('button', { name: 'Lägg till', exact: true }).click();
  await expect(other.getByText('Alva är hämtad')).toBeVisible();

  await other.getByRole('button', { name: 'Stäng föräldravyn' }).click();
  await other.locator('.profile-tile', { hasText: 'Alva' }).click();
  await expect(other.locator('.grid-cell.stage-tree')).toHaveCount(10);
  await expect(other.locator('.grid-cell.stage-bush')).toHaveCount(9);
  await expect(other.locator('.grid-cell.stage-sprout')).toHaveCount(1);
  await other.close();
});

test('a profile can be deleted', async ({ page }) => {
  await createProfile(page, 'Alva');
  await page.getByRole('button', { name: 'Byt spelare' }).click();
  await page.getByRole('button', { name: 'Ny spelare' }).click();
  await createProfile(page, 'Bo');
  await page.getByRole('button', { name: 'Byt spelare' }).click();
  await openParent(page);
  await page.getByRole('button', { name: 'Ta bort Alva…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ta bort' }).click();
  await expect(page.getByText('Alva är borttagen')).toBeVisible();
  await expect(page.locator('.parent-tab')).toHaveCount(1);
});
