import { expect, test, type Page } from '@playwright/test';
import { createProfile, enterGarden, switchPlayer } from './helpers';

/** A computer screen: much wider than the 760 px column. */
test.use({ viewport: { width: 1920, height: 1040 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
// The same computer in both projects: run it once.
test.beforeEach(({}, info) => test.skip(info.project.name !== 'tablet', 'Run once'));

/** The landscape band runs from edge to edge. */
async function expectFullBand(page: Page): Promise<void> {
  const band = (await page.locator('.scene').first().boundingBox())!;
  expect(Math.round(band.x)).toBe(0);
  expect(Math.round(band.width)).toBe(1920);
}

/** The name sign on the sky is wide enough for the name on one line. */
async function expectReadableTitle(page: Page): Promise<void> {
  const title = (await page.locator('.scene-title h1').boundingBox())!;
  expect(title.height).toBeLessThan(60);
  expect(title.width).toBeGreaterThan(title.height * 2);
}

test('the band runs edge to edge and the name fits on wide screens', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Isac', 'brook');
  await page.getByRole('button', { name: 'Börja från början' }).click();
  await expect(page.getByRole('heading', { name: 'Isacs bäck' })).toBeVisible();
  await expectFullBand(page);
  await expectReadableTitle(page);

  await page.getByRole('button', { name: 'Hoppa på stenarna' }).click();
  await expectFullBand(page);
  const home = (await page.locator('.scene-controls').first().boundingBox())!;
  expect(home.x).toBeGreaterThan(400);
  expect(home.x + home.width).toBeLessThan(1520);
});

test('the garden and the list of players on wide screens', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Bo');
  await expectFullBand(page);
  await expectReadableTitle(page);
  await switchPlayer(page);
  await expectFullBand(page);
  await enterGarden(page, 'Bo');
  await expectReadableTitle(page);
});
