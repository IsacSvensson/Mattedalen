import { expect, test, type Page } from '@playwright/test';
import { answer, closeParent, createProfile, enterGarden, nextStep, openParent, parentSettings, seedStates } from './helpers';

/** The clock for the five times table on the garden's help card (docs/PLAN-KLOCKAN.md, ST1). */

const fives = () => {
  const ids: string[] = [];
  for (let o = 1; o <= 9; o++) if (o !== 2) ids.push(`${o}x5`, `5x${o}`);
  return [...new Set(ids)];
};
const known = (ids: string[], extra: Record<string, unknown>) => Object.fromEntries(ids.map((id) => [id, { status: 'learning', box: 1, ...extra }]));
const resting = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, { status: 'fluent', box: 4, dueDay: '2026-03-01' }]));
const others = () => {
  const ids: string[] = [];
  for (let n = 1; n <= 10; n++) ids.push(`10x${n}`, `${n}x10`, `2x${n}`, `${n}x2`);
  return [...new Set(ids)];
};

/** A child whose ×5 facts are due today, each met `seen` times before. */
async function childWithFives(page: Page, seen: number): Promise<void> {
  await page.clock.install({ time: new Date('2026-02-02T16:00:00') });
  await page.goto('/');
  await createProfile(page, 'Alva', 'garden-times');
  await seedStates(page, { ...resting(others()), ...known(fives(), { seen, dueDay: '2026-02-02' }) }, { packId: 'multiplication', unlockedUnitIds: ['lika', 'u2', 'u10', 'u5'] });
  await enterGarden(page, 'Alva');
}

/** Answers wrong until the help card is for a ×5 fact; returns the card. */
async function helpForAFive(page: Page) {
  await page.getByRole('button', { name: 'Vattna trädgården' }).click();
  for (let i = 0; i < 12; i++) {
    await expect(nextStep(page)).toBeVisible();
    const asked = await answer(page, false);
    const card = page.locator('.help-card');
    await expect(card).toBeVisible();
    // The ×5 facts seeded here (2 × 5 rests with the twos).
    if (fives().includes(asked.replace('×', 'x'))) return { card, asked };
    await page.getByRole('button', { name: 'Fortsätt' }).click();
  }
  throw new Error('No ×5 fact was asked');
}

test('a wrong answer on a ×5 fact shows the clock, with only the minute hand and its own line', async ({ page }) => {
  await childWithFives(page, 9);
  const { card, asked } = await helpForAFive(page);
  const at = Number(asked.split('×').find((n) => n !== '5') ?? 5);
  await expect(card.locator('.clock-view')).toBeVisible();
  await expect(card.locator('.array-view')).toHaveCount(0);
  await expect(card.locator('.clock-hand.hour')).toHaveCount(0);
  await expect(card.locator('.strategy')).toHaveText(`Minutvisaren på ${at} är ${at * 5} minuter. ${asked.replace('×', ' × ')} = ${at * 5}.`);
  // The hand hops from 12 to where it stands, and the minutes it passes light up.
  await expect(card.locator('.clock-minutes.lit')).toHaveCount(at);
  await expect(card.locator('.clock-view')).toHaveAttribute('aria-label', `En klocka. Minutvisaren står på ${at}.`);
});

test('the other time it is the rectangle, as before', async ({ page }) => {
  await childWithFives(page, 8);
  const { card } = await helpForAFive(page);
  await expect(card.locator('.array-view')).toBeVisible();
  await expect(card.locator('.clock-view')).toHaveCount(0);
  await expect(card.locator('.strategy')).toContainText('hälften av');
});

test('"Bilder i hjälpen": with the clock turned off, only the rectangle', async ({ page }) => {
  await childWithFives(page, 9);
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await page.getByRole('button', { name: 'Byt spelare' }).click();
  await openParent(page);
  await parentSettings(page);
  const box = page.getByRole('group', { name: 'Bilder i hjälpen' }).getByRole('checkbox', { name: /Klockan för femmans tabell/ });
  await expect(box).toBeChecked();
  await box.uncheck();
  await closeParent(page);
  await enterGarden(page, 'Alva');
  const { card } = await helpForAFive(page);
  await expect(card.locator('.array-view')).toBeVisible();
  await expect(card.locator('.clock-view')).toHaveCount(0);
});

test('with reduced motion the minute hand stands where it should at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await childWithFives(page, 9);
  const { card, asked } = await helpForAFive(page);
  const at = Number(asked.split('×').find((n) => n !== '5') ?? 5);
  await expect(card.locator('.clock-hand.minute')).toHaveAttribute('transform', `rotate(${(at * 30).toFixed(2)} 70 70)`);
  await expect(card.locator('.clock-minutes.lit')).toHaveCount(at);
});
