import { expect, test } from '@playwright/test';
import { createProfile, openParent, seedStates } from './helpers';

/** The phone's back button goes back one screen, as the screen's own way back does. */

test('back goes one screen back: from a session to the garden, to the valley, to the players', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Alva');
  await expect(page.getByRole('heading', { name: 'Alvas trädgård' })).toBeVisible();

  await page.getByRole('button', { name: 'Vattna trädgården' }).click();
  await expect(page.locator('.intro-card').or(page.locator('.question'))).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Alvas trädgård' })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Mattedalen' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Vem spelar?' })).toBeVisible();

  // Into the valley again: back works as many times as it is pressed.
  await page.locator('.profile-tile', { hasText: 'Alva' }).click();
  await page.getByRole('button', { name: /^Trädgården\./ }).click();
  await page.getByRole('button', { name: 'Öva en tabell' }).click();
  await expect(page.getByRole('heading', { name: 'Vilken tabell vill du öva på?' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Alvas trädgård' })).toBeVisible();
});

test('back closes the parent view and a new player form', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Bo', 'brook');
  await page.getByRole('button', { name: 'Börja från början' }).click();
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await page.getByRole('button', { name: 'Byt spelare' }).click();
  await openParent(page);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Vem spelar?' })).toBeVisible();
  await page.getByRole('button', { name: 'Ny spelare' }).click();
  await expect(page.getByRole('textbox', { name: 'Namn' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Vem spelar?' })).toBeVisible();
});

test('the news card is readable at night, when the garden sleeps', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Cia');
  // Today's session done: the garden sleeps (dark sky), and a bush brings the news.
  await seedStates(page, { '10x1': { status: 'fluent', box: 3 } }, { packId: 'multiplication', unlockedUnitIds: ['u10'] });
  await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((r) => {
      const q = indexedDB.open('mattedalen');
      q.onsuccess = () => r(q.result);
    });
    const tx = db.transaction('progress', 'readwrite');
    const store = tx.objectStore('progress');
    const all: { meta: Record<string, unknown> }[] = await new Promise((r) => {
      const q = store.getAll();
      q.onsuccess = () => r(q.result);
    });
    const today = new Date();
    const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    for (const rec of all) store.put({ ...rec, meta: { ...rec.meta, lastSessionDay: day } });
    await new Promise((r) => (tx.oncomplete = r));
    db.close();
  });
  await page.reload();
  await page.locator('.profile-tile').first().click();
  await page.getByRole('button', { name: /^Trädgården\./ }).click();
  await expect(page.locator('.screen.garden.asleep')).toBeVisible();
  const news = page.locator('.bloom-news');
  await expect(news).toBeVisible();
  const [fg, bg] = await news.evaluate((el) => {
    const text = el.querySelector('p:not(.bloom-news-title)')!;
    return [getComputedStyle(text).color, getComputedStyle(el).backgroundColor];
  });
  const lum = (c: string) => {
    const [r, g, b] = c.match(/\d+(\.\d+)?/g)!.slice(0, 3).map((v) => {
      const x = Number(v) / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a) as [number, number];
  expect((hi + 0.05) / (lo + 0.05)).toBeGreaterThan(4.5);
});
