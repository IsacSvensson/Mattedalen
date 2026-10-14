import { expect, test, type Page } from '@playwright/test';
import { createProfile } from './helpers';

/** Small phones: nothing may stick out of its container or make the page scroll sideways. */
for (const width of [320, 360]) {
  test.describe(`${width} px wide`, () => {
    test.use({ viewport: { width, height: 700 } });

    test('the session band keeps its drops inside the pill', async ({ page }) => {
      await page.goto('/');
      await createProfile(page, 'Alva');
      await expectNoSidewaysScroll(page);
      await page.getByRole('button', { name: 'Vattna trädgården' }).click();
      await expect(page.locator('.session-progress')).toBeVisible();
      await expectInside(page, '.session-progress .drop:last-child', '.session-progress');
      await expectNoSidewaysScroll(page);
    });

    test('the garden title is never cut off, even for a long name', async ({ page }) => {
      for (const name of ['Isac', 'Alexandra-Charlotte']) {
        await page.goto('/');
        await page.evaluate(() => indexedDB.deleteDatabase('mattedalen'));
        await page.reload();
        await createProfile(page, name);
        const title = page.locator('.scene-title h1');
        await expect(title).toContainText(name);
        const cut = await title.evaluate((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
        expect(cut).toBe(false);
        await expectInside(page, '.scene-title h1', 'main');
        await expectNoSidewaysScroll(page);
      }
    });

    test('the valley fits: the place, the animal and the main button', async ({ page }) => {
      await page.goto('/');
      await createProfile(page, 'Alexandra-Charlotte');
      await page.getByRole('button', { name: 'Till dalen' }).click();
      await expect(page.locator('.valley-map')).toBeVisible();
      await expectWithin(page, '.place', '.valley-ground');
      await expectWithin(page, '.valley-walker', '.valley-ground');
      await expectInside(page, '.place-status-row', 'main');
      await expectInside(page, '.valley-side .big-button', 'main');
      // The animal does not stand on the place.
      const place = (await page.locator('.place').boundingBox())!;
      const walker = (await page.locator('.valley-walker').boundingBox())!;
      const apart = walker.x + walker.width <= place.x || walker.y >= place.y + place.height;
      expect(apart).toBe(true);
      await expectNoSidewaysScroll(page);
    });

    test('a focus session fits the table label and the drops', async ({ page }) => {
      await page.goto('/');
      await createProfile(page, 'Bo');
      await page.getByRole('button', { name: 'Öva en tabell' }).click();
      await page.getByRole('button', { name: /^×10,/ }).click();
      await page.getByRole('button', { name: 'Öva ×10' }).click();
      await expect(page.locator('.focus-tag')).toBeVisible();
      await expectInside(page, '.session-progress .drop:last-child', '.session-progress');
      await expectInside(page, '.session-progress .focus-tag', '.session-progress');
      await expectNoSidewaysScroll(page);
    });
  });
}

async function expectInside(page: Page, inner: string, outer: string): Promise<void> {
  const a = (await page.locator(inner).first().boundingBox())!;
  const b = (await page.locator(outer).first().boundingBox())!;
  expect(a.x).toBeGreaterThanOrEqual(b.x);
  expect(a.x + a.width).toBeLessThanOrEqual(b.x + b.width + 0.5);
}

async function expectWithin(page: Page, inner: string, outer: string): Promise<void> {
  const a = (await page.locator(inner).first().boundingBox())!;
  const b = (await page.locator(outer).first().boundingBox())!;
  expect(a.x).toBeGreaterThanOrEqual(b.x);
  expect(a.y).toBeGreaterThanOrEqual(b.y);
  expect(a.x + a.width).toBeLessThanOrEqual(b.x + b.width + 0.5);
  expect(a.y + a.height).toBeLessThanOrEqual(b.y + b.height + 0.5);
}

async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}
