import { expect, test, type Page } from '@playwright/test';
import { createProfile, openParent, switchPlayer } from './helpers';

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

    test('the valley fits: the places, the animal and the main button', async ({ page }) => {
      await page.goto('/');
      await createProfile(page, 'Alexandra-Charlotte');
      await page.getByRole('button', { name: 'Till dalen' }).click();
      await expect(page.locator('.valley-map')).toBeVisible();
      await expect(page.locator('.place')).toHaveCount(2);
      for (const place of ['.place-garden', '.place-brook']) await expectWithin(page, place, '.valley-ground');
      await expectWithin(page, '.valley-walker', '.valley-ground');
      await expectInside(page, '.place-status-row', 'main');
      await expectInside(page, '.valley-side .big-button', 'main');
      // What is drawn never overlaps: the animal, and each place's picture and sign.
      const parts = ['.place-garden > :first-child', '.place-garden .place-name', '.place-brook > :first-child', '.place-brook .place-name', '.valley-walker'];
      const boxes = await Promise.all(parts.map(async (sel) => (await page.locator(sel).boundingBox())!));
      for (let i = 0; i < parts.length; i++)
        for (let j = i + 1; j < parts.length; j++)
          if (parts[i]!.split(' ')[0] !== parts[j]!.split(' ')[0]) expect(overlap(boxes[i]!, boxes[j]!), `${parts[i]} / ${parts[j]}`).toBe(false);
      await expectNoSidewaysScroll(page);
    });

    test('the parent view never scrolls sideways', async ({ page }) => {
      await page.goto('/');
      await createProfile(page, 'Alexandra-Charlotte');
      await switchPlayer(page);
      await openParent(page);
      await expect(page.locator('#place-garden-heading')).toBeVisible();
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

type Box = { x: number; y: number; width: number; height: number };

const overlap = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function expectWithin(page: Page, inner: string, outer: string): Promise<void> {
  const a = (await page.locator(inner).first().boundingBox())!;
  const b = (await page.locator(outer).first().boundingBox())!;
  expect(a.x).toBeGreaterThanOrEqual(b.x);
  expect(a.y).toBeGreaterThanOrEqual(b.y);
  expect(a.x + a.width).toBeLessThanOrEqual(b.x + b.width + 0.5);
  expect(a.y + a.height).toBeLessThanOrEqual(b.y + b.height + 0.5);
}

/**
 * Measured against the configured width: phones and tablets are emulated as
 * mobile, where too wide content widens the window (zooms out) instead of
 * scrolling, so `innerWidth` would grow along with it.
 */
async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const width = page.viewportSize()!.width;
  const content = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(content).toBeLessThanOrEqual(width);
}
