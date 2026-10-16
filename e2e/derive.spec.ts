import { expect, test } from '@playwright/test';
import { answer, answerDerive, createProfile, enterGarden, nextStep, openParent, parentPlace, seedStates, type SeedState } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-02-02T16:00:00') });
});

const fluent: SeedState = { status: 'fluent', box: 3, dueDay: '2026-02-09' };

test('a hard fact is reached in steps from known facts, then asked again from memory', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Alva');
  await seedStates(page, {
    '5x7': fluent,
    '10x7': fluent,
    '2x7': fluent,
    '5x2': fluent,
    '10x3': fluent,
    '2x6': fluent,
    // Wrong on two different days: hard.
    '6x7': { status: 'learning', box: 1, dueDay: '2026-02-02', wrongDays: 2, introducedDay: '2026-01-28' },
  });
  await enterGarden(page, 'Alva');
  await page.getByRole('button', { name: 'Vattna trädgården' }).click();

  const asked: string[] = [];
  for (let i = 0; i < 25 && !(await page.locator('.question.derive').isVisible()); i++) {
    await expect(nextStep(page)).toBeVisible();
    if (await page.locator('.question.derive').isVisible()) break;
    asked.push(await answer(page));
  }
  await expect(page.locator('.derive-title')).toHaveText('Räknestigen');
  await expect(page.locator('.derive-step.current .derive-prompt')).toHaveText('5 × 7');
  await expect(page.locator('.derive-step.current .derive-label')).toHaveText('Börja med det du kan');

  // A wrong step: the number is shown and the path goes on.
  await page.keyboard.type('30');
  await page.keyboard.press('Enter');
  await expect(page.locator('.derive-step.shown')).toContainText('5 × 7 = 35');
  await expect(page.locator('.derive-step.current .derive-prompt')).toHaveText('35 + 7');
  await expect(page.locator('.derive-step.current .derive-label')).toHaveText('Lägg till en grupp till');
  await page.keyboard.type('42');
  await page.keyboard.press('Enter');
  await expect(page.locator('.derive-step.current.target .derive-prompt')).toHaveText('6 × 7');
  await page.keyboard.type('42');
  await page.keyboard.press('Enter');
  await expect(page.locator('.numpad-display.correct')).toBeVisible();

  // A few questions later 6 × 7 comes back as a plain question.
  let again = false;
  for (let i = 0; i < 8 && !again; i++) {
    await expect(nextStep(page)).toBeVisible();
    expect(await page.locator('.question.derive').isVisible()).toBe(false);
    again = (await answer(page)) === '6×7';
  }
  expect(again).toBe(true);
});

test('grown-ups see which facts are hard and how the game helps', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Bo');
  await seedStates(page, {
    '4x8': fluent,
    '8x8': { status: 'learning', box: 1, wrongDays: 3, introducedDay: '2026-01-20' },
  });
  await openParent(page);
  await parentPlace(page, 'Trädgården');
  await expect(page.getByRole('region', { name: /^Trädgården/ }).getByRole('heading', { name: 'Svåra just nu' })).toBeVisible();
  await expect(page.locator('.hard-list li')).toHaveCount(1);
  await expect(page.locator('.hard-list li')).toContainText('8 × 8 = 64 – 8 × 8 = dubbla 4 × 8 = 32 + 32 = 64');
});

test('the helper walks any derivation path', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Mira');
  await seedStates(page, {
    '10x6': fluent,
    '9x6': { status: 'learning', box: 1, dueDay: '2026-02-02', drops: 2, introducedDay: '2026-01-25' },
  });
  await enterGarden(page, 'Mira');
  await page.getByRole('button', { name: 'Vattna trädgården' }).click();
  for (let i = 0; i < 25 && !(await page.locator('.question.derive').isVisible()); i++) {
    await expect(nextStep(page)).toBeVisible();
    if (await page.locator('.question.derive').isVisible()) break;
    await answer(page);
  }
  await expect(page.locator('.derive-step.current .derive-prompt')).toHaveText('10 × 6');
  expect(await answerDerive(page)).toBe('9×6');
});

test('räknestigen takes the way the child knows: 7 × 8 through the fives and twos, not 7 × 4', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Ella');
  await seedStates(page, {
    '5x8': fluent,
    '2x8': fluent,
    '10x8': fluent,
    '5x2': fluent,
    '2x5': fluent,
    '10x2': fluent,
    // The table's own way, dubbla 7 × 4, is not known yet; nor is 7 × 5 + 7 × 3.
    '7x4': { status: 'learning', box: 1, dueDay: '2026-02-09', introducedDay: '2026-01-30' },
    '7x8': { status: 'learning', box: 1, dueDay: '2026-02-02', wrongDays: 2, introducedDay: '2026-01-28' },
  });
  await enterGarden(page, 'Ella');
  await page.getByRole('button', { name: 'Vattna trädgården' }).click();
  for (let i = 0; i < 25 && !(await page.locator('.question.derive').isVisible()); i++) {
    await expect(nextStep(page)).toBeVisible();
    if (await page.locator('.question.derive').isVisible()) break;
    await answer(page);
  }
  const step = page.locator('.derive-step.current');
  await expect(step.locator('.derive-prompt')).toHaveText('5 × 8');
  await page.keyboard.type('40');
  await page.keyboard.press('Enter');
  await expect(step.locator('.derive-prompt')).toHaveText('2 × 8');
  await expect(step.locator('.derive-label')).toHaveText('Och det här kan du också');
  await page.keyboard.type('16');
  await page.keyboard.press('Enter');
  await expect(step.locator('.derive-prompt')).toHaveText('40 + 16');
  await page.keyboard.type('56');
  await page.keyboard.press('Enter');
  await expect(page.locator('.derive-step.current.target .derive-prompt')).toHaveText('7 × 8');
  await page.keyboard.type('56');
  await page.keyboard.press('Enter');
  await expect(page.locator('.numpad-display.correct')).toBeVisible();

  // Grown-ups see the same way.
  await page.goto('/');
  await openParent(page);
  await parentPlace(page, 'Trädgården');
  await expect(page.locator('.hard-list li', { hasText: '7 × 8 = 56' })).toContainText('7 × 8 = 5 × 8 + 2 × 8 = 40 + 16 = 56');
});
