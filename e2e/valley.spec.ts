import { expect, test, type Page } from '@playwright/test';
import { answer, createProfile, enterGarden, nextStep, openParent, seedStates, switchPlayer } from './helpers';

/** The valley is the child's start page, with the garden, the brook and Stigen. */

test('a child chooses their name and lands in the valley, and walks to the garden and back', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Alva');
  // A new child goes straight on from the start check into the garden, as before.
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await expect(page.getByRole('heading', { name: 'Mattedalen' })).toBeVisible();
  // One scene per place, in the order the child meets them.
  await expect(page.locator('.world-scene')).toHaveCount(3);
  await expect(page.locator('.world-sign')).toHaveText(['Bäcken', 'Stigen', 'Trädgården']);
  await expect(page.getByRole('button', { name: 'Trädgården. Nya frön väntar i trädgården.' })).toBeAttached();
  await expect(page.getByRole('button', { name: 'Bäcken. Nya stenar väntar vid bäcken.' })).toBeAttached();
  // Stigen rests until going over the ten sits at the brook.
  await expect(page.getByRole('button', { name: 'Stigen. Stigen öppnar när du kan gå över tiotalet vid bäcken.' })).toBeDisabled();
  await expect(page.locator('.world-scene.closed')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Gå till stigen' })).toHaveCount(0);
  // The child's animal stands by the sign of the scene the day starts at.
  await expect(page.locator('.world-scene.here .world-guide')).toHaveCount(1);
  // Nothing planted yet: the real bed, all dug earth.
  await expect(page.locator('.world-scene .garden-grid.still')).toHaveCount(1);
  await expect(page.locator('.world-scene .grid-cell:is(.stage-seed, .stage-sprout, .stage-bush, .stage-tree)')).toHaveCount(0);

  // The place itself leads to the garden …
  await page.getByRole('button', { name: /^Trädgården\./ }).click();
  await expect(page.getByRole('heading', { name: 'Alvas trädgård' })).toBeVisible();
  // … and so does the main button.
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await page.getByRole('button', { name: 'Gå till trädgården' }).click();
  await expect(page.getByRole('heading', { name: 'Alvas trädgård' })).toBeVisible();

  // To the brook and back.
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await page.getByRole('button', { name: /^Bäcken\./ }).click();
  await page.getByRole('button', { name: 'Börja från början' }).click();
  await expect(page.getByRole('heading', { name: 'Alvas bäck' })).toBeVisible();
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await expect(page.locator('.world-scene')).toHaveCount(3);

  // Opening the app again: choose the player, and the valley is the start page.
  await page.reload();
  await page.locator('.profile-tile', { hasText: 'Alva' }).click();
  await expect(page.getByRole('heading', { name: 'Mattedalen' })).toBeVisible();
  await page.getByRole('button', { name: 'Byt spelare' }).click();
  await expect(page.getByRole('heading', { name: 'Vem spelar?' })).toBeVisible();
});

test('the valley shows what the child knows: plants in the bed and a sunflower per table', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-02-02T16:00:00') });
  await page.goto('/');
  await createProfile(page, 'Bo');
  const fluent = { status: 'fluent', box: 3 };
  const states: Record<string, typeof fluent> = { '3x3': { status: 'automatic', box: 5 }, '2x2': { status: 'learning', box: 0 } };
  for (let n = 1; n <= 10; n++) Object.assign(states, { [`10x${n}`]: fluent, [`${n}x10`]: fluent });
  await seedStates(page, states);
  await page.locator('.profile-tile', { hasText: 'Bo' }).click();

  const thirsty = page.getByRole('button', { name: 'Trädgården. Trädgården är törstig.' });
  await expect(thirsty).toBeVisible();
  await expect(page.locator('.place-status')).toHaveText(['Nya stenar väntar vid bäcken.', 'Stigen öppnar när du kan gå över tiotalet vid bäcken.', 'Trädgården är törstig.']);
  // The bed as it is: the tree and the bushes in their own squares, and the seed.
  const bed = page.locator('.world-scene .garden-grid.still');
  await expect(bed.locator('.grid-cell.stage-tree')).toHaveCount(1);
  await expect(bed.locator('.grid-cell.stage-bush')).toHaveCount(19);
  await expect(bed.locator('.grid-cell.stage-seed')).toHaveCount(1);
  await expect(page.getByText(/Tabeller du kan: ×10\./)).toBeAttached();
  // ×10 is known: one sunflower on the hill, said in words as well.
  await expect(page.locator('.valley-head .scene-sunflower')).toHaveCount(1);
  await expect(page.getByText('Solrosor på kullen: 1, en för varje tabell du kan.')).toBeAttached();

  // After the day's session the garden sleeps, but can still be visited.
  await enterGarden(page);
  await page.getByRole('button', { name: 'Vattna trädgården' }).click();
  await answer(page);
  await page.clock.fastForward('12:00');
  // The time is up: the question on screen is answered first, if there is one.
  const end = page.getByRole('button', { name: 'Till trädgården' });
  await expect(nextStep(page).or(end)).toBeVisible();
  if (!(await end.isVisible())) await answer(page);
  await end.click();
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await expect(page.getByRole('button', { name: 'Trädgården. Trädgården sover. Kom tillbaka i morgon!' })).toBeVisible();
  await expect(page.locator('.world-scene.mood-asleep .world-sign .icon')).toHaveCount(1);
  // The day now starts at the brook; the sleeping garden can still be visited.
  await expect(page.locator('.world-scene.here .world-sign')).toHaveText('Bäcken');
  await enterGarden(page);
  await expect(page.getByText('Trädgården sover. Kom tillbaka i morgon!')).toBeVisible();
});

test('the valley can be read aloud', async ({ page }) => {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as unknown as { spoken: string[] }).spoken = spoken;
    class FakeUtterance {
      lang = '';
      rate = 1;
      voice: unknown = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance });
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        getVoices: () => [{ lang: 'sv-SE', name: 'Alva', localService: true }],
        speak: (u: FakeUtterance) => {
          spoken.push(`${u.lang}: ${u.text}`);
          setTimeout(() => u.onend?.(), 10);
        },
        cancel: () => undefined,
        addEventListener: () => undefined,
      },
    });
  });
  await page.goto('/');
  await createProfile(page, 'Alva');
  await page.getByRole('button', { name: 'Till dalen' }).click();
  // Without read-aloud there is no speaker button.
  await expect(page.getByRole('button', { name: 'Läs upp' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Byt spelare' }).click();
  await openParent(page);
  await page.getByRole('checkbox', { name: /Läs upp frågorna/ }).check();
  await page.getByRole('button', { name: 'Stäng föräldravyn' }).click();
  await page.locator('.profile-tile', { hasText: 'Alva' }).click();
  await page.getByRole('button', { name: 'Läs upp' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { spoken: string[] }).spoken)).toEqual([
    'sv-SE: Nya stenar väntar vid bäcken. Stigen öppnar när du kan gå över tiotalet vid bäcken. Nya frön väntar i trädgården.',
  ]);
});

test('switching player from the garden goes through the valley', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Alva');
  await switchPlayer(page);
  await expect(page.locator('.profile-tile', { hasText: 'Alva' })).toBeVisible();
});

test('a pressed sign keeps its posts behind it', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Bo');
  await page.getByRole('button', { name: 'Till dalen' }).click();
  const sign = page.locator('.world-sign', { hasText: 'Trädgården' });
  await sign.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const box = (await sign.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(200);
  // Pressed by moving down, never by a transform: a transform would draw the posts on top of the sign.
  const pressed = await sign.evaluate((el) => ({ transform: getComputedStyle(el).transform, top: getComputedStyle(el).top }));
  expect(pressed.transform).toBe('none');
  expect(pressed.top).not.toBe('0px');
  await page.mouse.up();
});

const here = (page: Page) => page.locator('.world-scene.here .world-sign');
const noSidewaysScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test.describe('the world on a phone', () => {
  test.use({ viewport: { width: 360, height: 760 } });

  test('the child moves between the scenes with the arrows, the keys and a swipe', async ({ page }) => {
    await page.goto('/');
    await createProfile(page, 'Alva');
    await page.getByRole('button', { name: 'Till dalen' }).click();
    await expect(page.locator('.world-scene.here')).toHaveCount(1);
    await expect(page.locator('.world-dots .on')).toHaveCount(1);

    // The arrow keys move one scene at a time, and stop at the ends.
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(here(page)).toHaveText('Bäcken');
    await expect(page.locator('.world-arrow.prev')).toBeHidden();
    await expect(page.locator('.world-dots span').first()).toHaveClass(/on/);

    // The arrow names the neighbour and carries its icon.
    const next = page.getByRole('button', { name: 'Till stigen', exact: true });
    await expect(next.locator('.icon')).toHaveCount(1);
    await next.click();
    await expect(here(page)).toHaveText('Stigen');
    await page.getByRole('button', { name: 'Till trädgården', exact: true }).click();
    await expect(here(page)).toHaveText('Trädgården');
    await expect(page.locator('.world-arrow.next')).toBeHidden();
    // The scene the child is at fills the screen, its button included.
    await expect.poll(() => page.locator('.world-scene.here').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.left >= 0 && r.right <= innerWidth;
    })).toBe(true);
    await expect(page.locator('.world-scene.here .big-button')).toBeInViewport();

    // A swipe: the track pans, and the world follows to the nearest scene.
    await page.locator('.world-track').evaluate((el) => el.scrollTo({ left: 0 }));
    await expect(here(page)).toHaveText('Bäcken');
    // The animal walks along, and a tap on it goes back to today's place.
    await expect(page.locator('.world-scene.here .world-guide')).toHaveCount(1);
    await page.getByRole('button', { name: 'Till dagens plats' }).click();
    await expect(page.locator('.world-scene.here .world-guide')).toHaveCount(1);

    // The world pans inside its own track: the page never scrolls sideways.
    expect(await noSidewaysScroll(page)).toBe(true);
  });

  test('a turned phone stays at the same scene', async ({ page }) => {
    await page.goto('/');
    await createProfile(page, 'Alva');
    await page.getByRole('button', { name: 'Till dalen' }).click();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.getByRole('button', { name: 'Till stigen', exact: true }).click();
    await expect(here(page)).toHaveText('Stigen');
    await page.setViewportSize({ width: 760, height: 360 });
    await page.setViewportSize({ width: 360, height: 760 });
    await expect(here(page)).toHaveText('Stigen');
    await expect.poll(() => page.locator('.world-scene.here').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.left >= 0 && r.right <= innerWidth;
    })).toBe(true);
  });
});

test.describe('the world on a wide screen', () => {
  test.use({ viewport: { width: 1080, height: 810 } });

  test('shows every scene side by side, without arrows', async ({ page }) => {
    await page.goto('/');
    await createProfile(page, 'Alva');
    await page.getByRole('button', { name: 'Till dalen' }).click();
    await expect(page.locator('.world-scene')).toHaveCount(3);
    await expect(page.locator('.world-arrow.prev')).toBeHidden();
    await expect(page.locator('.world-arrow.next')).toBeHidden();
    const boxes = await page.locator('.world-scene').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect));
    expect(boxes).toHaveLength(3);
    for (const b of boxes) {
      expect(b.left).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(1080);
    }
    for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.left).toBeGreaterThanOrEqual(boxes[i - 1]!.right);
    for (const name of ['Gå till bäcken', 'Gå till trädgården']) await expect(page.getByRole('button', { name })).toBeInViewport();
    expect(await noSidewaysScroll(page)).toBe(true);
  });
});
