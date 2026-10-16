import { expect, test } from '@playwright/test';
import { createProfile, openParent, switchPlayer, untilIntro } from './helpers';

/**
 * Answers the check: right (and fast) for facts with a factor in `known`, otherwise "0".
 * Delat med (after the multiplications) is answered right only with `divides`.
 */
async function answerCheck(page: import('@playwright/test').Page, known: number[], thinkMs = 0, divides = false) {
  for (let i = 0; i < 90; i++) {
    const done = page.getByRole('button', { name: 'Till trädgården' });
    const prompt = page.locator('.question .prompt');
    await expect(done.or(page.locator('.numpad-key:not([disabled])').first())).toBeVisible();
    if (await done.isVisible()) return;
    // As written: a fraction bar draws 21 ÷ 3 as "213".
    const text = (await prompt.getAttribute('data-prompt'))!;
    const division = /(\d+) ÷ (\d+)/.exec(text);
    const [a, b] = division ? [Number(division[1]) / Number(division[2]), Number(division[2])] : (text.match(/\d+/g)!.map(Number) as [number, number]);
    const right = division ? (divides ? String(a) : '0') : known.includes(a) || known.includes(b) ? String(a * b) : '0';
    if (thinkMs) await page.clock.fastForward(thinkMs);
    await page.keyboard.type(right);
    await page.keyboard.press('Enter');
  }
}

test('a new player who knows ×2, ×10, ×5 and ×1 starts at ×4', async ({ page }) => {
  await page.goto('/');
  // A new child starts at the brook; the garden's start check comes on the first visit there.
  await createProfile(page, 'Alva', 'garden-check');
  await page.getByRole('button', { name: 'Gör startkollen' }).click();
  await answerCheck(page, [10, 2, 5, 1]);

  await expect(page.getByText('Du kan redan ×2, ×10, ×5 och ×1', { exact: false })).toBeVisible();
  await expect(page.getByText('Vi fortsätter med ×4.')).toBeVisible();
  await page.getByRole('button', { name: 'Till trädgården' }).click();
  await expect(page.locator('.grid-cell.stage-bush')).toHaveCount(64);
  // ×4 is open: it waits for doubling and halving on Stigen, and a child who knows ×5 can halve.
  // ×3, ×9 and ×6 wait for going over the ten on Stigen (at most three weeks).
  await expect(page.locator('.grid-cell.stage-soil')).toHaveCount(11);
  await expect(page.locator('.garden-next')).toHaveText('×3 kommer när du kan gå över tiotalet på stigen.');

  // The first new fact of the day comes from ×4 ("Lika stora grupper" counts as known: ×2 sits).
  await page.getByRole('button', { name: 'Vattna trädgården' }).click();
  await untilIntro(page);
  await expect(page.locator('.intro-card .prompt')).toHaveText(/(^4 × \d+$)|(^\d+ × 4$)/);
});

test('a child who knows ×2 but answers slowly still starts after it', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  // A new child starts at the brook; the garden's start check comes on the first visit there.
  await createProfile(page, 'Sixten', 'garden-check');
  await page.getByRole('button', { name: 'Gör startkollen' }).click();
  await answerCheck(page, [2], 9000);
  await expect(page.getByText('Du kan ×2 – de blev plantor', { exact: false })).toBeVisible();
  await expect(page.getByText('Vi fortsätter med ×10.')).toBeVisible();
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

test('the start check goes on with delat med for the tables the child just showed', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Vera', 'garden-check');
  await page.getByRole('button', { name: 'Gör startkollen' }).click();
  await answerCheck(page, [10, 2], 0, true);

  await expect(page.getByText('Du kan redan ×2 och ×10', { exact: false })).toBeVisible();
  // Delat med for those tables was asked as well, and is known: kart on the bushes.
  await expect(page.getByText('Du kan dela med 2 och 10 också – buskarna fick kart!')).toBeVisible();
  await page.getByRole('button', { name: 'Till trädgården' }).click();
  await expect(page.getByRole('button', { name: '3 × 10: buske med kart' })).toBeVisible();
  await expect(page.getByRole('button', { name: '3 × 2: buske med kart' })).toBeVisible();
  // ×5 was not shown, so neither its multiplications nor its divisions are placed.
  await expect(page.getByRole('button', { name: /^3 × 5: / })).not.toHaveAccessibleName(/kart|buske/);
});

test('without delat med the check stops after the multiplications, and nothing is placed for it', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Wilma', 'garden-check');
  await page.getByRole('button', { name: 'Gör startkollen' }).click();
  await answerCheck(page, [10, 2], 0, false);
  await expect(page.getByText('Du kan redan ×2 och ×10', { exact: false })).toBeVisible();
  await expect(page.getByText(/Du kan dela med/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Till trädgården' }).click();
  await expect(page.getByRole('button', { name: '3 × 10: buske', exact: true })).toBeVisible();
});
