import { expect, test } from '@playwright/test';
import { answer, createProfile, enterGarden, introHeading, nextStep, passIntro, solve, switchPlayer, untilIntro } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-02-02T16:00:00') });
  await page.goto('/');
});

test('a first daily session: new profile, intro, questions, soft ending', async ({ page }) => {
  await expect(introHeading(page)).toBeVisible();
  await createProfile(page, 'Alva');
  await expect(page.locator('.grid-cell')).toHaveCount(100);
  await page.getByRole('button', { name: 'Vattna trädgården' }).click();

  // In the garden the keys and answers are light wood.
  await expect(page.locator('.screen.session.keys-wood')).toBeVisible();
  // The very first thing is what multiplying means: equal groups, before the first table.
  await expect(page.locator('.intro-label', { hasText: 'Lika stora grupper' })).toBeVisible();
  await expect(page.locator('.intro-card .groups-view')).toBeVisible();
  for (let i = 0; i < 8; i++) {
    await answer(page);
    await expect(page.locator('.choice.correct')).toBeVisible();
  }

  // No clock is shown; the session ends when the time is up.
  await expect(page.getByText(/\d+:\d\d/)).toHaveCount(0);
  // Time runs out while a question is on screen: it may still be answered.
  await expect(nextStep(page)).toBeVisible();
  await page.clock.fastForward('12:00');
  await answer(page);
  await expect(page.getByRole('heading', { name: 'Bra jobbat!' })).toBeVisible();
  await expect(page.getByText('Trädgården behöver sova nu.', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Till trädgården' }).click();
  await expect(page.getByText('Trädgården sover.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Öva lite till (frivilligt)' })).toBeVisible();

  // Everything survives a reload.
  await page.reload();
  await page.getByRole('button', { name: /Alva/ }).click();
  await expect(page.getByRole('button', { name: 'Trädgården. Trädgården sover. Kom tillbaka i morgon!' })).toBeVisible();
  await enterGarden(page);
  await expect(page.getByText('Trädgården sover.', { exact: false })).toBeVisible();
});

test('a wrong answer shows the right answer and a strategy, never just "fel"', async ({ page }) => {
  await createProfile(page, 'Bo', 'garden-times');
  await page.getByRole('button', { name: 'Vattna trädgården' }).click();
  // Past the warm-up and the first new fact, which is then asked.
  await untilIntro(page);
  await passIntro(page);
  const fact = await answer(page, false);
  const [a, b] = fact.split('×').map(Number) as [number, number];
  await expect(page.locator('.help-answer')).toHaveText(`${a} × ${b} = ${a * b}`);
  await expect(page.locator('.help-card .strategy')).toBeVisible();
  await expect(page.getByText(/^fel$/i)).toHaveCount(0);
  await page.getByRole('button', { name: 'Fortsätt' }).click();
  await expect(nextStep(page)).toBeVisible();
});

test('leaving early keeps progress but does not end the day', async ({ page }) => {
  await createProfile(page, 'Max', 'garden-times');
  await page.getByRole('button', { name: 'Vattna trädgården' }).click();
  await untilIntro(page);
  await answer(page);
  await page.getByRole('button', { name: 'Tillbaka till trädgården' }).click();
  await expect(page.getByRole('heading', { name: 'Max trädgård' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vattna trädgården' })).toBeVisible();
  await expect(page.locator('.grid-cell.stage-seed')).toHaveCount(1);
});

test('several children on one device', async ({ page }) => {
  await createProfile(page, 'Alva');
  await switchPlayer(page);
  await page.getByRole('button', { name: 'Ny spelare' }).click();
  await createProfile(page, 'Bo');
  await switchPlayer(page);
  await expect(page.locator('.profile-tile:not(.add)')).toHaveCount(2);
});

test('an interrupted session continues later the same day: the time adds up', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-02-02T16:00:00') });
  await page.goto('/');
  await createProfile(page, 'Alva');
  await page.getByRole('button', { name: 'Vattna trädgården' }).click();
  await answer(page);
  await expect(nextStep(page)).toBeVisible();
  await page.clock.fastForward('01:30');
  await answer(page);
  // The child leaves after about 1.5 of 6 minutes (the garden's half of 12).
  await page.getByRole('button', { name: 'Tillbaka till trädgården' }).click();
  await expect(page.getByRole('button', { name: 'Vattna trädgården' })).toBeVisible();

  // Back later: the drops continue from a quarter, not from zero.
  await page.clock.fastForward('02:00:00');
  await page.getByRole('button', { name: 'Vattna trädgården' }).click();
  const progress = page.getByRole('progressbar', { name: 'Hur långt passet har kommit' });
  await expect(progress).toHaveAttribute('aria-valuenow', /^(2[5-9]|3\d)$/);
  await expect(page.locator('.drop.on')).toHaveCount(3);

  // Another 5 minutes finishes the day's session.
  await expect(nextStep(page)).toBeVisible();
  await page.clock.fastForward('05:00');
  await answer(page);
  await expect(page.getByRole('heading', { name: 'Bra jobbat!' })).toBeVisible();
});

test('on a computer, the digit keys type the answer to a multiple choice: 3 is the answer 3', async ({ page }) => {
  await createProfile(page, 'Bo');
  await page.getByRole('button', { name: 'Vattna trädgården' }).click();
  let typed = 0;
  let differs = 0;
  for (let i = 0; i < 12 && typed < 4; i++) {
    await expect(nextStep(page)).toBeVisible();
    await passIntro(page);
    const choices = page.locator('.choice:not([disabled])');
    if (!(await choices.first().isVisible())) {
      await answer(page);
      continue;
    }
    const right = String(solve((await page.locator('.question .prompt').getAttribute('data-prompt'))!));
    const values = await choices.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.value!));
    // Counts only where the answer is not also its place among the choices (3 as the third).
    if (values.indexOf(right) + 1 !== Number(right)) differs++;
    // Catch the choice when it is made: the next question can come quickly after a right answer.
    await page.evaluate(() => {
      const w = window as unknown as { chosen?: string };
      w.chosen = undefined;
      const seen = new MutationObserver(() => {
        const el = document.querySelector<HTMLElement>('.choice.chosen');
        if (el && w.chosen === undefined) w.chosen = el.dataset.value;
      });
      seen.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    });
    await page.keyboard.type(right);
    // A number that begins a longer choice waits a moment for the next digit.
    if (values.some((v) => v !== right && v.startsWith(right))) await page.clock.runFor(1000);
    await expect.poll(() => page.evaluate(() => (window as unknown as { chosen?: string }).chosen)).toBe(right);
    typed++;
  }
  expect(differs).toBeGreaterThan(0);
});

