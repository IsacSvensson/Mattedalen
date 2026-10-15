import { expect, type Page } from '@playwright/test';

/**
 * Creates a player. A new child starts at the brook, where the start check is
 * offered (`'brook'` stops there). Most tests are about the garden, which opens
 * for a new child later: like a grown-up in the parent view, `'garden'` (the
 * default) opens it, goes there, and starts from scratch.
 */
export async function createProfile(page: Page, name: string, start: 'garden' | 'garden-check' | 'brook' = 'garden'): Promise<void> {
  await page.getByRole('textbox', { name: 'Namn' }).fill(name);
  await page.getByRole('button', { name: 'Välj sköldpadda' }).click();
  await page.getByRole('button', { name: 'Klar' }).click();
  await expect(page.getByRole('heading', { name: 'Kan du redan lite plus och minus?' })).toBeVisible();
  if (start === 'brook') return;
  await openGarden(page, name);
  await page.locator('.profile-tile', { hasText: name }).click();
  await page.getByRole('button', { name: /^Trädgården\./ }).click();
  // The garden's own start check is offered the first time (`'garden-check'` stops there); most tests start from scratch.
  await expect(page.getByRole('heading', { name: 'Kan du redan lite gånger?' })).toBeVisible();
  if (start === 'garden-check') return;
  await page.getByRole('button', { name: 'Börja från början' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`${name}s? trädgård`) })).toBeVisible();
}

/** Opens the garden for a child, as a grown-up does in the parent view, and reloads. */
export async function openGarden(page: Page, name: string): Promise<void> {
  await page.evaluate(async (who) => {
    const db: IDBDatabase = await new Promise((r) => {
      const q = indexedDB.open('mattedalen');
      q.onsuccess = () => r(q.result);
    });
    const profiles: { name: string; settings: Record<string, unknown> }[] = await new Promise((r) => {
      const q = db.transaction('profiles').objectStore('profiles').getAll();
      q.onsuccess = () => r(q.result);
    });
    const profile = profiles.find((p) => p.name === who)!;
    await new Promise((r) => {
      const tx = db.transaction('profiles', 'readwrite');
      tx.objectStore('profiles').put({ ...profile, settings: { ...profile.settings, gardenOpen: true } });
      tx.oncomplete = r;
    });
    db.close();
  }, name);
  await page.reload();
}

/** From the valley (or the list of players) into the garden, by the place on the map. */
export async function enterGarden(page: Page, name?: string): Promise<void> {
  if (name) await page.locator('.profile-tile', { hasText: name }).click();
  await page.getByRole('button', { name: /^Trädgården\./ }).click();
  await expect(page.getByRole('heading', { name: /s? trädgård$/ })).toBeVisible();
}

/** From the garden, through the valley, to the list of players. */
export async function switchPlayer(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await page.getByRole('button', { name: 'Byt spelare' }).click();
  await expect(page.getByRole('heading', { name: 'Vem spelar?' })).toBeVisible();
}

/** The next step of a session is visible: a question or the intro of a new fact. */
export function nextStep(page: Page) {
  return page
    .locator('.intro-card')
    .or(page.locator('.choice:not([disabled])').first())
    .or(page.locator('.numpad-key:not([disabled])').first());
}

/** Passes the introduction of a new fact with the "Visa mig" shortcut, if one is showing. */
export async function passIntro(page: Page): Promise<void> {
  if (!(await page.locator('.intro-card').isVisible())) return;
  const showMe = page.getByRole('button', { name: 'Visa mig' });
  if (await showMe.isVisible()) await showMe.click();
  else await page.getByRole('button', { name: 'Vrid' }).click();
  await page.getByRole('button', { name: 'Nu du!' }).click();
}

/** Value of a step on the derivation path: "5 × 7", "35 + 7", "60 − 6" or "hälften av 70". */
function evaluate(prompt: string): number {
  const half = /hälften av (\d+)/.exec(prompt);
  if (half) return Number(half[1]) / 2;
  const [x, op, y] = prompt.match(/\d+|[+−×]/g)! as [string, string, string];
  return op === '+' ? Number(x) + Number(y) : op === '−' ? Number(x) - Number(y) : Number(x) * Number(y);
}

async function typeOnPad(page: Page, value: string): Promise<void> {
  for (const d of value) await page.locator('.numpad-key', { hasText: new RegExp(`^${d}$`) }).click();
  await page.getByRole('button', { name: 'Svara' }).click();
}

/** Walks a derivation path ("räknestigen"); only the last step is the answer. Returns the fact. */
export async function answerDerive(page: Page, correct = true): Promise<string> {
  const steps = page.locator('.derive-step');
  for (;;) {
    const current = page.locator('.derive-step.current .derive-prompt');
    await expect(current).toBeVisible();
    const prompt = (await current.textContent())!;
    const target = await page.locator('.derive-step.current.target').isVisible();
    const done = await steps.count();
    await typeOnPad(page, String(evaluate(prompt) + (target && !correct ? 1 : 0)));
    if (target) return prompt.replace(/ /g, '');
    await expect(steps.nth(done - 1)).not.toHaveClass(/current/);
  }
}

/** Answers the current question (multiple choice or number pad). Returns the fact asked. */
export async function answer(page: Page, correct = true): Promise<string> {
  await expect(nextStep(page)).toBeVisible();
  await passIntro(page);
  if (await page.locator('.question.derive').isVisible()) return answerDerive(page, correct);
  const prompt = page.locator('.question .prompt');
  await expect(prompt).toBeVisible();
  const text = (await prompt.textContent()) ?? '';
  const [a, b] = text.match(/\d+/g)!.map(Number) as [number, number];
  const right = String(a * b);

  if (await page.locator('.numpad').isVisible()) {
    const value = correct ? right : String(a * b + 1);
    for (const d of value) await page.locator('.numpad-key', { hasText: new RegExp(`^${d}$`) }).click();
    await page.getByRole('button', { name: 'Svara' }).click();
    return `${a}×${b}`;
  }

  const choices = page.locator('.choice:not([disabled])');
  await expect(choices).toHaveCount(4);
  const values = await choices.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.value!));
  const pick = correct ? right : values.find((v) => v !== right)!;
  await page.locator(`.choice[data-value="${pick}"]`).click();
  return `${a}×${b}`;
}

/** Writes item states for the (only) profile straight into IndexedDB, then reloads. */
export type SeedState = { status: string; box: number; dueDay?: string } & Record<string, unknown>;

/** Which pack the states belong to; the garden's by default. */
export interface SeedPack {
  packId: string;
  unlockedUnitIds: string[];
}

const GARDEN_SEED: SeedPack = { packId: 'multiplication', unlockedUnitIds: ['u10'] };

export async function seedStates(page: Page, states: Record<string, SeedState>, pack: SeedPack = GARDEN_SEED): Promise<void> {
  await page.evaluate(async ({ seed, pack }) => {
    const db: IDBDatabase = await new Promise((r) => {
      const q = indexedDB.open('mattedalen');
      q.onsuccess = () => r(q.result);
    });
    const profiles: { id: string }[] = await new Promise((r) => {
      const q = db.transaction('profiles').objectStore('profiles').getAll();
      q.onsuccess = () => r(q.result);
    });
    const full: Record<string, unknown> = {};
    for (const [itemId, s] of Object.entries(seed)) {
      // Any other fields (e.g. wrongDays, introducedDay) override the defaults.
      full[itemId] = {
        itemId,
        dueDay: '2026-02-02',
        introducedDay: '2026-01-10',
        lastSeenAt: null,
        lastWrongDay: null,
        lastRtMs: null,
        seen: 8,
        correct: 8,
        lapses: 0,
        dayBest: {},
        confusions: {},
        ...s,
      };
    }
    await new Promise((r) => {
      const tx = db.transaction('progress', 'readwrite');
      tx.objectStore('progress').put({
        profileId: profiles[0]!.id,
        packId: pack.packId,
        packVersion: 1,
        states: full,
        meta: { pacingGap: 8, unlockedUnitIds: pack.unlockedUnitIds, accuracyEma: 0.85, sessionsCompleted: 3, lastSessionDay: '2026-02-01' },
        updatedAt: 1,
      });
      tx.oncomplete = r;
    });
    db.close();
  }, { seed: states, pack });
  await page.reload();
}

/** Opens the parent view, choosing the PIN on first use. */
export async function openParent(page: Page, pin = '2580', link: RegExp = /För vuxna|föräldravyn/): Promise<void> {
  await page.getByRole('button', { name: link }).click();
  const choosing = page.getByRole('heading', { name: /Välj en vuxenkod/ });
  await expect(choosing.or(page.getByRole('heading', { name: /Vuxenkod/ }))).toBeVisible();
  if (await choosing.isVisible()) {
    await page.keyboard.type(pin);
    await expect(page.getByRole('heading', { name: /Skriv koden igen/ })).toBeVisible();
  }
  await page.keyboard.type(pin);
  await expect(page.getByRole('heading', { name: 'Föräldravy' })).toBeVisible();
}
