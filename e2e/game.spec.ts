import { expect, test } from '@playwright/test';
import { answer, createProfile, nextStep } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-02-02T16:00:00') });
  await page.goto('/');
});

test('a first daily session: new profile, intro, questions, soft ending', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Vad heter du?' })).toBeVisible();
  await createProfile(page, 'Alva');
  await expect(page.locator('.grid-cell')).toHaveCount(100);
  await page.getByRole('button', { name: 'Vattna trädgården ▶' }).click();

  // The very first question introduces a new fact with its rectangle.
  await expect(page.getByText('Ett nytt frö')).toBeVisible();
  await expect(page.locator('.intro-card .array-view')).toBeVisible();
  for (let i = 0; i < 8; i++) {
    await answer(page);
    await expect(page.locator('.choice.correct')).toBeVisible();
  }

  // No clock is shown; the session ends when the time is up.
  await expect(page.getByText(/\d+:\d\d/)).toHaveCount(0);
  // Time runs out while a question is on screen: it may still be answered.
  await expect(nextStep(page)).toBeVisible();
  await page.clock.fastForward('12:00');
  await answer(page);
  await expect(page.getByRole('heading', { name: 'Bra jobbat!' })).toBeVisible();
  await expect(page.getByText('Trädgården behöver sova nu.', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Till trädgården' }).click();
  await expect(page.getByText('Trädgården sover.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Öva lite till (frivilligt)' })).toBeVisible();
  await expect(page.locator('.grid-cell.stage-seed, .grid-cell.stage-sprout').first()).toBeVisible();

  // Everything survives a reload.
  await page.reload();
  await page.getByRole('button', { name: /Alva/ }).click();
  await expect(page.getByText('Trädgården sover.', { exact: false })).toBeVisible();
});

test('a wrong answer shows the right answer and a strategy, never just "fel"', async ({ page }) => {
  await createProfile(page, 'Bo');
  await page.getByRole('button', { name: 'Vattna trädgården ▶' }).click();
  const fact = await answer(page, false);
  const [a, b] = fact.split('×').map(Number) as [number, number];
  await expect(page.locator('.help-answer')).toHaveText(`${a} × ${b} = ${a * b}`);
  await expect(page.locator('.help-card .strategy')).toBeVisible();
  await expect(page.getByText(/^fel$/i)).toHaveCount(0);
  await page.getByRole('button', { name: 'Fortsätt ▶' }).click();
  await expect(nextStep(page)).toBeVisible();
});

test('leaving early keeps progress but does not end the day', async ({ page }) => {
  await createProfile(page, 'Max');
  await page.getByRole('button', { name: 'Vattna trädgården ▶' }).click();
  await answer(page);
  await page.getByRole('button', { name: 'Tillbaka till trädgården' }).click();
  await expect(page.getByRole('heading', { name: 'Max trädgård' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vattna trädgården ▶' })).toBeVisible();
  await expect(page.locator('.grid-cell.stage-seed')).toHaveCount(1);
});

test('several children on one device', async ({ page }) => {
  await createProfile(page, 'Alva');
  await page.getByRole('button', { name: 'Byt spelare' }).click();
  await page.getByRole('button', { name: 'Ny spelare' }).click();
  await createProfile(page, 'Bo');
  await page.getByRole('button', { name: 'Byt spelare' }).click();
  await expect(page.locator('.profile-tile:not(.add)')).toHaveCount(2);
});
