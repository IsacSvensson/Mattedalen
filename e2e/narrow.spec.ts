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

async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}
