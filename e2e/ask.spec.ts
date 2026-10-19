import { expect, test, type Page } from '@playwright/test';
import { createProfile, openParent, playedAt } from './helpers';

/** "Hur går det med Mattedalen?" in "För vuxna" (docs/PLAN-FRAGA.md). */
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-02-02T16:00:00') });
  await page.goto('/');
});

const ask = (page: Page) => page.getByRole('dialog', { name: 'Hur går det med Mattedalen?' });
const row = (page: Page) => page.locator('.todo-list li', { hasText: 'Hur går det med Mattedalen?' });

async function playedDays(page: Page, n: number): Promise<void> {
  for (let i = 0; i < n; i++) await playedAt(page, 'addition', `2026-01-${String(20 + i).padStart(2, '0')}`);
}

test('not before five play days', async ({ page }) => {
  await createProfile(page, 'Alva', 'brook');
  await playedDays(page, 4);
  await page.goto('/');
  await openParent(page);
  await expect(ask(page)).toHaveCount(0);
  await expect(row(page)).toHaveCount(0);
});

test('after five play days: the box when "För vuxna" opens, a mail with the answer, and the row until it is answered', async ({ page }) => {
  await createProfile(page, 'Alva', 'brook');
  await playedDays(page, 5);
  await page.goto('/');
  await openParent(page);
  await expect(ask(page)).toBeVisible();
  const links = ask(page).getByRole('link');
  await expect(links).toHaveText(['Bra', 'Så där', 'Inte bra']);
  const href = (await links.nth(1).getAttribute('href'))!;
  expect(href).toMatch(/^mailto:matematikdalen@gmail\.com\?/);
  expect(decodeURIComponent(new URL(href).searchParams.get('body')!).split('\n')[0]).toBe('Hur går det? Så där');
  // Closed without a choice: the row in "Att göra" is still there, and answers from there.
  await page.keyboard.press('Escape');
  await expect(ask(page)).toHaveCount(0);
  await expect(row(page)).toBeVisible();
  await row(page).getByRole('button', { name: 'Svara' }).click();
  await expect(ask(page)).toBeVisible();
  // "Inte nu": gone for a week, the row too.
  await ask(page).getByRole('button', { name: 'Inte nu' }).click();
  await expect(ask(page)).toHaveCount(0);
  await expect(row(page)).toHaveCount(0);
  await page.goto('/');
  await openParent(page);
  await expect(ask(page)).toHaveCount(0);
});

test('"Fråga inte igen" stops the question for good', async ({ page }) => {
  await createProfile(page, 'Alva', 'brook');
  await playedDays(page, 5);
  await page.goto('/');
  await openParent(page);
  await ask(page).getByRole('button', { name: 'Fråga inte igen' }).click();
  await expect(row(page)).toHaveCount(0);
  await page.clock.setSystemTime(new Date('2026-03-04T16:00:00'));
  await page.goto('/');
  await openParent(page);
  await expect(ask(page)).toHaveCount(0);
});

test('back in "För vuxna" after an update: the question first, then what is new', async ({ page }) => {
  await createProfile(page, 'Alva', 'brook');
  await playedDays(page, 5);
  // An older post seen, and the mark an update leaves just before the reload.
  await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((r) => {
      const q = indexedDB.open('mattedalen');
      q.onsuccess = () => r(q.result);
    });
    await new Promise((r) => {
      const tx = db.transaction('settings', 'readwrite');
      tx.objectStore('settings').put('2026-10-17-tyck-till', 'newsSeen');
      tx.objectStore('settings').put('2580', 'parentPin');
      tx.oncomplete = r;
    });
    db.close();
    // A minute back: the fake clock starts over from its install time in the reloaded page, which can be earlier than now.
    sessionStorage.setItem('mattedalen:resume', JSON.stringify({ where: { kind: 'parent', page: 'overview' }, at: Date.now() - 60_000 }));
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Vuxenkod' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.type('2580');
  await expect(ask(page)).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Nytt i Mattedalen' })).toHaveCount(0);
  await ask(page).getByRole('button', { name: 'Inte nu' }).click();
  await expect(page.getByRole('dialog', { name: 'Nytt i Mattedalen' })).toBeVisible();
});
