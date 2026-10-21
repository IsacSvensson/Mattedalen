import { expect, test, type Page } from '@playwright/test';
import { answer, closeParent, createProfile, fakeSwedishVoice, openGarden, openParent, spoken } from './helpers';

/** Less to read for the child (docs/PLAN-ENKLARE.md, E3). */

const todoRow = (page: Page) => page.locator('.todo-list li', { hasText: 'Läser Alva själv?' });

/** A child at the brook, back to the valley. */
async function toValley(page: Page): Promise<void> {
  await page.goto('/');
  await createProfile(page, 'Alva', 'brook');
  await page.getByRole('button', { name: 'Börja från början' }).click();
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await expect(page.locator('.valley-map')).toBeVisible();
}

test('with a Swedish voice: a row in "Att göra" turns reading aloud on, and the brook, the help card and the start check are read', async ({ page }) => {
  await fakeSwedishVoice(page);
  await toValley(page);
  await page.getByRole('button', { name: 'Byt spelare' }).click();
  await openParent(page);
  await expect(todoRow(page)).toBeVisible();
  await todoRow(page).getByRole('button', { name: 'Slå på uppläsning' }).click();
  await expect(todoRow(page)).toHaveCount(0);
  await closeParent(page);

  // The brook's page: a speaker beside its name.
  await page.locator('.profile-tile', { hasText: 'Alva' }).click();
  await page.getByRole('button', { name: /^Bäcken\./ }).click();
  await page.locator('.scene-title').getByRole('button', { name: 'Läs upp' }).click();
  await expect.poll(() => spoken(page)).toContain('Alvas bäck.');

  // The help card after a wrong answer: read as a whole, with a thought before the way to think.
  await page.getByRole('button', { name: 'Hoppa på stenarna' }).click();
  await answer(page, false);
  await expect(page.locator('.help-card .strategy-row .think')).toBeVisible();
  await expect.poll(() => spoken(page)).toContain('talet');

  // The start check in the garden, in words a child can answer, read at once.
  await page.getByRole('button', { name: 'Fortsätt' }).click();
  await page.goto('/');
  await openGarden(page, 'Alva');
  await page.locator('.profile-tile', { hasText: 'Alva' }).click();
  await page.getByRole('button', { name: /^Trädgården\./ }).click();
  await expect(page.getByRole('heading', { name: 'Vill du visa vad du redan kan?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ja!' })).toBeVisible();
  await expect.poll(() => spoken(page)).toContain('Vill du visa vad du redan kan?');
});

test('"Alva läser själv": the row goes, and does not come back', async ({ page }) => {
  await fakeSwedishVoice(page);
  await toValley(page);
  await page.getByRole('button', { name: 'Byt spelare' }).click();
  await openParent(page);
  await todoRow(page).getByRole('button', { name: 'Alva läser själv' }).click();
  await expect(todoRow(page)).toHaveCount(0);
  await page.reload();
  await openParent(page);
  await expect(page.getByRole('heading', { name: 'För vuxna', level: 1 })).toBeVisible();
  await expect(todoRow(page)).toHaveCount(0);
});

test('without a voice: no row about reading aloud, and no speakers', async ({ page }) => {
  await toValley(page);
  await page.getByRole('button', { name: /^Bäcken\./ }).click();
  await expect(page.getByRole('button', { name: 'Läs upp' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await page.getByRole('button', { name: 'Byt spelare' }).click();
  await openParent(page);
  await expect(todoRow(page)).toHaveCount(0);
});

test("today's sign sways until the child touches the map", async ({ page }) => {
  await toValley(page);
  const sign = page.locator('.map-sign.nudge');
  await expect(sign).toHaveCount(1);
  await expect(sign).toHaveText(/Bäcken/);
  await page.locator('.map-view').dispatchEvent('pointerdown');
  await expect(page.locator('.map-sign.nudge')).toHaveCount(0);
});

test('with reduced motion the sign does not sway but has a yellow edge', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await toValley(page);
  const sign = page.locator('.map-sign.nudge');
  await expect(sign).toHaveCount(1);
  expect(await sign.evaluate((e) => getComputedStyle(e).animationName)).toBe('none');
  expect(await sign.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe('solid');
});

test.describe('the hand on the map', () => {
  test('shows the drag on a map larger than the screen, until the child moves it', async ({ page }, info) => {
    await toValley(page);
    if (await page.locator('.valley-map.fits').count()) {
      // The whole valley on the screen: nothing to drag.
      await expect(page.locator('.map-hand')).toHaveCount(0);
      return;
    }
    test.skip(info.project.name !== 'phone', 'the map is dragged on a phone');
    await expect(page.locator('.map-hand')).toBeVisible();
    await page.locator('.map-view').hover();
    await page.mouse.wheel(240, 0);
    await expect(page.locator('.map-hand')).toHaveCount(0);
    // Moved once: no hand any more.
    await page.reload();
    await page.locator('.profile-tile', { hasText: 'Alva' }).click();
    await expect(page.locator('.valley-map')).toBeVisible();
    await expect(page.locator('.map-hand')).toHaveCount(0);
  });

  test('comes at most three times', async ({ page }, info) => {
    test.skip(info.project.name !== 'phone', 'the map is dragged on a phone');
    await toValley(page);
    await expect(page.locator('.map-hand')).toHaveCount(1);
    for (let visit = 2; visit <= 4; visit++) {
      await page.reload();
      await page.locator('.profile-tile', { hasText: 'Alva' }).click();
      await expect(page.locator('.valley-map')).toBeVisible();
      await expect(page.locator('.map-hand')).toHaveCount(visit <= 3 ? 1 : 0);
    }
  });
});
