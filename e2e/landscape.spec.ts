import { expect, test, type Page } from '@playwright/test';
import { answer, createProfile, enterGarden, nextStep, seedStates } from './helpers';

/** A phone on its side: very little height. */
test.use({ viewport: { width: 800, height: 360 } });

async function cellSize(page: Page): Promise<number> {
  return (await page.locator('.grid-cell').first().boundingBox())!.width;
}

test('the garden fits beside its buttons, with readable squares', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Isac');
  const f = { status: 'fluent', box: 3 };
  const s: Record<string, typeof f> = {};
  for (const t of [1, 2, 3]) for (let n = 1; n <= 10; n++) Object.assign(s, { [`${t}x${n}`]: f, [`${n}x${t}`]: f });
  await seedStates(page, s);
  await page.locator('.profile-tile').first().click();

  // The valley: the whole map beside the main button, without scrolling.
  const map = (await page.locator('.valley-map').boundingBox())!;
  expect(map.y + map.height).toBeLessThanOrEqual(360);
  const go = (await page.getByRole('button', { name: 'Gå till trädgården' }).boundingBox())!;
  expect(go.y + go.height).toBeLessThanOrEqual(360);
  expect(go.x).toBeGreaterThan(map.x + map.width);
  await expectWithin(page, '.place', '.valley-ground');

  await enterGarden(page);
  await expect(page.locator('.garden-grid')).toBeVisible();
  expect(await cellSize(page)).toBeGreaterThanOrEqual(20);
  // The whole bed and the main button are on screen without scrolling.
  const bed = (await page.locator('.garden-bed').boundingBox())!;
  expect(bed.y + bed.height).toBeLessThanOrEqual(360);
  // The news about blossoms and fruit (once, for a child with bushes) is a note at the bottom until it is read.
  const news = (await page.locator('.bloom-news').boundingBox())!;
  expect(news.y + news.height).toBeLessThanOrEqual(360);
  await page.getByRole('button', { name: 'Vad roligt!' }).click();
  await expect(page.locator('.bloom-news')).toHaveCount(0);
  const button = (await page.getByRole('button', { name: 'Vattna trädgården' }).boundingBox())!;
  expect(button.y + button.height).toBeLessThanOrEqual(360);
  expect(button.x).toBeGreaterThan(bed.x + bed.width);
});

test('a question fits beside its answers', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Bo');
  await page.getByRole('button', { name: 'Vattna trädgården' }).click();
  for (let i = 0; i < 6; i++) {
    await expect(nextStep(page)).toBeVisible();
    if (await page.locator('.question').isVisible()) {
      const card = (await page.locator('.question .prompt-card').boundingBox())!;
      const answers = (await page.locator('.question .choices, .question .numpad').first().boundingBox())!;
      expect(answers.x).toBeGreaterThan(card.x + card.width - 1);
      expect(answers.y + answers.height).toBeLessThanOrEqual(361);
    }
    await answer(page);
  }
});

/** The element lies entirely inside the other one. */
async function expectWithin(page: Page, inner: string, outer: string): Promise<void> {
  const a = (await page.locator(inner).first().boundingBox())!;
  const b = (await page.locator(outer).first().boundingBox())!;
  expect(a.x).toBeGreaterThanOrEqual(b.x);
  expect(a.y).toBeGreaterThanOrEqual(b.y);
  expect(a.x + a.width).toBeLessThanOrEqual(b.x + b.width + 0.5);
  expect(a.y + a.height).toBeLessThanOrEqual(b.y + b.height + 0.5);
}
