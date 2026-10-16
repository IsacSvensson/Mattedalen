import { expect, type Page } from '@playwright/test';

/**
 * Creates a player. A new child starts at the brook, where the start check is
 * offered (`'brook'` stops there). Most tests are about the garden, which opens
 * for a new child later: like a grown-up in the parent view, `'garden'` (the
 * default) opens it, goes there, and starts from scratch.
 */
export async function createProfile(page: Page, name: string, start: 'garden' | 'garden-times' | 'garden-check' | 'brook' = 'garden'): Promise<void> {
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
  if (start !== 'garden-times') return;
  // As a child who has done "Lika stora grupper": the tables start, with ×2.
  await seedStates(page, GROUPS_KNOWN, { packId: 'multiplication', unlockedUnitIds: ['lika', 'u2'] });
  await enterGarden(page, name);
}

/** Every "Lika stora grupper" task known (docs/PLAN-HUNDRA.md). */
export const GROUPS_KNOWN: Record<string, SeedState> = Object.fromEntries(
  [
    'lika:groups:2x3', 'lika:groups:3x2', 'lika:groups:4x2', 'lika:groups:2x5', 'lika:groups:3x4', 'lika:groups:5x2',
    'lika:repeat:3x4:groups', 'lika:repeat:2x5:groups', 'lika:repeat:4x2:groups', 'lika:repeat:3x4:each',
    'lika:skip:2', 'lika:skip:5', 'lika:skip:3', 'lika:skip:10', 'lika:groups:3x0', 'lika:groups:4x1',
  ].map((id) => [id, { status: 'fluent', box: 3 }]),
);

/** Opens the garden for a child, as a grown-up does in the parent view, and reloads. */
export function openGarden(page: Page, name: string): Promise<void> {
  return openPlaceFor(page, name, 'gardenOpen');
}

/** Opens Stigen for a child, as a grown-up does in the parent view, and reloads. */
export function openPath(page: Page, name: string): Promise<void> {
  return openPlaceFor(page, name, 'pathOpen');
}

async function openPlaceFor(page: Page, name: string, setting: 'gardenOpen' | 'pathOpen'): Promise<void> {
  await page.evaluate(async ({ who, setting }) => {
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
      tx.objectStore('profiles').put({ ...profile, settings: { ...profile.settings, [setting]: true } });
      tx.oncomplete = r;
    });
    db.close();
  }, { who: name, setting });
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

/** Answers the warm-up (known items) until a new fact is introduced. */
export async function untilIntro(page: Page, max = 12): Promise<void> {
  for (let i = 0; i < max; i++) {
    await expect(nextStep(page)).toBeVisible();
    if (await page.locator('.intro-card').isVisible()) return;
    await answer(page);
  }
  await expect(page.locator('.intro-card')).toBeVisible();
}

/** Passes the introduction of a new fact with the "Visa mig" shortcut, if one is showing. */
export async function passIntro(page: Page): Promise<void> {
  if (!(await page.locator('.intro-card').isVisible())) return;
  const showMe = page.getByRole('button', { name: 'Visa mig' });
  if (await page.locator('.intro-card .share-builder').isVisible()) {
    // "Dela lika": deal the berries out, one tap on the pile at a time.
    const go = page.getByRole('button', { name: 'Nu du!' });
    while (!(await go.isVisible())) await page.locator('.intro-card .share-pile').click();
  } else if (await page.locator('.intro-card .b10-builder').isVisible()) {
    // Stigen: build the number with rods and cubes, or change ten ones for a ten.
    const change = page.getByRole('button', { name: 'Byt 10 ental mot 1 tiotal' });
    if (await change.isVisible()) await change.click();
    else {
      const target = Number(await page.locator('.intro-card .b10-builder').getAttribute('data-target'));
      for (let i = 0; i < Math.floor(target / 10); i++) await page.getByRole('button', { name: 'Lägg till ett tiotal' }).click();
      for (let i = 0; i < target % 10; i++) await page.getByRole('button', { name: 'Lägg till ett ental' }).click();
    }
  } else if (await showMe.isVisible()) await showMe.click();
  else if (await page.getByRole('button', { name: 'Vrid' }).isVisible()) await page.getByRole('button', { name: 'Vrid' }).click();
  // "Lika stora grupper" has nothing to build: "Nu du!" is there at once.
  await page.getByRole('button', { name: 'Nu du!' }).click();
}

/**
 * The answer to a prompt as written (`data-prompt`): 3 × 7, 21 ÷ 3, __ × 3 = 21,
 * __ = 21 ÷ 3, or a "Dela lika" task in words.
 */
export function solve(prompt: string): number {
  // "Lika stora grupper": baskets, repeated addition and hopping in steps.
  if (/utan några jordgubbar/.test(prompt)) return 0;
  const baskets = /(\d+) korgar med (\d+) jordgubb/.exec(prompt);
  if (baskets) return Number(baskets[1]) * Number(baskets[2]);
  const hops = /Hoppa (\d+) i taget: ([\d, ]+), __/.exec(prompt);
  if (hops) return Number(hops[2]!.split(', ').at(-1)) + Number(hops[1]);
  const groupsOf = /^([\d + ]+) = __ × (\d+)$/.exec(prompt);
  if (groupsOf) return groupsOf[1]!.split(' + ').length;
  const lastAddend = /^\d+ × (\d+) = [\d + ]+ \+ __$/.exec(prompt);
  if (lastAddend) return Number(lastAddend[1]);
  const share = /(\d+) jordgubbar delas lika i (\d+) korgar/.exec(prompt) ?? /(\d+) jordgubbar, (\d+) i varje korg/.exec(prompt);
  if (share) return Number(share[1]) / Number(share[2]);
  const missing = /__ × (\d+) = (\d+)/.exec(prompt);
  if (missing) return Number(missing[2]) / Number(missing[1]);
  const div = /(\d+) ÷ (\d+)/.exec(prompt);
  if (div) return Number(div[1]) / Number(div[2]);
  // Stigen (and the brook): sums and differences to 100, in words or with a blank.
  if (!/[×÷]/.test(prompt)) return solveSum(prompt);
  const [a, b] = prompt.match(/\d+/g)!.map(Number) as [number, number];
  return a * b;
}

/** The value of one side: "47 + 8", "hälften av 56", "dubbla 14", "6 tiotal och 3 ental", "7 ental och 4 tiotal". */
function sideValue(side: string): number | null {
  const s = side.trim();
  if (/^\d+$/.test(s)) return Number(s);
  let m = /^hälften av (\d+)$/.exec(s);
  if (m) return Number(m[1]) / 2;
  m = /^dubbla (\d+)$/.exec(s);
  if (m) return 2 * Number(m[1]);
  m = /^(\d+) tiotal$/.exec(s);
  if (m) return 10 * Number(m[1]);
  m = /^(\d+) tiotal och (\d+) ental$/.exec(s);
  if (m) return 10 * Number(m[1]) + Number(m[2]);
  m = /^(\d+) ental och (\d+) tiotal$/.exec(s);
  if (m) return 10 * Number(m[2]) + Number(m[1]);
  if (!/^\d+( [+−] \d+)*$/.test(s)) return null;
  return evaluate(s);
}

/** The number that makes both sides of a sentence with a blank equal (0–100). */
function solveSum(prompt: string): number {
  if (!prompt.includes('__')) return sideValue(prompt)!;
  for (let n = 0; n <= 100; n++) {
    const [l, r] = prompt.replace('__', String(n)).split(' = ');
    const [a, b] = [sideValue(l!), sideValue(r!)];
    if (a !== null && b !== null && a === b) return n;
  }
  throw new Error(`Cannot solve ${prompt}`);
}

/** Value of a step on the derivation path: "5 × 7", "35 + 7", "60 − 6" or "hälften av 70". */
function evaluate(prompt: string): number {
  const half = /hälften av (\d+)/.exec(prompt);
  if (half) return Number(half[1]) / 2;
  const div = /^(\d+) ÷ (\d+)$/.exec(prompt);
  if (div) return Number(div[1]) / Number(div[2]);
  // Sums and differences, also of several terms: "35 + 7", "30 + 6 + 6", "60 − 6 − 6".
  if (/^\d+( [+−] \d+)+$/.test(prompt)) {
    const t = prompt.split(' ');
    let value = Number(t[0]);
    for (let i = 1; i < t.length; i += 2) value += (t[i] === '+' ? 1 : -1) * Number(t[i + 1]);
    return value;
  }
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
    const prompt = (await current.getAttribute('data-prompt'))!;
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
  // As written, not as drawn: a fraction bar shows 21 ÷ 3 as "213".
  const text = (await prompt.getAttribute('data-prompt')) ?? '';
  const solved = solve(text);
  const right = String(solved);
  // A multiplication is reported as "3×7"; anything else as its prompt.
  const times = /^(\d+) × (\d+)$/.exec(text);
  const asked = times ? `${times[1]}×${times[2]}` : text;

  if (await page.locator('.numpad').isVisible()) {
    const value = correct ? right : String(solved + 1);
    for (const d of value) await page.locator('.numpad-key', { hasText: new RegExp(`^${d}$`) }).click();
    await page.getByRole('button', { name: 'Svara' }).click();
    return asked;
  }

  const choices = page.locator('.choice:not([disabled])');
  await expect(choices).toHaveCount(4);
  const values = await choices.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.value!));
  const pick = correct ? right : values.find((v) => v !== right)!;
  await page.locator(`.choice[data-value="${pick}"]`).click();
  return asked;
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

/** A day on a place earlier on, as the session record a played day leaves. */
export async function playedAt(page: Page, packId: string, day: string): Promise<void> {
  await page.evaluate(
    async ({ packId, day }) => {
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
        tx.objectStore('sessions').put({ id: `daily-${day}`, profileId: profiles[0]!.id, packId, mode: 'daily', day, startedAt: 1, endedAt: 2, answered: 12, correct: 10, introduced: [] });
        tx.oncomplete = r;
      });
      db.close();
    },
    { packId, day },
  );
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
  // The overview, or "Hämta ett barn" from the link for a child from another device.
  await expect(page.getByRole('heading', { name: /^(För vuxna|Hämta ett barn)$/, level: 1 })).toBeVisible();
}

/** In "För vuxna": from the overview to a place's page for the child shown (docs/PLAN-FORALDRAVYN.md). */
export async function parentPlace(page: Page, place: 'Bäcken' | 'Stigen' | 'Trädgården'): Promise<void> {
  await page.locator('.parent-overview .parent-row').filter({ has: page.locator('strong', { hasText: new RegExp(`^${place}$`) }) }).click();
  await expect(page.getByRole('region', { name: new RegExp(`^${place}`) })).toBeVisible();
}

/** In "För vuxna": from the overview to the child's settings. */
export async function parentSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Barnets inställningar/ }).click();
  await expect(page.getByRole('heading', { name: / inställningar$/ })).toBeVisible();
}

/** In "För vuxna": from the overview to "Hämta ett barn" or "Den här enheten". */
export async function parentLink(page: Page, title: 'Hämta ett barn' | 'Den här enheten'): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^${title}`) }).click();
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
}

/** Leaves "För vuxna" for the list of players, from the overview or a page of it. */
export async function closeParent(page: Page): Promise<void> {
  const back = page.locator('.parent-page').getByRole('button', { name: 'Tillbaka' });
  if (await back.isVisible()) await back.click();
  await page.getByRole('button', { name: 'Stäng föräldravyn' }).click();
}

/** In "För vuxna": back from a page to the overview. */
export async function parentBack(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Tillbaka' }).click();
  await expect(page.getByRole('heading', { name: 'För vuxna' })).toBeVisible();
}
