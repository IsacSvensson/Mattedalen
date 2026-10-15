import { expect, test, type Page } from '@playwright/test';
import { answer, createProfile, nextStep, openParent, seedStates, type SeedState } from './helpers';

/** Every ×10 fact sits (bushes), so "Dela lika" is open. */
function tens(): Record<string, SeedState> {
  const s: Record<string, SeedState> = {};
  for (let n = 1; n <= 10; n++) for (const id of [`10x${n}`, `${n}x10`]) s[id] = { status: 'fluent', box: 4 };
  return s;
}

/** Every "Dela lika" task sits too, so the divisions by 10 are open. */
function tensAndSharing(): Record<string, SeedState> {
  const s = tens();
  for (const [kind, total, by] of [
    ['share', 6, 2], ['group', 6, 3], ['share', 8, 2], ['group', 8, 4], ['share', 9, 3], ['group', 10, 5], ['share', 12, 3], ['group', 12, 4],
    ['share', 10, 2], ['group', 15, 5], ['share', 12, 4], ['group', 12, 3], ['share', 15, 3], ['group', 16, 4], ['share', 20, 5], ['group', 18, 6],
  ] as const)
    s[`share:${kind}:${total}:${by}`] = { status: 'fluent', box: 3 };
  return s;
}

test.setTimeout(60_000);

const UNITS = { packId: 'multiplication', unlockedUnitIds: ['u10', 'delalika', 'd10'] };

async function toGarden(page: Page, states: Record<string, SeedState>) {
  await seedStates(page, states, UNITS);
  await page.locator('.profile-tile').first().click();
  await page.getByRole('button', { name: /^Trädgården\./ }).click();
  await expect(page.locator('.garden-grid')).toBeVisible();
}

/** Answers questions until `stop` is visible (an introduction or support), at most `max` questions. */
async function playUntil(page: Page, stop: ReturnType<Page['locator']>, max = 40) {
  for (let i = 0; i < max; i++) {
    // The next step must be on screen before looking: answering would pass an introduction.
    await expect(nextStep(page)).toBeVisible();
    if (await stop.isVisible()) return;
    await answer(page);
  }
  await expect(stop).toBeVisible();
}

test('bushes get blossoms and fruit from delat med, with the news told once', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Alva');
  const s = tensAndSharing();
  // Everything with 10 known as division: fruit on the ×10 squares, and a harvest basket for ×10.
  for (let n = 1; n <= 10; n++) {
    s[`${10 * n}/10`] = { status: 'automatic', box: 5 };
    s[`${10 * n}/${n}`] = { status: 'fluent', box: 4 };
  }
  s['3x2'] = { status: 'fluent', box: 3 };
  s['2x3'] = { status: 'fluent', box: 3 };
  s['6/2'] = { status: 'learning', box: 1 };
  await toGarden(page, s);

  await expect(page.locator('.bloom-news')).toContainText('Nu kan dina buskar och träd få blommor och frukt!');
  await expect(page.getByRole('button', { name: '3 × 2: buske med blommor' })).toBeVisible();
  await expect(page.getByRole('button', { name: '3 × 10: buske med mogen frukt' })).toBeVisible();
  await expect(page.getByRole('button', { name: '10 × 3: buske med kart' })).toBeVisible();
  // A bush without delat med yet is just green.
  await expect(page.getByRole('button', { name: '2 × 3: buske', exact: true })).toBeVisible();
  await expect(page.locator('.grid-head .harvest-mark')).toHaveCount(2);
  await expect(page.locator('.scene .scene-basket')).toHaveCount(1);

  // Tapping a square shows the division too.
  await page.getByRole('button', { name: '3 × 10: buske med mogen frukt' }).click();
  await expect(page.locator('.grid-info')).toContainText('3 × 10 = 30');
  await expect(page.locator('.grid-info .frac')).toHaveText('3010');

  await page.getByRole('button', { name: 'Vad roligt!' }).click();
  await expect(page.locator('.bloom-news')).toHaveCount(0);
  await page.reload();
  await page.locator('.profile-tile').first().click();
  await page.getByRole('button', { name: /^Trädgården\./ }).click();
  await expect(page.locator('.garden-grid')).toBeVisible();
  await expect(page.locator('.bloom-news')).toHaveCount(0);
});

test('Dela lika: the berries are dealt out fairly, by tapping or dragging', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Bo');
  await toGarden(page, tens());
  await page.getByRole('button', { name: 'Vad roligt!' }).click();
  await page.getByRole('button', { name: 'Vattna trädgården' }).click();
  const builder = page.locator('.intro-card .share-builder');
  await playUntil(page, builder);
  await expect(page.locator('.intro-card .intro-label')).toContainText('Dela lika');
  await expect(page.locator('.intro-card .prompt')).toHaveText('6 jordgubbar delas lika i 2 korgar. Hur många i varje korg?');

  const baskets = builder.locator('.share-basket');
  await expect(baskets).toHaveCount(2);
  await baskets.first().click();
  // A second berry in the same basket waits until the other has one too.
  await baskets.first().click();
  await expect(builder.locator('.share-status')).toHaveText('Ge de andra korgarna lika många först.');
  await expect(builder.locator('.pile-berry')).toHaveCount(5);
  // Drag a berry from the pile to the second basket.
  const from = (await builder.locator('.share-pile').boundingBox())!;
  const to = (await baskets.last().boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(builder.locator('.pile-berry')).toHaveCount(4);
  await expect(baskets.last()).toHaveAccessibleName(/Korg 2: 1 bär/);
  // Taps on the pile deal to the next basket in turn.
  const go = page.getByRole('button', { name: 'Nu du!' });
  while (!(await go.isVisible())) await builder.locator('.share-pile').click();
  await expect(builder.locator('.share-status')).toHaveText('3 i varje korg!');
  await go.click();

  // The question, with the berries beside it to deal out again if the child wants to.
  await expect(page.locator('.question .prompt.words')).toBeVisible();
  await expect(page.locator('.question .share-builder')).toBeVisible();
  await expect(page.locator('.question .eq')).toHaveCount(0);
  await page.locator('.choice[data-value="3"]').click();
});

test('a new division is built as a rectangle with rows of a given length, also with the keyboard', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Cia');
  await toGarden(page, tensAndSharing());
  await page.getByRole('button', { name: 'Vad roligt!' }).click();
  await page.getByRole('button', { name: 'Vattna trädgården' }).click();
  const builder = page.locator('.intro-card .division-builder');
  await playUntil(page, builder);
  await expect(page.locator('.intro-card .intro-label')).toContainText('En ny blomma');
  const prompt = (await page.locator('.intro-card .prompt').getAttribute('data-prompt'))!;
  const [dividend, divisor] = /(\d+) ÷ (\d+)/.exec(prompt)!.slice(1).map(Number) as [number, number];
  // The fraction bar by default.
  await expect(page.locator('.intro-card .prompt .frac')).toHaveText(`${dividend}${divisor}`);

  const board = builder.locator('.builder-board');
  await expect(board).toHaveAccessibleName(`Bygg ${dividend} prickar med ${divisor} i varje rad`);
  await board.focus();
  // One row too many first: the count says so.
  for (let i = 0; i <= dividend / divisor; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(builder.locator('.builder-instruction')).toContainText('för många');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(builder.locator('.builder-instruction')).toContainText(`${dividend} prickar: ${dividend / divisor}`);
  await page.getByRole('button', { name: 'Nu du!' }).click();
  await answer(page);
});

test('a hard division is built first, then answered', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Dan');
  const s = tensAndSharing();
  // Wrong on several days: 40 ÷ 10 has no räknestig, so it is built.
  for (let n = 1; n <= 10; n++) s[`${10 * n}/10`] = { status: 'learning', box: 1, wrongDays: 3, lastWrongDay: '2026-01-30', dueDay: '2026-01-31' };
  await toGarden(page, s);
  await page.getByRole('button', { name: 'Vad roligt!' }).click();
  await page.getByRole('button', { name: 'Vattna trädgården' }).click();
  const build = page.locator('.intro-card', { hasText: 'Bygg den först' });
  await playUntil(page, build);
  const board = build.locator('.builder-board');
  const box = (await board.boundingBox())!;
  // Drag down: the rows fill in as the finger moves.
  await page.mouse.move(box.x + box.width / 2, box.y + 4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.25, { steps: 4 });
  await expect(build.locator('.builder-size')).toHaveText(/prickar/);
  await page.mouse.up();
  // Unless the drag happened to end right, "Visa mig" finishes it.
  const go = page.getByRole('button', { name: 'Nu du!' });
  if (!(await go.isVisible())) await page.getByRole('button', { name: 'Visa mig' }).click();
  await go.click();
  // Then the division itself, answered on the number pad.
  await expect(page.locator('.question.free .prompt')).toHaveAttribute('data-prompt', /\d+ ÷ 10 = __/);
  await answer(page);
});

test('grown-ups choose how delat med is written', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Eli');
  await seedStates(page, tensAndSharing(), UNITS);
  await openParent(page);
  const sign = page.getByRole('combobox', { name: 'Skriv delat med som' });
  await expect(sign).toHaveValue('fraction');
  await sign.selectOption('obelus');
  await page.getByRole('button', { name: /Tillbaka|Stäng/ }).first().click();
  await page.locator('.profile-tile', { hasText: 'Eli' }).click();
  await page.getByRole('button', { name: /^Trädgården\./ }).click();
  await page.getByRole('button', { name: 'Vad roligt!' }).click();
  await page.getByRole('button', { name: 'Vattna trädgården' }).click();
  const builder = page.locator('.intro-card .division-builder');
  await playUntil(page, builder);
  await expect(page.locator('.intro-card .prompt .frac')).toHaveCount(0);
  await expect(page.locator('.intro-card .prompt')).toContainText('÷');
});
