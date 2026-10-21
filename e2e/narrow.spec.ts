import { expect, test, type Page } from '@playwright/test';
import { createProfile, openParent, parentBack, parentLink, parentPlace, parentSettings, switchPlayer } from './helpers';

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

    test('the valley fits: the map fills the screen, opens at today\'s place, and the title fits', async ({ page }) => {
      await page.goto('/');
      await createProfile(page, 'Alexandra-Charlotte');
      await page.getByRole('button', { name: 'Till dalen' }).click();
      await expect(page.locator('.map-place')).toHaveCount(3);
      await page.waitForTimeout(300);
      // The title and the child's animal at the top, inside the screen.
      await expectInside(page, '.map-head', 'main');
      // Today's place: its sign on screen, the animal beside it and never on it.
      await expectInside(page, '.map-place.here .map-sign', 'main');
      const guide = (await page.locator('.map-guide').boundingBox())!;
      const sign = (await page.locator('.map-place.here .map-sign').boundingBox())!;
      expect(overlap(guide, sign)).toBe(false);
      // The map pans in its own view: the page scrolls neither sideways nor down.
      await expectNoSidewaysScroll(page);
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    });

    test('the parent view never scrolls sideways', async ({ page }) => {
      await page.goto('/');
      await createProfile(page, 'Alexandra-Charlotte');
      await switchPlayer(page);
      await openParent(page);
      await expectNoSidewaysScroll(page);
      // Every page: each place with its heat maps open, the child's settings, the device and bringing a child in.
      for (const place of ['Bäcken', 'Stigen', 'Trädgården'] as const) {
        await parentPlace(page, place);
        const all = page.getByText(/^Alla fakta/);
        if (await all.count()) await all.click();
        await expectNoSidewaysScroll(page);
        await parentBack(page);
      }
      await parentSettings(page);
      await expectNoSidewaysScroll(page);
      // The file for the pilot, from the child's settings.
      await page.getByRole('button', { name: 'Fil till piloten…' }).click();
      await expect(page.getByRole('heading', { name: 'Fil till piloten' })).toBeVisible();
      await expectNoSidewaysScroll(page);
      await page.getByRole('button', { name: 'Tillbaka' }).click();
      await parentBack(page);
      for (const title of ['Den här enheten', 'Hämta ett barn', 'Tyck till', 'Nytt i appen', 'Så fungerar Mattedalen'] as const) {
        await parentLink(page, title);
        await expectNoSidewaysScroll(page);
        await parentBack(page);
      }
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
