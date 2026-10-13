import { expect, test } from '@playwright/test';
import { answer, createProfile, nextStep, seedStates } from './helpers';

const fluent = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, { status: 'fluent', box: 3 }]));
const tens = () => {
  const ids: string[] = [];
  for (let n = 1; n <= 10; n++) ids.push(`10x${n}`, `${n}x10`);
  return ids;
};

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-02-02T16:00:00') });
});

test('practise one chosen table: new facts from it, mixed with others', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Alva');
  await seedStates(page, fluent(tens()));
  await page.locator('.profile-tile', { hasText: 'Alva' }).click();

  await page.getByRole('button', { name: '🎯 Öva på en tabell' }).click();
  await expect(page.getByRole('heading', { name: 'Vilken tabell vill du öva på?' })).toBeVisible();
  await expect(page.locator('.focus-tile')).toHaveCount(10);
  await page.getByRole('button', { name: /^×7,/ }).click();
  await expect(page.getByRole('button', { name: /^×7,/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Du kan 2 av 19 bra.')).toBeVisible();
  await expect(page.getByRole('button', { name: '⚡ Rekordjakt ×7' })).toBeDisabled();

  await page.getByRole('button', { name: 'Öva ×7 ▶' }).click();
  await expect(page.locator('.focus-tag')).toHaveText('🎯 ×7');
  const asked: string[] = [];
  let sawNewSeven = false;
  for (let i = 0; i < 8; i++) {
    await expect(nextStep(page)).toBeVisible();
    const intro = page.locator('.intro-card .prompt');
    if (await intro.isVisible()) sawNewSeven ||= /\b7\b/.test((await intro.textContent()) ?? '');
    asked.push(await answer(page));
  }
  // ×7 is still locked in the daily order (only ×10 is known), yet a ×7 fact was planted.
  expect(sawNewSeven).toBe(true);

  await expect(nextStep(page)).toBeVisible();
  await page.clock.fastForward('05:01');
  await answer(page);
  await expect(page.getByRole('heading', { name: 'Bra övat på ×7!' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Öva ×7 igen' })).toBeVisible();
  await page.getByRole('button', { name: 'Till trädgården' }).click();
  // Focus practice is optional: the daily session is still waiting.
  await expect(page.getByRole('button', { name: 'Vattna trädgården ▶' })).toBeVisible();
});

test('a record challenge on one table keeps its own record', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Bo');
  await seedStates(page, fluent([...tens(), '7x2', '2x7', '7x5', '5x7']));
  await page.locator('.profile-tile', { hasText: 'Bo' }).click();

  await page.getByRole('button', { name: '🎯 Öva på en tabell' }).click();
  await page.getByRole('button', { name: /^×7,/ }).click();
  await page.getByRole('button', { name: '⚡ Rekordjakt ×7' }).click();
  await expect(page.getByRole('heading', { name: 'Slå ditt rekord på ×7' })).toBeVisible();
  await page.getByRole('button', { name: 'Kör! ▶' }).click();
  for (let i = 0; i < 3; i++) {
    const text = (await page.locator('.question .prompt').textContent())!;
    const [a, b] = text.match(/\d+/g)!.map(Number) as [number, number];
    expect(a === 7 || b === 7).toBe(true);
    await page.keyboard.type(String(a * b));
    await page.keyboard.press('Enter');
    await expect(page.locator('.challenge-score')).toHaveText(String(i + 1));
  }
  await page.clock.fastForward('01:31');
  await expect(page.getByRole('heading', { name: '3 rätt!' })).toBeVisible();
  await page.getByRole('button', { name: 'Igen' }).click();
  await expect(page.getByText('Ditt rekord: 3')).toBeVisible();

  // The all-facts challenge has a record of its own.
  await page.getByRole('button', { name: 'Tillbaka till trädgården' }).click();
  await page.getByRole('button', { name: '⚡ Slå ditt rekord' }).click();
  await expect(page.getByText('Första gången – sätt ett rekord!')).toBeVisible();
});
