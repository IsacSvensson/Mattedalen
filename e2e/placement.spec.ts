import { expect, test } from '@playwright/test';
import { createProfile, openParent, switchPlayer } from './helpers';

/** Answers the check: right (and fast) for facts with a factor in `known`, otherwise "0". */
async function answerCheck(page: import('@playwright/test').Page, known: number[], thinkMs = 0) {
  for (let i = 0; i < 60; i++) {
    const done = page.getByRole('button', { name: 'Till trädgården' });
    const prompt = page.locator('.question .prompt');
    await expect(done.or(page.locator('.numpad-key:not([disabled])').first())).toBeVisible();
    if (await done.isVisible()) return;
    const [a, b] = (await prompt.textContent())!.match(/\d+/g)!.map(Number) as [number, number];
    if (thinkMs) await page.clock.fastForward(thinkMs);
    await page.keyboard.type(known.includes(a) || known.includes(b) ? String(a * b) : '0');
    await page.keyboard.press('Enter');
  }
}

test('a new player who knows ×10, ×2, ×5 and ×1 starts at ×4', async ({ page }) => {
  await page.goto('/');
  // A new child starts at the brook; the garden's start check comes on the first visit there.
  await createProfile(page, 'Alva', 'garden-check');
  await page.getByRole('button', { name: 'Gör startkollen' }).click();
  await answerCheck(page, [10, 2, 5, 1]);

  await expect(page.getByText('Du kan redan ×10, ×2, ×5 och ×1', { exact: false })).toBeVisible();
  await expect(page.getByText('Vi fortsätter med ×4.')).toBeVisible();
  await page.getByRole('button', { name: 'Till trädgården' }).click();
  await expect(page.locator('.grid-cell.stage-bush')).toHaveCount(64);
  await expect(page.locator('.grid-cell.stage-soil')).toHaveCount(11);

  // The first new fact of the day comes from ×4.
  await page.getByRole('button', { name: 'Vattna trädgården' }).click();
  await expect(page.locator('.intro-card .prompt').or(page.locator('.question'))).toBeVisible();
  for (let i = 0; i < 12 && !(await page.locator('.intro-card').isVisible()); i++) {
    const done = page.locator('.numpad-key:not([disabled]), .choice:not([disabled])').first();
    await expect(done.or(page.locator('.intro-card'))).toBeVisible();
    if (await page.locator('.intro-card').isVisible()) break;
    const [a, b] = (await page.locator('.question .prompt').textContent())!.match(/\d+/g)!.map(Number) as [number, number];
    if (await page.locator('.numpad').isVisible()) {
      await page.keyboard.type(String(a * b));
      await page.keyboard.press('Enter');
    } else await page.locator(`.choice[data-value="${a * b}"]`).click();
  }
  await expect(page.locator('.intro-card .prompt')).toHaveText(/(^4 × \d+$)|(^\d+ × 4$)/);
});

test('a child who knows ×10 but answers slowly still starts after it', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  // A new child starts at the brook; the garden's start check comes on the first visit there.
  await createProfile(page, 'Sixten', 'garden-check');
  await page.getByRole('button', { name: 'Gör startkollen' }).click();
  await answerCheck(page, [10], 9000);
  await expect(page.getByText('Du kan ×10 – de blev plantor', { exact: false })).toBeVisible();
  await expect(page.getByText('Vi fortsätter med ×2.')).toBeVisible();
  await page.getByRole('button', { name: 'Till trädgården' }).click();
  await expect(page.locator('.grid-cell.stage-sprout')).toHaveCount(19);
  await expect(page.locator('.grid-cell.stage-bush')).toHaveCount(0);
});

test('a beginner is told kindly and starts from the beginning', async ({ page }) => {
  await page.goto('/');
  // A new child starts at the brook; the garden's start check comes on the first visit there.
  await createProfile(page, 'Bo', 'garden-check');
  await page.getByRole('button', { name: 'Gör startkollen' }).click();
  await answerCheck(page, []);
  await expect(page.getByText('Nu vet trädgården var vi ska börja', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Till trädgården' }).click();
  await expect(page.locator('.grid-cell.stage-bush')).toHaveCount(0);
});

test('the check can be redone from the parent view and never moves a child back', async ({ page }) => {
  await page.goto('/');
  // A new child starts at the brook; the garden's start check comes on the first visit there.
  await createProfile(page, 'Alva', 'garden-check');
  await page.getByRole('button', { name: 'Gör startkollen' }).click();
  await answerCheck(page, [10, 2]);
  await page.getByRole('button', { name: 'Till trädgården' }).click();
  await expect(page.locator('.grid-cell.stage-bush')).toHaveCount(36);

  await switchPlayer(page);
  await openParent(page);
  await page.getByRole('button', { name: 'Gör om startkollen', exact: true }).click();
  await page.getByRole('button', { name: 'Gör startkollen' }).click();
  await answerCheck(page, []);
  await page.getByRole('button', { name: 'Till trädgården' }).click();
  await expect(page.locator('.grid-cell.stage-bush')).toHaveCount(36);
});
