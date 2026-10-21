import { expect, test, type Page } from '@playwright/test';
import { createProfile, fakeSwedishVoice, openGarden, openParent, openPath, parentPlace, parentSettings, playedAt, spoken } from './helpers';

/** Explanations when one wonders (docs/PLAN-ENKLARE.md, E4). */

const card = (page: Page) => page.getByRole('dialog', { name: 'Vad betyder bilderna?' });

/** A new child at the brook, and back to "Vem spelar?". */
async function newChild(page: Page): Promise<void> {
  await page.goto('/');
  await createProfile(page, 'Alva', 'brook');
  await page.getByRole('button', { name: 'Börja från början' }).click();
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await page.getByRole('button', { name: 'Byt spelare' }).click();
}
const explain = (page: Page) => page.getByRole('button', { name: 'Vad betyder bilderna?' });

test('"Vad betyder bilderna?" at each place: its own pictures and a few words, only when the child taps', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Alva', 'brook');
  await page.getByRole('button', { name: 'Börja från början' }).click();
  await expect(card(page)).toHaveCount(0);
  await explain(page).click();
  await expect(card(page).locator('.explain-list li')).toHaveCount(2);
  await expect(card(page)).toContainText('En sten för varje del.');
  await card(page).getByRole('button', { name: 'Okej' }).click();

  await openPath(page, 'Alva');
  await page.locator('.profile-tile', { hasText: 'Alva' }).click();
  await page.getByRole('button', { name: /^Stigen\./ }).click();
  await page.getByRole('button', { name: 'Börja från början' }).click();
  await explain(page).click();
  await expect(card(page)).toContainText('En lykta för varje del.');
  await card(page).getByRole('button', { name: 'Okej' }).click();

  await openGarden(page, 'Alva');
  await page.locator('.profile-tile', { hasText: 'Alva' }).click();
  await page.getByRole('button', { name: /^Trädgården\./ }).click();
  await page.getByRole('button', { name: 'Börja från början' }).click();
  await explain(page).click();
  await expect(card(page).locator('.explain-list li')).toHaveCount(5);
  await expect(card(page)).toContainText('Ett träd: du kan det snabbt.');
  // No times and no numbers for the child.
  await expect(card(page)).not.toContainText(/\d/);
});

test('with read-aloud the card is read', async ({ page }) => {
  await fakeSwedishVoice(page);
  await newChild(page);
  await openParent(page);
  await page.getByRole('button', { name: 'Slå på uppläsning' }).click();
  await page.getByRole('button', { name: 'Stäng föräldravyn' }).click();
  await page.locator('.profile-tile', { hasText: 'Alva' }).click();
  await page.getByRole('button', { name: /^Bäcken\./ }).click();
  await explain(page).click();
  await expect.poll(() => spoken(page)).toContain('En sten för varje del.');
});

test('"För vuxna": a sentence about the child, a tip for what they are on, and what "sitter" means', async ({ page }) => {
  await newChild(page);
  await openParent(page);
  await expect(page.locator('.child-sentence')).toHaveText('Alva har inte spelat de senaste 7 dagarna. Nu: Ett mer, ett mindre vid bäcken.');
  const tips = page.locator('.help-tips');
  await expect(tips.getByRole('heading', { name: 'Så kan du hjälpa till' })).toBeVisible();
  await expect(tips.locator('li')).toHaveText(['Ett mer, ett mindre: Ett mer är talet efter, ett mindre talet före. Fråga: vad kommer efter 7? Och före 7?']);

  // The same tip on the place's own page, under "Svåra just nu".
  await parentPlace(page, 'Bäcken');
  await expect(page.locator('.help-tip')).toContainText('Ett mer är talet efter');
  // "Sitter", from the place's page: the rules from the engine.
  await page.getByRole('button', { name: 'Vad betyder ”sitter”?' }).click();
  await expect(page.getByRole('heading', { name: 'Växterna, stenarna och lyktorna' })).toBeInViewport();
  await expect(page.locator('#sitter')).toContainText('Rätt svar under 5 sekunder på 2 olika dagar.');
  await expect(page.locator('#sitter')).toContainText('Med ”Ge mer tid” gäller 10 sekunder och 8 sekunder.');
});

test('the copy after what one wants to do: moving to another device, or saving a copy', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-02-02T16:00:00') });
  await newChild(page);
  await openParent(page);
  await parentSettings(page);
  await page.getByRole('button', { name: 'Flytta till en annan enhet' }).click();
  const move = page.getByRole('dialog', { name: 'Flytta till en annan enhet' });
  await expect(move).toContainText('QR-koden');
  await expect(move).toContainText('tar med allt, också historiken');
  const [download] = await Promise.all([page.waitForEvent('download'), move.getByRole('button', { name: 'Spara en fil' }).click()]);
  expect(download.suggestedFilename()).toBe('mattedalen-alva-2026-02-02.json');
  await expect(page.getByText('Kopian är sparad')).toBeVisible();
});

test('"Att göra" reminds about a copy after five play days, and again a month after the last', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-02-02T16:00:00') });
  await newChild(page);
  const reminder = page.locator('.todo-list li', { hasText: 'Spara en kopia av Alvas framsteg.' });
  for (let i = 0; i < 4; i++) await playedAt(page, 'addition', `2026-01-${String(20 + i).padStart(2, '0')}`);
  await page.goto('/');
  await openParent(page);
  await expect(page.getByRole('heading', { name: 'För vuxna', level: 1 })).toBeVisible();
  await expect(reminder).toHaveCount(0);

  await playedAt(page, 'addition', '2026-01-24');
  await page.goto('/');
  await openParent(page);
  // Five play days also bring the question how it is going (docs/PLAN-FRAGA.md).
  await page.getByRole('dialog', { name: 'Hur går det med Mattedalen?' }).getByRole('button', { name: 'Fråga inte igen' }).click();
  await expect(reminder).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), reminder.getByRole('button', { name: 'Spara en kopia' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^mattedalen-alva-/);
  await expect(reminder).toHaveCount(0);

  // A month later, after playing again: the reminder comes back.
  await page.clock.setSystemTime(new Date('2026-03-05T16:00:00'));
  await playedAt(page, 'addition', '2026-03-04');
  await page.goto('/');
  await openParent(page);
  await expect(reminder).toBeVisible();
});
