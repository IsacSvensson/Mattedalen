import { expect, test, type Page } from '@playwright/test';
import { closeParent, createProfile, openParent, parentPlace, seedStates, type SeedState } from './helpers';

/** Fas D: a new child starts at the brook, the garden opens later, and the day's time is shared after what is due. */

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-02-02T16:00:00') });
  await page.goto('/');
});

const CLOSED = 'Trädgården öppnar när du kan dubblorna vid bäcken.';

/** Every addition and subtraction fact within 20. */
function allBrookFacts(state: SeedState): Record<string, SeedState> {
  const states: Record<string, SeedState> = {};
  for (let a = 0; a <= 10; a++) for (let b = 0; b <= 10; b++) Object.assign(states, { [`${a}+${b}`]: state, [`${a + b}-${a}`]: state });
  return states;
}

async function storedSetting<T>(page: Page, key: string): Promise<T> {
  return page.evaluate(async (k) => {
    const db: IDBDatabase = await new Promise((r) => {
      const q = indexedDB.open('mattedalen');
      q.onsuccess = () => r(q.result);
    });
    const value = await new Promise((r) => {
      const q = db.transaction('settings').objectStore('settings').get(k);
      q.onsuccess = () => r(q.result);
    });
    db.close();
    return value as T;
  }, key);
}

test("a new child's first day at the brook gets the whole day's time", async ({ page }) => {
  await createProfile(page, 'Alva', 'brook');
  const plans = await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((r) => {
      const q = indexedDB.open('mattedalen');
      q.onsuccess = () => r(q.result);
    });
    const keys: IDBValidKey[] = await new Promise((r) => {
      const q = db.transaction('settings').objectStore('settings').getAllKeys();
      q.onsuccess = () => r(q.result);
    });
    const plans = await Promise.all(
      keys
        .filter((k) => String(k).startsWith('dayPlan:'))
        .map((k) => new Promise((r) => {
          const q = db.transaction('settings').objectStore('settings').get(k);
          q.onsuccess = () => r(q.result);
        })),
    );
    db.close();
    return plans;
  });
  expect(plans).toEqual([{ day: '2026-02-02', total: 12, minutes: { addition: 12 } }]);
});

test('a new child starts at the brook; the garden rests until a grown-up opens it', async ({ page }) => {
  await createProfile(page, 'Alva', 'brook');
  await page.getByRole('button', { name: 'Börja från början' }).click();
  await expect(page.getByRole('heading', { name: 'Alvas bäck' })).toBeVisible();
  await page.getByRole('button', { name: 'Till dalen' }).click();

  // The garden is on the map, resting, and says when it opens; the main button goes to the brook.
  const garden = page.getByRole('button', { name: `Trädgården. ${CLOSED}` });
  await expect(garden).toBeDisabled();
  await expect(page.locator('.map-place.mood-closed')).toHaveCount(2);
  await expect(page.getByText(CLOSED)).toBeVisible();
  await expect(page.locator('.map-place.here .map-sign')).toHaveText('Bäcken');

  // A grown-up opens it.
  await page.getByRole('button', { name: 'Byt spelare' }).click();
  await openParent(page);
  await parentPlace(page, 'Trädgården');
  const gardenPart = page.getByRole('region', { name: /^Trädgården/ });
  await expect(gardenPart.getByText('Trädgården är inte öppen än.', { exact: false })).toBeVisible();
  await gardenPart.getByRole('button', { name: 'Öppna Trädgården nu' }).click();
  await expect(gardenPart.getByText('Trädgården är öppen.')).toBeVisible();
  await closeParent(page);

  // Now it is open, and the garden's own start check is offered on the first visit.
  await page.locator('.profile-tile', { hasText: 'Alva' }).click();
  await page.getByRole('button', { name: 'Trädgården. Nya frön väntar i trädgården.' }).click();
  await expect(page.getByRole('heading', { name: 'Vill du visa vad du redan kan?' })).toBeVisible();
  await page.getByRole('button', { name: 'Börja från början' }).click();
  await expect(page.getByRole('heading', { name: 'Alvas trädgård' })).toBeVisible();
  // … only once.
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await page.getByRole('button', { name: /^Trädgården\./ }).click();
  await expect(page.getByRole('heading', { name: 'Alvas trädgård' })).toBeVisible();
});

test('the garden opens by itself when doubles and going over ten sit at the brook', async ({ page }) => {
  await createProfile(page, 'Bo', 'brook');
  await page.getByRole('button', { name: 'Börja från början' }).click();
  await seedStates(page, allBrookFacts({ status: 'fluent', box: 3, dueDay: '2026-03-01' }), {
    packId: 'addition',
    unlockedUnitIds: ['ettmer', 'noll', 'sma', 'tio', 'tiokamrater', 'dubblor', 'inom10', 'naradubblor', 'overtio'],
  });
  await page.locator('.profile-tile', { hasText: 'Bo' }).click();
  await expect(page.getByRole('button', { name: /^Trädgården\./ })).toBeEnabled();
  await expect(page.locator('.map-place.closed')).toHaveCount(0);
});

test("the day's time is shared after what is due, not in halves, and kept for the day", async ({ page }) => {
  await createProfile(page, 'Alva');
  // 30 facts in the garden are due today; nothing at the brook yet.
  const due: Record<string, SeedState> = {};
  for (let n = 1; n <= 10; n++) Object.assign(due, { [`10x${n}`]: { status: 'fluent', box: 3 }, [`${n}x10`]: { status: 'fluent', box: 3 }, [`2x${n}`]: { status: 'fluent', box: 3 } });
  await seedStates(page, due);
  await page.locator('.profile-tile', { hasText: 'Alva' }).click();

  const profileId = await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((r) => {
      const q = indexedDB.open('mattedalen');
      q.onsuccess = () => r(q.result);
    });
    const profiles: { id: string }[] = await new Promise((r) => {
      const q = db.transaction('profiles').objectStore('profiles').getAll();
      q.onsuccess = () => r(q.result);
    });
    db.close();
    return profiles[0]!.id;
  });
  // The plan was made at the first visit today, before anything was due, and is kept for the day.
  await expect.poll(() => storedSetting(page, `dayPlan:${profileId}`)).toMatchObject({ day: '2026-02-02', minutes: { multiplication: 6, addition: 6 } });

  // The next day: 12 minutes, 5 each first, the 2 left over to the garden, where everything due is.
  await page.clock.fastForward('24:00:00');
  await page.getByRole('button', { name: 'Byt spelare' }).click();
  await page.locator('.profile-tile', { hasText: 'Alva' }).click();
  await expect.poll(() => storedSetting(page, `dayPlan:${profileId}`)).toMatchObject({ day: '2026-02-03', total: 12, minutes: { multiplication: 7, addition: 5 } });
  // The map opens where most is waiting.
  await expect(page.locator('.map-place.here .map-sign')).toHaveText('Trädgården');
});

test("the brook's part in the parent view: the addition table, plus and minus per part, and the scale", async ({ page }) => {
  await createProfile(page, 'Alva');
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await page.getByRole('button', { name: 'Byt spelare' }).click();
  await openParent(page);
  await parentPlace(page, 'Bäcken');
  const brook = page.getByRole('region', { name: /^Bäcken/ });
  await brook.getByText('Alla fakta (värmekarta)').click();
  await expect(brook.getByRole('heading', { name: 'Additionstabellen' })).toBeVisible();
  await expect(brook.locator('.heat-cell')).toHaveCount(121);
  await expect(brook.locator('.brook-parts li').first()).toContainText('plus 0 av 19 · minus 0 av 19');
  await expect(brook.getByRole('heading', { name: 'Vågen' })).toBeVisible();
  await expect(brook.getByText('Stämmer det?')).toBeVisible();
  await brook.locator('.heat-cell').nth(13).click();
  await expect(brook.locator('.heat-detail')).toContainText('1 + 2 = 3');
});
