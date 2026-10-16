import { expect, test, type Page } from '@playwright/test';
import { answer, answerDerive, createProfile, nextStep, openParent, openPath, playedAt, seedStates, solve, type SeedState } from './helpers';

/**
 * Stigen, the numbers to 100 (docs/STIGEN.md): it opens when going over the
 * ten sits at the brook, or when a grown-up opens it.
 */
test.setTimeout(60_000);
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-02-02T16:00:00') });
});

const fluent: SeedState = { status: 'fluent', box: 3, dueDay: '2026-02-09' };
const all = (ids: string[], s: SeedState = fluent) => Object.fromEntries(ids.map((id) => [id, s]));

const WHOLE_TENS = [
  ...[3, 5, 7, 4, 9, 10].map((n) => `tens:${n}`),
  ...[20, 60, 40, 80, 100, 30].map((n) => `count:${n}`),
  ...['20+20', '30+20', '40+30', '50+20', '30+30', '60+40', '40+40', '70+20', '50+50', '60+30'],
  ...['50-20', '40-20', '70-30', '90-20', '80-50', '60-30', '100-40', '100-70'],
];

/** A child at the brook, with Stigen opened by a grown-up. */
async function newChild(page: Page, name: string): Promise<void> {
  await page.goto('/');
  await createProfile(page, name, 'brook');
  await page.getByRole('button', { name: 'Börja från början' }).click();
  await expect(page.getByRole('heading', { name: `${name}s bäck` })).toBeVisible();
  await openPath(page, name);
}

async function toPath(page: Page, states: Record<string, SeedState>, unlockedUnitIds: string[]): Promise<void> {
  await seedStates(page, states, { packId: 'hundred', unlockedUnitIds });
  await page.goto('/');
  await page.locator('.profile-tile').first().click();
  await page.getByRole('button', { name: /^Stigen\./ }).click();
  // The start check is offered the first time; these children start from the beginning.
  const offer = page.getByRole('heading', { name: 'Kan du redan talen till 100?' });
  await expect(offer.or(page.locator('.path-trail'))).toBeVisible();
  if (await offer.isVisible()) await page.getByRole('button', { name: 'Börja från början' }).click();
  await expect(page.locator('.path-trail')).toBeVisible();
}

/** Answers questions until `stop` is visible, at most `max` questions. */
async function playUntil(page: Page, stop: ReturnType<Page['locator']>, max = 40): Promise<void> {
  for (let i = 0; i < max; i++) {
    await expect(nextStep(page)).toBeVisible();
    if (await stop.isVisible()) return;
    await answer(page);
  }
  await expect(stop).toBeVisible();
}

test('Stigen rests on the map until going over the ten sits at the brook, or a grown-up opens it', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'Bo', 'brook');
  await page.getByRole('button', { name: 'Börja från början' }).click();
  await page.getByRole('button', { name: 'Till dalen' }).click();
  const path = page.getByRole('button', { name: 'Stigen. Stigen öppnar när du kan gå över tiotalet vid bäcken.' });
  await expect(path).toBeDisabled();
  await page.getByRole('button', { name: 'Byt spelare' }).click();
  await openParent(page);
  const section = page.getByRole('region', { name: /^Stigen/ });
  await section.getByRole('button', { name: 'Öppna Stigen nu' }).click();
  await expect(section).toContainText('Stigen är öppen.');
  await page.getByRole('button', { name: /Tillbaka|Stäng/ }).first().click();
  await page.locator('.profile-tile', { hasText: 'Bo' }).click();
  await page.getByRole('button', { name: 'Stigen. Nya lyktor väntar på stigen.' }).click();
  await expect(page.getByRole('heading', { name: 'Kan du redan talen till 100?' })).toBeVisible();
});

test('the start check takes a child who knows the numbers to 100 along the path', async ({ page }) => {
  await newChild(page, 'Ada');
  await page.locator('.profile-tile').first().click();
  await page.getByRole('button', { name: /^Stigen\./ }).click();
  await page.getByRole('button', { name: 'Gör startkollen' }).click();
  // Every answer right (as written, with its blank), on the stones of the number pad.
  const done = page.getByRole('heading', { name: 'Bra jobbat!' });
  for (let i = 0; i < 60; i++) {
    await expect(done.or(page.locator('.numpad-key:not([disabled])').first())).toBeVisible();
    if (await done.isVisible()) break;
    const prompt = (await page.locator('.placement-run .prompt').getAttribute('data-prompt'))!;
    for (const d of String(solve(prompt))) await page.locator('.numpad-key', { hasText: new RegExp(`^${d}$`) }).click();
    await page.getByRole('button', { name: 'Svara' }).click();
  }
  await expect(done).toBeVisible();
  await expect(page.locator('.placement-summary')).toContainText('hela tiotal');
  await page.getByRole('button', { name: 'Till stigen' }).click();
  await expect(page.locator('.trail.large .tr-glass.lit').first()).toBeVisible();
});

test('Stigens koll comes on the second day on the path, and grown-ups see the result', async ({ page }) => {
  await newChild(page, 'Eja');
  await playedAt(page, 'hundred', '2026-02-01');
  await toPath(page, all(WHOLE_TENS), ['tiotal', 'tiental']);
  await page.getByRole('button', { name: 'Gå på stigen' }).click();
  await expect(page.getByRole('heading', { name: 'Stigens koll' })).toBeVisible();
  await page.getByRole('button', { name: 'Börja kollen' }).click();
  let n = 0;
  const thanks = page.getByRole('heading', { name: 'Tack!' });
  for (;;) {
    await expect(thanks.or(page.locator('.numpad-key:not([disabled])').first())).toBeVisible();
    if (await thanks.isVisible()) break;
    const prompt = (await page.locator('.question.check .prompt').getAttribute('data-prompt'))!;
    for (const d of String(solve(prompt))) await page.locator('.numpad-key', { hasText: new RegExp(`^${d}$`) }).click();
    await page.getByRole('button', { name: 'Svara' }).click();
    n++;
  }
  expect(n).toBe(14);
  await page.getByRole('button', { name: 'Till stigen' }).click();
  await expect(page.locator('.intro-card').or(page.locator('.question'))).toBeVisible();
  await page.getByRole('button', { name: 'Tillbaka till stigen' }).click();
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await page.getByRole('button', { name: 'Byt spelare' }).click();
  await openParent(page);
  const row = page.getByRole('region', { name: /^Stigen/ }).locator('.check-results tbody tr');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('3 av 3');
});

test('the path has a post at every ten and a lantern for each part, lit when it sits', async ({ page }) => {
  await newChild(page, 'Cia');
  await toPath(page, all([...WHOLE_TENS, 'te:63', 'te:47']), ['tiotal', 'tiental']);
  await expect(page.getByRole('heading', { name: 'Cias stig' })).toBeVisible();
  await expect(page.locator('.tr-number')).toHaveText(['10', '20', '30', '40', '50', '60', '70', '80', '90', '100']);
  // Two parts open: two lanterns, the first lit; the rest only hooks.
  await expect(page.locator('.trail.large .tr-glass')).toHaveCount(2);
  await expect(page.locator('.trail.large .tr-glass.lit')).toHaveCount(1);
  await expect(page.locator('.trail.large .tr-hook')).toHaveCount(6);
  await expect(page.locator('.path .sr-only')).toContainText('På stigen lyser 1 av 8 lyktor. Du är vid lyktan för tiotal och ental.');
  await expect(page.locator('.place-now')).toHaveText('Nu: Tiotal och ental');
  await expect(page.locator('.garden-side')).not.toContainText(/\d+ av \d+/);
  // Back to the valley: the small path on the map has one light.
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await expect(page.locator('.place-path .tr-glass.lit')).toHaveCount(1);
});

test('a new child builds whole tens with rods first, then answers', async ({ page }) => {
  await newChild(page, 'Dan');
  await toPath(page, {}, ['tiotal']);
  await page.getByRole('button', { name: 'Gå på stigen' }).click();
  const builder = page.locator('.intro-card .b10-builder');
  await expect(builder).toBeVisible();
  await expect(page.locator('.intro-card .intro-label')).toContainText('Hela tiotal');
  await expect(builder.locator('.b10-instruction')).toHaveText('Bygg 3 tiotal.');
  const addTen = page.getByRole('button', { name: 'Lägg till ett tiotal' });
  await addTen.click();
  await addTen.click();
  await page.getByRole('button', { name: 'Lägg till ett ental' }).click();
  await expect(builder.locator('.b10-board')).toHaveAccessibleName('2 tiotal och 1 ental');
  await page.getByRole('button', { name: 'Ta bort ett ental' }).click();
  await addTen.click();
  await expect(builder.locator('.b10-status')).toHaveText('3 tiotal och 0 ental är 30!');
  // Built: nothing more to add or change.
  await expect(addTen).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Byt 10 ental mot 1 tiotal' })).toBeHidden();
  await expect(page.locator('.intro-card .intro-answer')).toHaveText('3 tiotal = 30');
  await page.getByRole('button', { name: 'Nu du!' }).click();
  await expect(page.locator('.question .prompt')).toHaveAttribute('data-prompt', '3 tiotal = __');
  await answer(page);
  await expect(page.locator('.feedback, .numpad-display.correct, .choice.correct').first()).toBeVisible();
});

test('tens and ones: rods dragged to the board, and ten ones changed for a ten', async ({ page }) => {
  await newChild(page, 'Eli');
  await toPath(page, all(WHOLE_TENS), ['tiotal', 'tiental']);
  await page.getByRole('button', { name: 'Gå på stigen' }).click();
  const builder = page.locator('.intro-card .b10-builder');
  await playUntil(page, builder);
  await expect(page.locator('.intro-card .intro-label')).toContainText('Tiotal och ental');
  await expect(builder.locator('.b10-instruction')).toHaveText('Bygg 6 tiotal och 3 ental.');
  // Drag a rod from its button to the board.
  const from = (await page.getByRole('button', { name: 'Lägg till ett tiotal' }).boundingBox())!;
  const to = (await builder.locator('.b10-board').boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(builder.locator('.b10-board')).toHaveAccessibleName('1 tiotal och 0 ental');
  // Thirteen ones: ten of them can be changed for a ten.
  const addOne = page.getByRole('button', { name: 'Lägg till ett ental' });
  for (let i = 0; i < 13; i++) await addOne.click();
  await page.getByRole('button', { name: 'Byt 10 ental mot 1 tiotal' }).click();
  await expect(builder.locator('.b10-board')).toHaveAccessibleName('2 tiotal och 3 ental');
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Lägg till ett tiotal' }).click();
  await expect(builder.locator('.b10-status')).toHaveText('6 tiotal och 3 ental är 63!');
  await page.getByRole('button', { name: 'Nu du!' }).click();
  await answer(page);
});

const UP_TO_THE_BRIDGE = all([
  ...WHOLE_TENS,
  ...['te:63', 'te:47', 'te:25', 'te:81', 'te:39', 'te:50', 'te:74', 'te:18', 'te:92', 'te:47:t', 'te:85:t', 'te:36:t', 'te:60:t', 'te:52:e', 'te:93:e', 'te:70:e', 'te:28:e', 'te:47:byt', 'te:92:byt', 'te:36:byt'],
]);

/** Every task of "Ental utan att gå över" and "Till nästa tiotal". */
const ONES = [
  ...['20+4', '30+5', '30+6', '40+8', '70+3', '12+6', '15+3', '21+7', '24+4', '42+7', '34+5', '53+4', '61+8', '82+5', '76+3'],
  ...['27-3', '36-4', '47-3', '58-5', '69-7', '85-2'],
  ...['54-4', '63-3', '72-2', '81-1', '52-2', '43-3', '31-1', '65-5', '94-4', '26-6'],
];
const TO_THE_TEN = [
  ...[18, 14, 16, 24, 27, 36, 35, 48, 45, 54, 47, 29, 56, 73, 85, 67, 37, 25, 61, 95].map((n) => `next:${n}`),
  ...['30-3', '40-4', '50-5', '60-6', '70-7', '80-8', '90-9', '60-4', '50-2', '100-6', '40-7', '20-7'],
];

test('a calculation is shown as hops on the empty number line, via the ten', async ({ page }) => {
  await newChild(page, 'Fia');
  // Everything before the bridge over the ten sits; the bridge is open.
  await toPath(page, { ...UP_TO_THE_BRIDGE, ...all(ONES), ...all(TO_THE_TEN) }, ['tiotal', 'tiental', 'ental', 'tilltio', 'overtio']);
  await page.getByRole('button', { name: 'Gå på stigen' }).click();
  const line = page.locator('.intro-card .empty-line');
  await playUntil(page, line);
  await expect(page.locator('.intro-card .intro-label')).toContainText('Nytt på stigen');
  await expect(page.locator('.intro-card .intro-answer')).toHaveText('18 + 6 = 24');
  // 18 → 20 → 24: +2 and +4, with only the tens marked.
  await expect(line.locator('.nl-hop-label')).toHaveText(['+2', '+4']);
  await expect(line.locator('.el-stop-label')).toHaveText(['18', '20', '24']);
  await page.getByRole('button', { name: 'Nu du!' }).click();
  // A wrong answer: the help card has the hops and the way to think.
  await answer(page, false);
  await expect(page.locator('.help-card .empty-line')).toBeVisible();
  await expect(page.locator('.help-card')).toContainText('18 + 6 = 18 + 2 + 4 = 20 + 4 = 24.');
});

test('a hard task over the ten is walked via the ten, then asked again', async ({ page }) => {
  await newChild(page, 'Gry');
  await toPath(
    page,
    {
      ...UP_TO_THE_BRIDGE,
      'next:47': fluent,
      '52-2': fluent,
      '47+8': { status: 'learning', box: 1, dueDay: '2026-02-02', wrongDays: 2, introducedDay: '2026-01-28' },
    },
    ['tiotal', 'tiental', 'ental', 'tilltio', 'overtio'],
  );
  await page.getByRole('button', { name: 'Gå på stigen' }).click();
  await playUntil(page, page.locator('.question.derive'));
  await expect(page.locator('.derive-step.current .derive-prompt')).toHaveText('47 + 3');
  await expect(page.locator('.derive-step.current .derive-label')).toHaveText('Upp till tiotalet');
  await expect(page.locator('.question.derive .empty-line')).toBeVisible();
  expect(await answerDerive(page)).toBe('47+8');
  await expect(page.locator('.numpad-display.correct')).toBeVisible();
});

test('grown-ups see the parts, what is hard and the mix-ups', async ({ page }) => {
  await newChild(page, 'Hugo');
  await seedStates(
    page,
    {
      ...UP_TO_THE_BRIDGE,
      '52-6': { status: 'learning', box: 1, wrongDays: 3, lastWrongDay: '2026-02-01', confusions: { '54': 3 } },
    },
    { packId: 'hundred', unlockedUnitIds: ['tiotal', 'tiental', 'ental', 'tilltio', 'overtio'] },
  );
  await page.goto('/');
  await openParent(page);
  const section = page.locator('.place-section', { has: page.getByRole('heading', { name: 'Stigen' }) });
  await expect(section).toContainText('Hela tiotal30 av 30 sitter');
  await expect(section).toContainText('Tiotal och ental (förståelse)20 av 22 sitter');
  await expect(section).toContainText('Tvåsiffrigt plus tvåsiffrigtinte öppen än');
  await expect(section.locator('.hard-list')).toContainText('52 − 6 = 46 – 52 − 6 = 52 − 2 − 4 = 50 − 4 = 46.');
  await expect(section.locator('.confusions')).toContainText('52 − 6 – svarade 54 (3 gånger)');
});
