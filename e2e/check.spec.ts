import { expect, test, type Page } from '@playwright/test';
import { createProfile, openParent } from './helpers';

/** Bäckens koll: separate check tasks about every seventh play day, results for grown-ups only. */

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-03-05T16:00:00') });
  await page.goto('/');
});

/** A day at the brook earlier on, as the session record a played day leaves. */
async function playedAtBrook(page: Page, day: string): Promise<void> {
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
        packId: 'addition',
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

/** The value of one side with x in the blank: "8 + 4", "? + 5", "13 − 5". */
function side(text: string, x: number): number {
  const tokens = text.replace('?', String(x)).match(/\d+|[+−]/g)!;
  let v = Number(tokens[0]);
  for (let i = 1; i < tokens.length; i += 2) v += (tokens[i] === '+' ? 1 : -1) * Number(tokens[i + 1]);
  return v;
}

async function answerCheck(page: Page): Promise<number> {
  let n = 0;
  for (;;) {
    const done = page.getByRole('heading', { name: 'Tack!' });
    await expect(done.or(page.locator('.numpad-key:not([disabled])').first())).toBeVisible();
    if (await done.isVisible()) return n;
    const prompt = (await page.locator('.question.check .prompt').textContent())!;
    const [l, r] = prompt.split('=') as [string, string];
    const x = Array.from({ length: 21 }, (_, i) => i).find((i) => side(l, i) === side(r, i))!;
    for (const d of String(x)) await page.locator('.numpad-key', { hasText: new RegExp(`^${d}$`) }).click();
    await page.getByRole('button', { name: 'Svara' }).click();
    n++;
  }
}

test('the check comes on the second day at the brook, before the session, and grown-ups see the result', async ({ page }) => {
  await createProfile(page, 'Alva', 'brook');
  await page.getByRole('button', { name: 'Börja från början' }).click();
  await playedAtBrook(page, '2026-03-04');
  await page.locator('.profile-tile', { hasText: 'Alva' }).click();
  await page.getByRole('button', { name: /^Bäcken\./ }).click();
  await page.getByRole('button', { name: 'Hoppa på stenarna' }).click();

  await expect(page.getByRole('heading', { name: 'Bäckens koll' })).toBeVisible();
  await page.getByRole('button', { name: 'Börja kollen' }).click();
  // The new forms of the equal sign are among the tasks; no marks and no clock.
  await expect(page.locator('.screen.keys-stone')).toBeVisible();
  expect(await answerCheck(page)).toBe(13);
  await expect(page.locator('.choice.correct, .prompt-card.is-right')).toHaveCount(0);
  await page.getByRole('button', { name: 'Till stenarna' }).click();
  // Then the day's session, as usual.
  await expect(page.locator('.intro-card').or(page.locator('.question'))).toBeVisible();

  // The result is for grown-ups only.
  await page.getByRole('button', { name: 'Tillbaka till bäcken' }).click();
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await page.getByRole('button', { name: 'Byt spelare' }).click();
  await openParent(page);
  const brook = page.getByRole('region', { name: /^Bäcken/ });
  const row = brook.locator('.check-results tbody tr');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('3 av 3');
  await expect(row).toContainText('4 av 4');
});

test('"Inte nu" lets the check wait until another day', async ({ page }) => {
  await createProfile(page, 'Bo', 'brook');
  await page.getByRole('button', { name: 'Börja från början' }).click();
  await playedAtBrook(page, '2026-03-04');
  await page.locator('.profile-tile', { hasText: 'Bo' }).click();
  await page.getByRole('button', { name: /^Bäcken\./ }).click();
  await page.getByRole('button', { name: 'Hoppa på stenarna' }).click();
  await page.getByRole('button', { name: 'Inte nu' }).click();
  await expect(page.locator('.intro-card').or(page.locator('.question'))).toBeVisible();
  await page.getByRole('button', { name: 'Tillbaka till bäcken' }).click();
  await page.getByRole('button', { name: 'Hoppa på stenarna' }).click();
  await expect(page.getByRole('heading', { name: 'Bäckens koll' })).toHaveCount(0);
  await expect(page.locator('.intro-card').or(page.locator('.question'))).toBeVisible();
});
