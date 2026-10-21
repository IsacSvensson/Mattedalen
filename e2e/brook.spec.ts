import { expect, test, type Page } from '@playwright/test';
import { createAdditionPack } from '../src/content/addition';
import { answerDerive, createProfile, nextStep, seedStates, type SeedState } from './helpers';

/** Bäcken: addition and subtraction within 20, and the equal sign (Vågen). */

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-02-02T16:00:00') });
  await page.goto('/');
});

/** From the garden a new child lands in after creating a profile, to the brook. */
async function toBrook(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await page.getByRole('button', { name: /^Bäcken\./ }).click();
}

/** The value of one side: "7 + 5", "13 − 8" or "6". */
function sideValue(side: string): number {
  const [first, ...rest] = side.match(/\d+|[+−]/g)!;
  let value = Number(first);
  for (let i = 0; i < rest.length; i += 2) value += (rest[i] === '+' ? 1 : -1) * Number(rest[i + 1]);
  return value;
}

/**
 * The right answer to a prompt as shown, where "?" is the blank:
 * "8 + 5 = ?", "? = 8 + 5", "5 + ? = 13", "7 + 5 = ? + 8", or a statement
 * ("3 + 4 = 4 + 3") that is either true ("ja") or not ("nej").
 */
function solve(prompt: string): string {
  const [left, right] = prompt.split('=').map((x) => x.trim()) as [string, string];
  if (!prompt.includes('?')) return sideValue(left) === sideValue(right) ? 'ja' : 'nej';
  const [withBlank, other] = left.includes('?') ? [left, right] : [right, left];
  const target = sideValue(other);
  if (withBlank === '?') return String(target);
  // "5 + ?" or "? + 8": the blank is what is missing from the target.
  const known = sideValue(withBlank.replace('?', '0'));
  const minus = /−\s*\?/.test(withBlank);
  return String(minus ? known - target : target - known);
}

async function typeOnPad(page: Page, value: string): Promise<void> {
  for (const d of value) await page.locator('.numpad-key', { hasText: new RegExp(`^${d}$`) }).click();
  await page.getByRole('button', { name: 'Svara' }).click();
}

/** Answers the next step at the brook (intro, derivation path or question). Returns the prompt. */
async function answerBrook(page: Page, correct = true): Promise<string> {
  await expect(nextStep(page).or(page.locator('.question.derive'))).toBeVisible();
  if (await page.locator('.intro-card').isVisible()) {
    await page.getByRole('button', { name: 'Nu du!' }).click();
    await expect(nextStep(page).or(page.locator('.question.derive'))).toBeVisible();
  }
  if (await page.locator('.question.derive').isVisible()) {
    // The path shows where to start, never the hops: they would give the answer away.
    await expect(page.locator('.derive-card .nl-hop')).toHaveCount(0);
    return answerDerive(page, correct);
  }
  const prompt = (await page.locator('.question .prompt').textContent())!.trim();
  const right = solve(prompt);
  if (await page.locator('.numpad').isVisible()) {
    await typeOnPad(page, correct ? right : String(Number(right) + 1));
  } else {
    const values = await page.locator('.choice:not([disabled])').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.value!));
    const pick = correct ? right : values.find((v) => v !== right)!;
    await page.locator(`.choice[data-value="${pick}"]`).click();
  }
  return prompt;
}

const fluentDue = (dueDay: string): SeedState => ({ status: 'fluent', box: 3, dueDay });

/** Every family of a + b: both orders and both subtractions. */
function family(a: number, b: number, state: SeedState, into: Record<string, SeedState>): void {
  for (const id of [`${a}+${b}`, `${b}+${a}`, `${a + b}-${a}`, `${a + b}-${b}`]) into[id] = { ...state };
}

/** A child who knows the easy parts, with nothing due today unless given. */
function knowsTheEasyParts(): Record<string, SeedState> {
  const later = fluentDue('2026-03-01');
  const states: Record<string, SeedState> = {};
  for (let n = 0; n <= 10; n++) family(0, n, later, states);
  for (let n = 1; n <= 10; n++) family(1, n, later, states);
  for (let n = 2; n <= 10; n++) family(n, 10, later, states);
  family(2, 3, later, states);
  return states;
}

test('the first visit offers the start check once; from the beginning, two parts of the bridge are open', async ({ page }) => {
  await createProfile(page, 'Alva');
  await toBrook(page);
  await expect(page.getByRole('heading', { name: 'Vill du visa vad du redan kan?' })).toBeVisible();
  await page.getByRole('button', { name: 'Börja från början' }).click();

  await expect(page.getByRole('heading', { name: 'Alvas bäck' })).toBeVisible();
  // What the child is on now, without counts on the child's page.
  await expect(page.locator('.place-now')).toHaveText('Nu: Ett mer, ett mindre');
  await expect(page.locator('.garden-side')).not.toContainText(/\d+ av \d+/);
  // One outlined place in the bridge per open part, nothing laid yet.
  await expect(page.locator('.brook-bridge .br-slot')).toHaveCount(2);
  await expect(page.locator('.brook-bridge .br-slot.laid')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Hoppa på stenarna' })).toBeVisible();

  // Back in the valley and to the brook again: the check is not offered twice.
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await expect(page.getByRole('button', { name: 'Bäcken. Nya stenar väntar vid bäcken.' })).toBeVisible();
  await page.getByRole('button', { name: /^Bäcken\./ }).click();
  await expect(page.getByRole('heading', { name: 'Alvas bäck' })).toBeVisible();
});

test('the start check lays what the child already knows into the bridge', async ({ page }) => {
  await createProfile(page, 'Bo');
  await toBrook(page);
  await page.getByRole('button', { name: 'Ja!' }).click();
  // Free answers, no marks and no clock; every answer right.
  const done = page.getByRole('button', { name: 'Till bäcken' });
  for (let i = 0; i < 80 && !(await done.isVisible()); i++) {
    await expect(page.locator('.numpad-key:not([disabled])').first().or(done)).toBeVisible();
    if (await done.isVisible()) break;
    const prompt = (await page.locator('.prompt').textContent())!.trim();
    expect(prompt).toMatch(/^\d+ [+−] \d+ = \?$/);
    await typeOnPad(page, solve(prompt));
  }
  await expect(page.getByText(/^Du kan redan .*ett mer, ett mindre.*noll/)).toBeVisible();
  await done.click();
  await expect(page.getByRole('heading', { name: 'Bos bäck' })).toBeVisible();
  await expect(page.locator('.place-now')).not.toHaveText('Nu: Ett mer, ett mindre');
  expect(await page.locator('.brook-bridge .br-slot.laid').count()).toBeGreaterThanOrEqual(2);
});

test('a session: a new stone hops to its landing points, then a question, and help after a wrong answer', async ({ page }) => {
  await createProfile(page, 'Alva');
  await toBrook(page);
  await page.getByRole('button', { name: 'Börja från början' }).click();
  await page.getByRole('button', { name: 'Hoppa på stenarna' }).click();

  // A new fact: the stones with the hops between the landing points, then the child's turn.
  const intro = page.locator('.intro-card');
  await expect(intro.getByText('En ny sten')).toBeVisible();
  await expect(intro.locator('.number-line .nl-hop').first()).toBeAttached();
  expect(await intro.locator('.nl-stone.landing').count()).toBeGreaterThanOrEqual(2);
  await page.getByRole('button', { name: 'Nu du!' }).click();

  // At the brook the keys and answers are smooth stones, not the garden's wood.
  await expect(page.locator('.screen.session.keys-stone')).toBeVisible();

  // While the fact is new, the stones stay beside the question, showing only where to start.
  await expect(page.locator('.question .number-line')).toBeVisible();
  await expect(page.locator('.question .nl-hop')).toHaveCount(0);
  await expect(page.locator('.question .nl-stone.start')).toHaveCount(1);
  await answerBrook(page);
  await expect(page.locator('.prompt-card.is-right')).toBeVisible();

  // A wrong answer: what the child said, the right answer and the stones, never "fel". What the
  // child said stands once: in "Du svarade …", or first in the word about it (docs/PLAN-ENKLARE.md, E3).
  await answerBrook(page, false);
  const said = page.locator('.help-card .you-said');
  const note = page.locator('.help-card .confusion-note');
  await expect(said.or(note).first()).toBeVisible();
  if (await note.isVisible()) {
    const given = /^(\d+) /.exec((await note.textContent()) ?? '')?.[1];
    await expect(said).toHaveCount(given ? 0 : 1);
  } else await expect(said).toContainText('Du svarade');
  await expect(page.locator('.help-card .help-answer')).toHaveText(/^\d+ [+−] \d+ = \d+$|=/);
  await expect(page.locator('.help-card .number-line')).toBeVisible();
  await expect(page.getByText(/^fel$/i)).toHaveCount(0);
  await page.getByRole('button', { name: 'Fortsätt' }).click();
  await expect(nextStep(page).or(page.locator('.question.derive'))).toBeVisible();
});

test('Vågen: a blank on either side, and true or false answered with Ja and Nej', async ({ page }) => {
  await createProfile(page, 'Alva');
  const states = knowsTheEasyParts();
  family(2, 8, fluentDue('2026-03-01'), states);
  family(3, 7, fluentDue('2026-03-01'), states);
  family(4, 6, fluentDue('2026-03-01'), states);
  family(5, 5, fluentDue('2026-03-01'), states);
  for (const id of ['eq:6=6', 'eq:5=2+3', 'eq:7+5=_+8', 'eq:5+3=4+_', 'eq:3+4=4+3', 'eq:9=4+4'])
    states[id] = { status: 'learning', box: 1, dueDay: '2026-02-02' };
  await seedStates(page, states, { packId: 'addition', unlockedUnitIds: ['ettmer', 'noll', 'sma', 'tio', 'tiokamrater', 'dubblor', 'vagen'] });
  await page.locator('.profile-tile', { hasText: 'Alva' }).click();
  await page.getByRole('button', { name: /^Bäcken\./ }).click();
  await page.getByRole('button', { name: 'Hoppa på stenarna' }).click();

  let balance = false;
  let truefalse = false;
  for (let i = 0; i < 30 && !(balance && truefalse); i++) {
    await expect(nextStep(page).or(page.locator('.question.derive'))).toBeVisible();
    const label = page.locator('.question .ask-label');
    if (await label.isVisible()) {
      // The scale stands beside every equality.
      await expect(page.locator('.question .balance-svg')).toBeVisible();
      if ((await label.textContent()) === 'Stämmer det?') {
        truefalse = true;
        await expect(page.locator('.choice')).toHaveText(['Ja', 'Nej']);
      } else {
        balance = true;
        await expect(label).toHaveText('Vad ska stå i rutan?');
        await expect(page.locator('.question .prompt .blank')).toBeVisible();
      }
    }
    const hadBlank = await page.locator('.question .prompt .blank').isVisible();
    await answerBrook(page);
    // After a right answer the blank is filled in.
    if (hadBlank) await expect(page.locator('.prompt-card.is-right .blank.filled')).toBeVisible();
  }
  expect(balance).toBe(true);
  expect(truefalse).toBe(true);
});

test('two-digit answers are timed to the first digit', async ({ page }) => {
  await createProfile(page, 'Alva');
  const states = knowsTheEasyParts();
  // The ten-and-some facts are due today, and fluent: answered on the number pad.
  for (let n = 2; n <= 9; n++) family(n, 10, fluentDue('2026-02-02'), states);
  await seedStates(page, states, { packId: 'addition', unlockedUnitIds: ['ettmer', 'noll', 'sma', 'tio'] });
  await page.locator('.profile-tile', { hasText: 'Alva' }).click();
  await page.getByRole('button', { name: /^Bäcken\./ }).click();
  await page.getByRole('button', { name: 'Hoppa på stenarna' }).click();

  for (let i = 0; i < 20; i++) {
    await expect(nextStep(page).or(page.locator('.question.derive'))).toBeVisible();
    const pad = page.locator('.question.free:not(.derive) .numpad');
    const prompt = (await page.locator('.question .prompt').textContent({ timeout: 1000 }).catch(() => '')) ?? '';
    const right = prompt ? solve(prompt.trim()) : '';
    if (!(await pad.isVisible()) || right.length < 2) {
      await answerBrook(page);
      continue;
    }
    // The first digit comes at once; the second after a slow search on the pad.
    await page.locator('.numpad-key', { hasText: new RegExp(`^${right[0]}$`) }).click();
    await page.clock.runFor(5000);
    await page.locator('.numpad-key', { hasText: new RegExp(`^${right[1]}$`) }).click();
    await page.getByRole('button', { name: 'Svara' }).click();
    const rt = await page.evaluate(async () => {
      const db: IDBDatabase = await new Promise((r) => {
        const q = indexedDB.open('mattedalen');
        q.onsuccess = () => r(q.result);
      });
      const all: { ts: number; rtMs: number }[] = await new Promise((r) => {
        const q = db.transaction('attempts').objectStore('attempts').getAll();
        q.onsuccess = () => r(q.result);
      });
      db.close();
      return all.sort((a, b) => a.ts - b.ts).at(-1)!.rtMs;
    });
    expect(rt).toBeLessThan(5000);
    return;
  }
  throw new Error('no two-digit question on the number pad');
});

for (const [name, viewport] of [
  ['320 px wide', { width: 320, height: 640 }],
  ['a phone on its side', { width: 800, height: 360 }],
] as const) {
  test(`the brook and its questions fit: ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await createProfile(page, 'Alexandra-Charlotte');
    await toBrook(page);
    await page.getByRole('button', { name: 'Börja från början' }).click();
    await expect(page.locator('.brook-bridge')).toBeVisible();
    await expectNoSidewaysScroll(page);
    await page.getByRole('button', { name: 'Hoppa på stenarna' }).click();
    await expect(page.locator('.intro-card .number-line')).toBeVisible();
    await expectNoSidewaysScroll(page);
    await page.getByRole('button', { name: 'Nu du!' }).click();
    await expect(page.locator('.question .number-line')).toBeVisible();
    // On a narrow screen only a window of the stones is shown, around the hops.
    if (viewport.width <= 560) expect(await page.locator('.question .nl-stone').count()).toBeLessThanOrEqual(11);
    await expectNoSidewaysScroll(page);
    // The answers are on screen without scrolling.
    const last = (await page.locator('.choice').last().boundingBox())!;
    expect(last.y + last.height).toBeLessThanOrEqual(viewport.height);
  });
}

async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const width = page.viewportSize()!.width;
  const content = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(content).toBeLessThanOrEqual(width);
}

test('the number pad at the brook takes two digits: no answer here is larger than 20 (docs/PLAN-MINUSTECKNET.md)', async ({ page }) => {
  await createProfile(page, 'Bo');
  await toBrook(page);
  await page.getByRole('button', { name: 'Ja!' }).click();
  for (const d of '695') await page.locator('.numpad-key', { hasText: new RegExp(`^${d}$`) }).click();
  await expect(page.locator('.numpad-display')).toHaveText('69');
});

test('the first minus fact comes after its plus, with a card that shows minus as taking away (docs/PLAN-PLUSFORST.md)', async ({ page }) => {
  await createProfile(page, 'Alva');
  await toBrook(page);
  await page.getByRole('button', { name: 'Börja från början' }).click();
  // Every plus fact of "Ett mer, ett mindre" sits; none of its minus facts has started.
  const plus = createAdditionPack().items.filter((i) => i.unitId === 'ettmer' && i.id.includes('+'));
  await seedStates(page, Object.fromEntries(plus.map((i) => [i.id, { status: 'fluent', box: 3, dueDay: '2026-02-09' }])), { packId: 'addition', unlockedUnitIds: ['ettmer', 'noll'] });
  await page.locator('.profile-tile', { hasText: 'Alva' }).click();
  await page.getByRole('button', { name: /^Bäcken\./ }).click();
  await page.getByRole('button', { name: 'Hoppa på stenarna' }).click();

  const intro = page.locator('.intro-card');
  for (let i = 0; i < 20; i++) {
    await expect(nextStep(page).or(intro)).toBeVisible();
    if (await intro.isVisible()) break;
    await answerBrook(page);
  }
  await expect(intro.getByText('Nytt: minus')).toBeVisible();
  const [x, y] = (await intro.locator('.intro-answer').textContent())!.match(/\d+/g)!.map(Number);
  await expect(intro.locator('.take-away .ta-stone')).toHaveCount(x!);
  await expect(intro.locator('.take-away .ta-stone.gone')).toHaveCount(y!);
  await expect(intro.locator('.strategy')).toHaveText(new RegExp(`^Minus betyder att ta bort: ${x}, ta bort ${y}\\. Kvar är ${x! - y!}\\.$`));
  // Then the question itself, answered like any other.
  await answerBrook(page);
  await expect(page.locator('.prompt-card.is-right')).toBeVisible();
});
