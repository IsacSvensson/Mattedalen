import { expect, test } from '@playwright/test';
import { createProfile, enterGarden, GROUPS_KNOWN, openParent, seedStates, type SeedState } from './helpers';

/** The garden's tables wait for their part on Stigen (docs/PLAN-HUNDRA.md), at most three weeks. */
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-02-02T16:00:00') });
});

/** ×2 sits, so ×10 could open; whole tens do not sit on Stigen yet. */
function twos(): Record<string, SeedState> {
  const s: Record<string, SeedState> = { ...GROUPS_KNOWN };
  for (let n = 1; n <= 10; n++) for (const id of [`2x${n}`, `${n}x2`]) s[id] = { status: 'fluent', box: 4, dueDay: '2026-02-09' };
  return s;
}

test('a table that waits for Stigen says so, and a grown-up can open it', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Alva');
  await seedStates(page, twos(), { packId: 'multiplication', unlockedUnitIds: ['lika', 'u2'] });
  await enterGarden(page, 'Alva');
  await expect(page.locator('.garden-next')).toHaveText('×10 kommer när du kan hela tiotal på stigen.');

  await page.getByRole('button', { name: 'Till dalen' }).click();
  await page.getByRole('button', { name: 'Byt spelare' }).click();
  await openParent(page);
  const garden = page.getByRole('region', { name: /^Trädgården/ });
  await expect(garden.locator('.waiting-tables')).toContainText('×10 kommer när barnet kan hela tiotal på stigen.');
  await garden.getByRole('button', { name: 'Öppna ×10 nu' }).click();
  await expect(garden.locator('.waiting-tables')).toContainText('×10 är öppen.');
  await page.getByRole('button', { name: /Tillbaka|Stäng/ }).first().click();
  await enterGarden(page, 'Alva');
  // ×10 is open now; the next table that waits is ×4 (×5 comes after ×10, ×1 waits for nothing).
  await expect(page.locator('.garden-next')).toHaveText('×4 kommer när du kan dubbla och halvera på stigen.');
});

test('a table waits at most three weeks', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Bo');
  await seedStates(page, twos(), { packId: 'multiplication', unlockedUnitIds: ['lika', 'u2'] });
  await enterGarden(page, 'Bo');
  await expect(page.locator('.garden-next')).toContainText('×10 kommer');
  // Three weeks later, with nothing done on Stigen, ×10 opens anyway.
  await page.clock.setFixedTime(new Date('2026-02-23T16:00:00'));
  await page.reload();
  await enterGarden(page, 'Bo');
  await expect(page.locator('.garden-grid')).toBeVisible();
  await expect(page.locator('.garden-next', { hasText: '×10' })).toHaveCount(0);
});
