import { expect, test, type Page } from '@playwright/test';
import { answer, createProfile, enterGarden, nextStep, openParent, seedStates, switchPlayer } from './helpers';

/** The valley is the child's start page, with the garden, the brook and Stigen. */

test('a child chooses their name and lands in the valley, and walks to the garden and back', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Alva');
  // A new child goes straight on from the start check into the garden, as before.
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await expect(page.getByRole('heading', { name: 'Mattedalen' })).toBeVisible();
  // Every place on the map, in the order the child meets them.
  await expect(page.locator('.map-place')).toHaveCount(3);
  await expect(page.locator('.map-sign')).toHaveText(['Bäcken', 'Stigen', 'Trädgården']);
  await expect(page.getByRole('button', { name: 'Trädgården. Nya frön väntar i trädgården.' })).toBeAttached();
  await expect(page.getByRole('button', { name: 'Bäcken. Nya stenar väntar vid bäcken.' })).toBeAttached();
  // Stigen rests until going over the ten sits at the brook.
  await expect(page.getByRole('button', { name: 'Stigen. Stigen öppnar när du kan gå över tiotalet vid bäcken.' })).toBeDisabled();
  await expect(page.locator('.map-place.closed')).toHaveCount(1);
  // The child's animal stands by the sign of the place the day starts at.
  await expect(page.locator('.map-place.here .map-guide')).toHaveCount(1);
  await expect(page.locator('.map-guide')).toHaveCount(1);
  // Nothing planted yet: the real bed, all dug earth.
  await expect(page.locator('.map-place .garden-grid.still')).toHaveCount(1);
  await expect(page.locator('.map-place .grid-cell:is(.stage-seed, .stage-sprout, .stage-bush, .stage-tree)')).toHaveCount(0);

  // The place itself leads to the garden …
  await page.getByRole('button', { name: /^Trädgården\./ }).click();
  await expect(page.getByRole('heading', { name: 'Alvas trädgård' })).toBeVisible();
  // … and so does its picture.
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await page.locator('.map-place[data-place="tradgarden"] .map-art').click({ position: { x: 60, y: 60 } });
  await expect(page.getByRole('heading', { name: 'Alvas trädgård' })).toBeVisible();

  // To the brook and back.
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await page.getByRole('button', { name: /^Bäcken\./ }).click();
  await page.getByRole('button', { name: 'Börja från början' }).click();
  await expect(page.getByRole('heading', { name: 'Alvas bäck' })).toBeVisible();
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await expect(page.locator('.map-place')).toHaveCount(3);

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
  const bed = page.locator('.map-place .garden-grid.still');
  await expect(bed.locator('.grid-cell.stage-tree')).toHaveCount(1);
  await expect(bed.locator('.grid-cell.stage-bush')).toHaveCount(19);
  await expect(bed.locator('.grid-cell.stage-seed')).toHaveCount(1);
  await expect(page.getByText(/Tabeller du kan: ×10\./)).toBeAttached();
  // ×10 is known: one sunflower on the hill, said in words as well.
  await expect(page.locator('.map-world .scene-sunflower')).toHaveCount(1);
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
  await expect(page.locator('.map-place.mood-asleep .map-sign .icon')).toHaveCount(1);
  // Back from the garden, the map stands there; "I dag" now has only the brook left, and says the garden sleeps.
  await expect(page.locator('.map-place.here .map-sign')).toHaveText('Trädgården');
  await page.getByRole('button', { name: 'Det här kan du göra i dag' }).click();
  const card = page.getByRole('dialog', { name: 'I dag' });
  await expect(card.locator('.today-go strong')).toHaveText(['Hoppa på stenarna']);
  await expect(card.locator('.today-rest')).toHaveText(['Trädgården sover. Kom tillbaka i morgon!']);
  await page.keyboard.press('Escape');
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
  const sign = page.locator('.map-sign', { hasText: 'Trädgården' });
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

const inView = (page: Page, name: string) =>
  page.locator('.map-sign', { hasText: name }).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight;
  });
const noPageScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight);

test.describe('the map on a phone', () => {
  test.use({ viewport: { width: 360, height: 760 } });

  test('the child drags the map around, and pointers at the edge lead to the places out of view', async ({ page }) => {
    await page.goto('/');
    await createProfile(page, 'Alva');
    await page.getByRole('button', { name: 'Till dalen' }).click();
    // The map is larger than the screen, and opens at today's place.
    const start = (await page.locator('.map-place.here .map-sign').textContent())!;
    await expect.poll(() => inView(page, start)).toBe(true);
    const view = page.locator('.map-view');
    expect(await view.evaluate((el) => el.scrollWidth > el.clientWidth && el.scrollHeight > el.clientHeight)).toBe(true);

    // Far down in the corner by the pond, a pointer at the edge leads back up to the brook.
    await view.evaluate((el) => el.scrollTo(el.scrollWidth, el.scrollHeight));
    await page.locator('.map-pointer', { hasText: 'Bäcken' }).click();
    await expect.poll(() => inView(page, 'Bäcken')).toBe(true);

    // A mouse drags the map as a finger does, and the arrow keys move it.
    const before = await view.evaluate((el) => [el.scrollLeft, el.scrollTop]);
    await page.mouse.move(200, 600);
    await page.mouse.down();
    await page.mouse.move(120, 520, { steps: 5 });
    await page.mouse.up();
    const after = await view.evaluate((el) => [el.scrollLeft, el.scrollTop]);
    expect(after).not.toEqual(before);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => view.evaluate((el) => el.scrollLeft)).toBeGreaterThan(after[0]!);

    // The map pans inside its own view: the page never scrolls.
    expect(await noPageScroll(page)).toBe(true);
  });

  test('the pointers never lie on each other or on the title', async ({ page }) => {
    await page.goto('/');
    await createProfile(page, 'Alva');
    await page.getByRole('button', { name: 'Till dalen' }).click();
    await expect(page.locator('.map-place')).toHaveCount(3);
    const bad = await page.evaluate(async () => {
      const view = document.querySelector<HTMLElement>('.map-view')!;
      const out: string[] = [];
      for (let x = 0; x <= view.scrollWidth; x += 60)
        for (let y = 0; y <= view.scrollHeight; y += 60) {
          view.scrollTo(x, y);
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const boxes = [...document.querySelectorAll('.map-pointer, .map-head h1, .map-head .avatar-button')].map((e) => e.getBoundingClientRect());
          for (let i = 0; i < boxes.length; i++) {
            const a = boxes[i]!;
            if (a.left < 0 || a.right > innerWidth || a.top < 0 || a.bottom > innerHeight) out.push(`${x},${y}: outside`);
            for (let j = i + 1; j < boxes.length; j++) {
              const b = boxes[j]!;
              if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) out.push(`${x},${y}: overlap`);
            }
          }
        }
      return out;
    });
    expect(bad).toEqual([]);
  });

  test('a turned phone stays at the same place', async ({ page }) => {
    await page.goto('/');
    await createProfile(page, 'Alva');
    await page.getByRole('button', { name: 'Till dalen' }).click();
    await page.locator('.map-view').evaluate((el) => el.scrollTo(0, 0));
    await page.locator('.map-pointer', { hasText: 'Stigen' }).click();
    await expect.poll(() => inView(page, 'Stigen')).toBe(true);
    await page.setViewportSize({ width: 760, height: 360 });
    await page.setViewportSize({ width: 360, height: 760 });
    await expect.poll(() => inView(page, 'Stigen')).toBe(true);
  });
});

test.describe('the map on a wide screen', () => {
  test.use({ viewport: { width: 1080, height: 810 } });

  test('shows the whole valley at once, without pointers', async ({ page }) => {
    await page.goto('/');
    await createProfile(page, 'Alva');
    await page.getByRole('button', { name: 'Till dalen' }).click();
    await expect(page.locator('.valley-map.fits')).toBeVisible();
    await expect(page.locator('.map-pointer')).toHaveCount(0);
    for (const name of ['Bäcken', 'Stigen', 'Trädgården']) expect(await inView(page, name)).toBe(true);
    // The whole bed is on screen.
    const bed = (await page.locator('.map-place .garden-bed').boundingBox())!;
    expect(bed.y + bed.height).toBeLessThanOrEqual(810);
    expect(await noPageScroll(page)).toBe(true);
  });
});

test('"I dag" in the corner says what is left today and starts it', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Alva');
  await page.getByRole('button', { name: 'Till dalen' }).click();
  // A sun with a dot: something is left today.
  const sun = page.getByRole('button', { name: 'Det här kan du göra i dag' });
  await expect(sun.locator('.today-dot')).toHaveCount(1);
  const card = page.getByRole('dialog', { name: 'I dag' });
  await expect(card).toBeHidden();
  await sun.click();
  await expect(card).toBeVisible();
  // Today's place first: here nothing is due anywhere, so the first in the valley.
  await expect(card.locator('.today-go strong')).toHaveText(['Hoppa på stenarna', 'Vattna trädgården']);
  await expect(card).not.toContainText(/\d/);
  // Escape and the close button put it away.
  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();
  await sun.click();
  await card.getByRole('button', { name: 'Stäng' }).click();
  await expect(card).toBeHidden();

  // A row starts the day's session there: the first time at the brook, its start check is offered first.
  await sun.click();
  await card.getByRole('button', { name: /^Hoppa på stenarna/ }).click();
  await expect(page.getByRole('heading', { name: 'Kan du redan lite plus och minus?' })).toBeVisible();
  await page.getByRole('button', { name: 'Börja från början' }).click();
  await expect(page.getByRole('heading', { name: 'Alvas bäck' })).toBeVisible();
  // Back to the map at the same place: the child's animal stands by the brook.
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await expect(page.locator('.map-place.here .map-sign')).toHaveText('Bäcken');

  // In the garden the session starts at once.
  await page.getByRole('button', { name: 'Det här kan du göra i dag' }).click();
  await page.getByRole('dialog', { name: 'I dag' }).getByRole('button', { name: /^Vattna trädgården/ }).click();
  await expect(page.locator('.session-progress')).toBeVisible();
});

test('back from a place, the map stands at that place', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Alva');
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await page.getByRole('button', { name: /^Trädgården\./ }).click();
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await expect(page.locator('.map-place.here .map-sign')).toHaveText('Trädgården');
  await expect(page.locator('.map-place.here .map-guide')).toHaveCount(1);
});

test.describe('the map for a screen reader and the keyboard', () => {
  test.use({ viewport: { width: 360, height: 760 } });

  test('the places are a list of signs, the pictures are words, and the pointers stay out of the way', async ({ page }) => {
    await page.goto('/');
    await createProfile(page, 'Alva');
    await page.getByRole('button', { name: 'Till dalen' }).click();
    const list = page.getByRole('list', { name: 'Platserna i dalen' });
    await expect(list.getByRole('listitem')).toHaveCount(3);
    await expect(list.getByRole('button')).toHaveText(['Bäcken', 'Stigen', 'Trädgården']);
    // Every picture is hidden from a screen reader and said in words instead.
    await expect(page.locator('.map-art:not([aria-hidden="true"])')).toHaveCount(0);
    await expect(list.getByText(/^Bron har \d+ av \d+ stenar på plats\.$/)).toBeAttached();
    await expect(list.getByText(/^På stigen lyser \d+ av \d+ lyktor\./)).toBeAttached();
    await expect(list.getByText('Lådan väntar på de första fröna.')).toBeAttached();
    // The pointers are a shortcut for those who see: hidden, and out of the tab order.
    await page.locator('.map-view').evaluate((el) => el.scrollTo(el.scrollWidth, el.scrollHeight));
    await expect(page.locator('.map-pointer').first()).toBeAttached();
    await expect(page.locator('.map-pointers')).toHaveAttribute('aria-hidden', 'true');
    expect(await page.locator('.map-pointer').evaluateAll((els) => els.every((el) => (el as HTMLElement).tabIndex === -1))).toBe(true);
    // A sign that gets focus is scrolled into view.
    await page.getByRole('button', { name: /^Bäcken\./ }).focus();
    await expect.poll(() => inView(page, 'Bäcken')).toBe(true);
  });

  test('with reduced motion the map jumps instead of gliding', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await createProfile(page, 'Alva');
    await page.getByRole('button', { name: 'Till dalen' }).click();
    await page.locator('.map-view').evaluate((el) => el.scrollTo(el.scrollWidth, el.scrollHeight));
    await page.locator('.map-pointer', { hasText: 'Bäcken' }).click();
    // At once, without waiting for a glide.
    expect(await inView(page, 'Bäcken')).toBe(true);
  });
});
