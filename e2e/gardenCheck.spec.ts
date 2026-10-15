import { expect, test, type Page } from '@playwright/test';
import { answer, createProfile, openParent, seedStates, solve, type SeedState } from './helpers';

/** Trädgårdens koll, Öva en tabell with delat med, and delat med in the parent view. */

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-03-05T16:00:00') });
  await page.goto('/');
});

/** A day in the garden earlier on, as the session record a played day leaves. */
async function playedInGarden(page: Page, day: string): Promise<void> {
  await page.evaluate(async (d) => {
    const db: IDBDatabase = await new Promise((r) => {
      const q = indexedDB.open('mattedalen');
      q.onsuccess = () => r(q.result);
    });
    const profiles: { id: string }[] = await new Promise((r) => {
      const q = db.transaction('profiles').objectStore('profiles').getAll();
      q.onsuccess = () => r(q.result);
    });
    await new Promise((r) => {
      const tx = db.transaction('sessions', 'readwrite');
      tx.objectStore('sessions').put({
        id: `daily-${d}`,
        profileId: profiles[0]!.id,
        packId: 'multiplication',
        mode: 'daily',
        day: d,
        startedAt: 1,
        endedAt: 2,
        answered: 12,
        correct: 10,
        introduced: [],
      });
      tx.oncomplete = r;
    });
    db.close();
  }, day);
  await page.reload();
}

/** Every ×10 and ×2 fact sits, "Dela lika" too; delat med with 10 is open. */
function tensAndTwos(): Record<string, SeedState> {
  const s: Record<string, SeedState> = {};
  for (const t of [10, 2]) for (let n = 1; n <= 10; n++) for (const id of [`${t}x${n}`, `${n}x${t}`]) s[id] = { status: 'fluent', box: 4 };
  for (const [kind, total, by] of [
    ['share', 6, 2], ['group', 6, 3], ['share', 8, 2], ['group', 8, 4], ['share', 9, 3], ['group', 10, 5], ['share', 12, 3], ['group', 12, 4],
    ['share', 10, 2], ['group', 15, 5], ['share', 12, 4], ['group', 12, 3], ['share', 15, 3], ['group', 16, 4], ['share', 20, 5], ['group', 18, 6],
  ] as const)
    s[`share:${kind}:${total}:${by}`] = { status: 'fluent', box: 3 };
  return s;
}

test('Trädgårdens koll comes on the second day in the garden, with all kinds of tasks, and grown-ups see the result', async ({ page }) => {
  await createProfile(page, 'Alva');
  await playedInGarden(page, '2026-03-04');
  await page.locator('.profile-tile', { hasText: 'Alva' }).click();
  await page.getByRole('button', { name: /^Trädgården\./ }).click();
  await page.getByRole('button', { name: 'Vattna trädgården' }).click();

  await expect(page.getByRole('heading', { name: 'Trädgårdens koll' })).toBeVisible();
  await page.getByRole('button', { name: 'Börja kollen' }).click();
  const kinds = { times: 0, division: 0, missing: 0, share: 0 };
  for (;;) {
    const done = page.getByRole('heading', { name: 'Tack!' });
    await expect(done.or(page.locator('.numpad-key:not([disabled])').first())).toBeVisible();
    if (await done.isVisible()) break;
    const prompt = (await page.locator('.question.check .prompt').getAttribute('data-prompt'))!;
    if (/jordgubbar/.test(prompt)) {
      kinds.share++;
      // "Dela lika" comes with its berries and baskets.
      await expect(page.locator('.question.check .share-builder')).toBeVisible();
    } else if (prompt.startsWith('__ ×')) kinds.missing++;
    else if (prompt.includes('÷')) kinds.division++;
    else kinds.times++;
    for (const d of String(solve(prompt))) await page.locator('.numpad-key', { hasText: new RegExp(`^${d}$`) }).click();
    await page.getByRole('button', { name: 'Svara' }).click();
  }
  expect(kinds).toEqual({ times: 4, division: 3, missing: 2, share: 3 });
  // No marks while answering, and then the day's session as usual.
  await page.getByRole('button', { name: 'Till vattnet' }).click();
  await expect(page.locator('.intro-card').or(page.locator('.question'))).toBeVisible();

  await page.getByRole('button', { name: 'Tillbaka till trädgården' }).click();
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await page.getByRole('button', { name: 'Byt spelare' }).click();
  await openParent(page);
  const garden = page.getByRole('region', { name: 'Trädgården', exact: true });
  const row = garden.locator('.check-results tbody tr');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('4 av 4');
  await expect(row).toContainText('3 av 3');
  await expect(row).toContainText('2 av 2');
});

test('Öva en tabell takes the open delat med of the table along', async ({ page }) => {
  await createProfile(page, 'Bo');
  await seedStates(page, { ...tensAndTwos(), '20/10': { status: 'learning', box: 1 }, '20/2': { status: 'learning', box: 1 } }, {
    packId: 'multiplication',
    unlockedUnitIds: ['u10', 'delalika', 'd10', 'u2', 'd2'],
  });
  await page.locator('.profile-tile').first().click();
  await page.getByRole('button', { name: /^Trädgården\./ }).click();
  await page.getByRole('button', { name: 'Vad roligt!' }).click();
  await page.getByRole('button', { name: 'Öva en tabell' }).click();
  await page.getByRole('button', { name: /^×2,/ }).click();
  await expect(page.getByText('Delat med i ×2 övas också.')).toBeVisible();
  // The practice asks the table's divisions too.
  await page.getByRole('button', { name: 'Öva ×2' }).click();
  const asked: string[] = [];
  for (let i = 0; i < 30 && !asked.some((p) => p.includes('÷')); i++) asked.push(await answer(page));
  expect(asked.some((p) => p.includes('÷'))).toBe(true);
});

test('Öva en tabell leaves delat med out while "Dela lika" is not done', async ({ page }) => {
  await createProfile(page, 'Dan');
  const s = tensAndTwos();
  for (const id of Object.keys(s)) if (id.startsWith('share:')) delete s[id];
  await seedStates(page, s, { packId: 'multiplication', unlockedUnitIds: ['u10', 'delalika', 'u2'] });
  await page.locator('.profile-tile').first().click();
  await page.getByRole('button', { name: /^Trädgården\./ }).click();
  await page.getByRole('button', { name: 'Vad roligt!' }).click();
  await page.getByRole('button', { name: 'Öva en tabell' }).click();
  await page.getByRole('button', { name: /^×2,/ }).click();
  await expect(page.getByText(/Delat med i ×2/)).toHaveCount(0);
});

test('grown-ups see delat med apart: counts, a heat map of its own and "Dela lika"', async ({ page }) => {
  await createProfile(page, 'Cia');
  await seedStates(page, { ...tensAndTwos(), '21/3': { status: 'fluent', box: 3 }, '20/2': { status: 'learning', box: 1 } }, {
    packId: 'multiplication',
    unlockedUnitIds: ['u10', 'delalika', 'd10', 'u2', 'd2'],
  });
  await openParent(page);
  const garden = page.getByRole('region', { name: 'Trädgården', exact: true });
  await expect(garden.getByRole('heading', { name: 'Delat med' })).toBeVisible();
  await expect(garden.getByRole('group', { name: 'Värmekarta över gångertabellen' })).toBeVisible();
  const divisions = garden.getByRole('group', { name: 'Värmekarta över delat med' });
  // Row 3 (÷ 3), column 7: 21 ÷ 3 = 7.
  await expect(divisions.getByRole('button', { name: /^21 ÷ 3 = 7: flytande/ })).toBeVisible();
  await expect(divisions.getByRole('button', { name: /^20 ÷ 2 = 10: övas/ })).toBeVisible();
  await expect(garden.locator('.brook-parts li', { hasText: 'Hur många i varje korg?' })).toContainText('8 av 8 sitter');
  await expect(garden.getByRole('heading', { name: 'Trädgårdens koll' })).toBeVisible();
});
