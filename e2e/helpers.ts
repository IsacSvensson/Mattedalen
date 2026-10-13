import { expect, type Page } from '@playwright/test';

export async function createProfile(page: Page, name: string): Promise<void> {
  await page.getByRole('textbox', { name: 'Namn' }).fill(name);
  await page.getByRole('button', { name: 'Välj 🐢' }).click();
  await page.getByRole('button', { name: 'Klar' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`${name}s? trädgård`) })).toBeVisible();
}

/** Answers the current question (passing the intro card if there is one). Returns the fact asked. */
export async function answer(page: Page, correct = true): Promise<string> {
  const intro = page.getByRole('button', { name: 'Nu du! ▶' });
  const ready = page.locator('.choice:not([disabled])').first();
  await expect(intro.or(ready)).toBeVisible();
  if (await intro.isVisible()) await intro.click();
  await expect(ready).toBeVisible();
  const prompt = page.locator('.question .prompt');
  const text = (await prompt.textContent()) ?? '';
  const [a, b] = text.match(/\d+/g)!.map(Number) as [number, number];
  const right = String(a * b);
  const choices = page.locator('.choice:not([disabled])');
  await expect(choices).toHaveCount(4);
  const values = await choices.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.value!));
  const pick = correct ? right : values.find((v) => v !== right)!;
  await page.locator(`.choice[data-value="${pick}"]`).click();
  return `${a}×${b}`;
}

/** The next step of a session is visible: a question or the intro of a new fact. */
export function nextStep(page: Page) {
  return page.getByRole('button', { name: 'Nu du! ▶' }).or(page.locator('.choice:not([disabled])').first());
}
