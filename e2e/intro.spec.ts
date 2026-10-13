import { expect, test, type Page } from '@playwright/test';
import { answer, createProfile, nextStep, seedStates } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-02-02T16:00:00') });
  await page.goto('/');
  await createProfile(page, 'Alva');
});

/** Drags on the 10 × 10 board from the top-left dot to the dot at (rows, cols). */
async function drag(page: Page, rows: number, cols: number) {
  const board = page.locator('.builder-board');
  const box = (await board.boundingBox())!;
  const at = (r: number, c: number) => ({ x: box.x + ((3 + 5 + (c - 1) * 10) / 106) * box.width, y: box.y + ((3 + 5 + (r - 1) * 10) / 106) * box.height });
  const start = at(1, 1);
  const end = at(rows, cols);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move((start.x + end.x) / 2, (start.y + end.y) / 2, { steps: 4 });
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await page.mouse.up();
}

test('a new fact is built by dragging out its rectangle', async ({ page }) => {
  await page.getByRole('button', { name: 'Vattna trädgården ▶' }).click();
  const prompt = await page.locator('.intro-card .prompt').textContent();
  const [a, b] = prompt!.match(/\d+/g)!.map(Number) as [number, number];
  await expect(page.getByText(`Dra ut ${a} ${a === 1 ? 'rad' : 'rader'} med ${b} i varje`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nu du! ▶' })).toBeHidden();

  // A wrong rectangle gives a hint and nothing else.
  await drag(page, 2, 2);
  await expect(page.locator('.builder-size')).toHaveText('2 × 2');
  await expect(page.getByText('Vi söker', { exact: false })).toBeVisible();

  // The mirrored rectangle can be turned around.
  await drag(page, b, a);
  if (a !== b) {
    await expect(page.getByText('Nästan!', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Vrid 🔄' }).click();
  }
  await expect(page.getByText(`Där är ${a} × ${b}!`)).toBeVisible();
  await expect(page.locator('.intro-card .array-view')).toBeVisible();
  await page.getByRole('button', { name: 'Nu du! ▶' }).click();
  await expect(page.locator('.choice')).toHaveCount(4);
});

test('a fact whose twin is known starts from the twin and is turned around', async ({ page }) => {
  await seedStates(page, { '1x10': { status: 'fluent', box: 2, dueDay: '2026-02-09' } });
  await page.getByRole('button', { name: /Alva/ }).click();
  await page.getByRole('button', { name: 'Vattna trädgården ▶' }).click();
  // Warm-up first, then the twin 10 × 1 is the preferred new fact.
  for (let i = 0; i < 6; i++) {
    await expect(nextStep(page)).toBeVisible();
    if (await page.locator('.intro-card').isVisible()) break;
    await answer(page);
  }
  await expect(page.locator('.intro-card .prompt')).toHaveText('10 × 1');
  await expect(page.getByText('Du kan redan 1 × 10. Vrid den!')).toBeVisible();
  await page.getByRole('button', { name: 'Vrid 🔄' }).click();
  await expect(page.getByText('10 × 1 är lika mycket som 1 × 10', { exact: false })).toBeVisible();
});

test('fluent facts are answered freely on a number pad', async ({ page }) => {
  const fluent: Record<string, { status: string; box: number }> = {};
  for (let n = 1; n <= 10; n++) {
    fluent[`10x${n}`] = { status: 'fluent', box: 2 };
    fluent[`${n}x10`] = { status: 'fluent', box: 2 };
  }
  await seedStates(page, fluent);
  await page.getByRole('button', { name: /Alva/ }).click();
  await page.getByRole('button', { name: 'Vattna trädgården ▶' }).click();
  await expect(page.locator('.numpad')).toBeVisible();
  const text = (await page.locator('.question .prompt').textContent())!;
  const [a, b] = text.match(/\d+/g)!.map(Number) as [number, number];

  // Typing, erasing and the keyboard all work.
  await page.keyboard.type('9');
  await page.getByRole('button', { name: 'Sudda' }).click();
  await expect(page.getByRole('button', { name: 'Svara' })).toBeDisabled();
  await page.keyboard.type(String(a * b + 1));
  await page.keyboard.press('Enter');
  await expect(page.locator('.help-answer')).toHaveText(`${a} × ${b} = ${a * b}`);
  await expect(page.locator('.numpad-display.wrong')).toBeHidden(); // replaced by the help card
  await page.getByRole('button', { name: 'Fortsätt ▶' }).click();

  await answer(page);
  await expect(page.locator('.numpad-display.correct')).toBeVisible();
});

test('the whole table is in the garden', async ({ page }) => {
  await expect(page.locator('.grid-cell.stage-locked')).toHaveCount(81);
  await expect(page.locator('.grid-cell.stage-soil')).toHaveCount(19);
});
