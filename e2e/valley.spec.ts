import { expect, test } from '@playwright/test';
import { answer, createProfile, enterGarden, nextStep, openParent, seedStates, switchPlayer } from './helpers';

/** The valley is the child's start page, with the garden, the brook and Stigen. */

test('a child chooses their name and lands in the valley, and walks to the garden and back', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Alva');
  // A new child goes straight on from the start check into the garden, as before.
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await expect(page.getByRole('heading', { name: 'Mattedalen' })).toBeVisible();
  await expect(page.locator('.place')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Trädgården. Nya frön väntar i trädgården.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bäcken. Nya stenar väntar vid bäcken.' })).toBeVisible();
  // Stigen rests until going over the ten sits at the brook.
  await expect(page.getByRole('button', { name: 'Stigen. Stigen öppnar när du kan gå över tiotalet vid bäcken.' })).toBeDisabled();
  await expect(page.locator('.valley-walker')).toHaveClass(/at-place-garden/);
  // Nothing planted yet: dug earth, and the new seeds wait in their packet.
  await expect(page.locator('.mini-cell .plant:not(.plant-soil)')).toHaveCount(0);
  await expect(page.locator('.place-garden .seed-packet')).toHaveCount(1);

  // The place itself leads to the garden …
  await page.getByRole('button', { name: /^Trädgården\./ }).click();
  await expect(page.getByRole('heading', { name: 'Alvas trädgård' })).toBeVisible();
  // … and so does the main button.
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await page.getByRole('button', { name: 'Gå till trädgården' }).click();
  await expect(page.getByRole('heading', { name: 'Alvas trädgård' })).toBeVisible();

  // To the brook and back: the child's animal now stands by the brook.
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await page.getByRole('button', { name: /^Bäcken\./ }).click();
  await page.getByRole('button', { name: 'Börja från början' }).click();
  await expect(page.getByRole('heading', { name: 'Alvas bäck' })).toBeVisible();
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await expect(page.locator('.valley-walker')).toHaveClass(/at-place-brook/);

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
  await expect(page.locator('.place-status')).toHaveText(['Trädgården är törstig.', 'Nya stenar väntar vid bäcken.', 'Stigen öppnar när du kan gå över tiotalet vid bäcken.']);
  // The furthest grown plants first: one tree, then bushes.
  await expect(page.locator('.mini-cell .plant:not(.plant-soil)')).toHaveCount(8);
  await expect(page.locator('.place-garden .seed-packet')).toHaveCount(0);
  await expect(page.locator('.mini-cell').first().locator('.plant-tree')).toHaveCount(1);
  await expect(page.locator('.mini-cell .plant-bush')).toHaveCount(7);
  // ×10 is known: one sunflower on the hill, said in words as well.
  await expect(page.locator('.valley-map .scene-sunflower')).toHaveCount(1);
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
  await expect(page.locator('.place-garden .place-name .icon')).toHaveCount(1);
  // The main button now suggests the brook; the sleeping garden can still be visited.
  await expect(page.getByRole('button', { name: 'Gå till bäcken' })).toBeVisible();
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
    'sv-SE: Nya frön väntar i trädgården. Nya stenar väntar vid bäcken. Stigen öppnar när du kan gå över tiotalet vid bäcken.',
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
  const sign = page.locator('.place-garden .place-name');
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
