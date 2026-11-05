import { expect, test, type Page } from '@playwright/test';
import { createClockPack } from '../src/content/clock';
import { createProfile, fakeSwedishVoice, openParent, parentLink, passIntro, seedStates, type SeedState } from './helpers';

/** Klocktornet before it is in the valley (docs/PLAN-KLOCKAN.md, KL3): from the clock lab in the test version. */

const pack = createClockPack();
/** What the stand-in voice has said, one utterance each. */
const spoken = (page: Page) => page.evaluate(() => [...(window as unknown as { spoken: string[] }).spoken]);
const ALL_UNITS = pack.units.map((u) => u.id);
/** The answer to a question in words that only one task has (the day, the face, why). */
const prompts = new Map<string, string | null>();
for (const it of pack.items) prompts.set(it.prompt, prompts.has(it.prompt) ? null : it.answer);

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-02-02T16:00:00') });
});

/** To the tower page for Alva, in the test version; with `readAloud`, reading aloud is turned on first. */
async function toTower(page: Page, readAloud = false): Promise<void> {
  await openParent(page);
  if (readAloud) {
    await page.getByRole('button', { name: 'Slå på uppläsning' }).click();
    await expect(page.getByRole('button', { name: 'Slå på uppläsning' })).toHaveCount(0);
  }
  await parentLink(page, 'Den här enheten');
  await page.getByRole('button', { name: 'Prova klockan (bara i testversionen)' }).click();
  await page.getByRole('button', { name: 'Prova tornet med Alva' }).click();
  await expect(page.getByRole('heading', { name: 'Alvas torn' })).toBeVisible();
}

async function newChild(page: Page): Promise<void> {
  await page.goto('/test/');
  await createProfile(page, 'Alva', 'brook');
  await page.goto('/test/');
}

/**
 * Every task sits and rests, except `due` (being learnt, due today) and the
 * parts in `fresh` (not met yet): the session starts with what the test is about.
 */
async function seed(page: Page, due: string[], fresh: string[] = [], unlocked: string[] = ALL_UNITS): Promise<void> {
  const states: Record<string, SeedState> = {};
  for (const it of pack.items) {
    if (fresh.includes(it.unitId)) continue;
    states[it.id] = due.includes(it.id) ? { status: 'learning', box: 1, dueDay: '2026-02-02' } : { status: 'fluent', box: 4, dueDay: '2026-03-30' };
  }
  await seedStates(page, states, { packId: 'clock', unlockedUnitIds: unlocked }, 'mattedalen-test');
}

/** Answers whatever comes (the warm-up first) until `target` shows. */
async function until(page: Page, target: ReturnType<Page['locator']>): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const next = page.getByRole('button', { name: 'Fortsätt' });
    await expect(target.or(page.locator('.intro-card, .choice:not([disabled]), .numpad-key:not([disabled]), .clock-setter')).or(next).first()).toBeVisible();
    if (await target.isVisible()) return;
    if (await next.isVisible()) await next.click();
    else if (await page.locator('.intro-card').isVisible()) await passIntro(page);
    else if (await page.locator('.clock-setter').isVisible()) await page.getByRole('button', { name: 'Svara' }).click();
    else if (await page.locator('.numpad').isVisible()) {
      await page.locator('.numpad-key', { hasText: /^1$/ }).click();
      await page.getByRole('button', { name: 'Svara' }).click();
    } else {
      // The right answer where the words decide it, so new things keep coming; otherwise any.
      const answer = prompts.get((await page.locator('.prompt').getAttribute('data-prompt')) ?? '');
      const right = answer ? page.locator(`.choice[data-value="${answer}"]:not([disabled])`) : null;
      if (right && (await right.count())) await right.click();
      else await page.locator('.choice:not([disabled])').first().click();
    }
  }
  await expect(target).toBeVisible();
}

test('the tower: a window for every part, and what the child is on now', async ({ page }) => {
  await newChild(page);
  await toTower(page);
  await expect(page.locator('.tw-window')).toHaveCount(7);
  await expect(page.locator('.tw-window.lit')).toHaveCount(0);
  await expect(page.locator('.place-now')).toHaveText('Nu: Dagen');
  await expect(page.getByRole('button', { name: 'Gå upp i tornet' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('setting the hands: the arrows and "Svara"', async ({ page }) => {
  await newChild(page);
  await seed(page, ['kl:stall:3:30']);
  await toTower(page);
  await page.getByRole('button', { name: 'Gå upp i tornet' }).click();
  const setter = page.locator('.clock-setter');
  await until(page, page.locator('.prompt', { hasText: /Ställ klockan på (halv fyra|3:30)/ }));
  await expect(page.locator('.prompt')).toHaveText(/Ställ klockan på (halv fyra|3:30)\./);
  await setter.focus();
  // From 12:00, half an hour a step: seven steps to 3:30.
  for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowRight');
  await expect(setter).toHaveAttribute('aria-valuetext', 'Klockan 3:30');
  await page.getByRole('button', { name: 'Svara' }).click();
  await expect(page.locator('.prompt-card.is-right')).toBeVisible();
});

test('a wrong hour hand: the help says which hand, and shows the right time', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await newChild(page);
  await seed(page, ['kl:stall:3:30']);
  await toTower(page);
  await page.getByRole('button', { name: 'Gå upp i tornet' }).click();
  await until(page, page.locator('.prompt', { hasText: /Ställ klockan på (halv fyra|3:30)/ }));
  await page.locator('.clock-setter').focus();
  for (let i = 0; i < 9; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  const card = page.locator('.help-card');
  await expect(card.locator('.confusion-note')).toHaveText('Minutvisaren står rätt. Timvisaren ska stå mellan 3 och 4.');
  // The right time on the face: the hour hand halfway between 3 and 4.
  await expect(card.locator('.clock-hand.hour')).toHaveAttribute('transform', 'rotate(105.00 70 70)');
  await expect(card.locator('.strategy')).toContainText('halv fyra');
});

test('reading the clock: the face is the question, and the number read as minutes gets its line', async ({ page }) => {
  await newChild(page);
  await seed(page, ['kl:dig:3:30']);
  await toTower(page);
  await page.getByRole('button', { name: 'Gå upp i tornet' }).click();
  await until(page, page.locator('.choice[data-value="3:06"]'));
  await expect(page.locator('.prompt-card .clock-view')).toBeVisible();
  // Being learnt: the numbers, but no longer the minutes round the edge.
  await expect(page.locator('.prompt-card .clock-minutes')).toHaveCount(0);
  await page.locator('.choice[data-value="3:06"]').click();
  await expect(page.locator('.help-card .confusion-note')).toHaveText(/^Minutvisaren visar minuter/);
});

test('a new time is shown as a movement, the hour hand going along', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await newChild(page);
  await seed(page, [], ['hel', 'halv', 'kvart', 'femmin'], ['dagen', 'urtavlan', 'timvisaren', 'hel']);
  await toTower(page);
  await page.getByRole('button', { name: 'Gå upp i tornet' }).click();
  const intro = page.locator('.intro-card');
  await until(page, intro.filter({ hasText: 'Ett nytt klockslag' }));
  // 1:00 with reduced motion: the hands stand at the time at once.
  await expect(intro.locator('.clock-hand.minute')).toHaveAttribute('transform', 'rotate(0.00 70 70)');
  await expect(intro.locator('.clock-hand.hour')).toHaveAttribute('transform', 'rotate(30.00 70 70)');
  await expect(intro.locator('.strategy')).toContainText('timvisaren på 1');
});

test('answers in words are read after the question, in the order of the buttons; times are not', async ({ page }) => {
  await fakeSwedishVoice(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await newChild(page);
  await seed(page, ['ur:tim', 'kl:dig:3:30']);
  await toTower(page, true);
  await page.getByRole('button', { name: 'Gå upp i tornet' }).click();
  await until(page, page.locator('.choice[data-value="timvisaren"]'));
  const order = await page.locator('.choice').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.value!));
  await expect.poll(async () => (await spoken(page)).slice(-3)).toEqual(['Vilken visare visar vilken timme det är?', ...order]);
  // The hands on the buttons: the named hand thick, the word under it, and the word as the name.
  await expect(page.locator('.choice[data-value="timvisaren"] .clock-hand.hour.named')).toHaveCount(1);
  await expect(page.locator('.choice[data-value="minutvisaren"] .clock-hand.minute.named')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'minutvisaren' })).toBeVisible();
  // Long words fit a narrow phone.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const b of await page.locator('.choice').all()) {
    const box = (await b.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(320);
  }
  // "Läs upp igen": the question and the answers once more.
  const before = (await spoken(page)).length;
  await page.getByRole('button', { name: 'Läs upp igen' }).click();
  await expect.poll(async () => (await spoken(page)).slice(before)).toEqual(['Vilken visare visar vilken timme det är?', ...order]);
  await page.getByRole('button', { name: 'timvisaren' }).click();
  // A question with times to choose: only the question is read.
  await until(page, page.locator('.choice[data-value="3:06"]'));
  await expect.poll(async () => (await spoken(page)).at(-1)).toBe('Vilken digital tid visar klockan?');
  await page.waitForTimeout(200);
  expect((await spoken(page)).filter((t) => /^\d+:\d\d$/.test(t))).toEqual([]);
});

test('the day has drawings on its answers', async ({ page }) => {
  await newChild(page);
  await seed(page, ['day:forst1']);
  await toTower(page);
  await page.getByRole('button', { name: 'Gå upp i tornet' }).click();
  await until(page, page.locator('.choice[data-value="frukost"]'));
  await expect(page.locator('.choice[data-value="frukost"] .day-icon')).toHaveCount(1);
  await expect(page.locator('.choice[data-value="middag"] .day-icon')).toHaveCount(1);
});

