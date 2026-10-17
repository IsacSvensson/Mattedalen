import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { answer, createProfile, enterGarden, openParent, parentBack, parentLink, parentPlace, parentSettings, passIntro, seedStates, switchPlayer, untilIntro } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-02-02T16:00:00') });
  await page.goto('/');
});

test('the parent view is behind a PIN', async ({ page }) => {
  await createProfile(page, 'Alva');
  await switchPlayer(page);
  await openParent(page, '1357');
  await page.getByRole('button', { name: 'Stäng föräldravyn' }).click();

  await page.getByRole('button', { name: /För vuxna|föräldravyn/ }).click();
  await expect(page.getByRole('heading', { name: /Vuxenkod/ })).toBeVisible();
  await page.keyboard.type('0000');
  await expect(page.getByText('Fel kod. Försök igen.')).toBeVisible();
  await page.keyboard.type('1357');
  await expect(page.getByRole('heading', { name: 'För vuxna' })).toBeVisible();
});

test('shows heatmap, confusions and practised minutes; settings can be changed', async ({ page }) => {
  await createProfile(page, 'Alva', 'garden-times');
  await page.getByRole('button', { name: 'Vattna trädgården' }).click();
  await untilIntro(page);
  await answer(page);
  await answer(page, false);
  await page.getByRole('button', { name: 'Fortsätt' }).click();
  await page.clock.fastForward('12:00');
  await answer(page);
  await page.getByRole('button', { name: 'Till trädgården' }).click();
  await switchPlayer(page);
  await openParent(page);

  // The overview: the week, and a row per place that leads to its page.
  await expect(page.getByText(/Senaste 7 dagarna: 1[23] minuter, 1 dag med spel\./)).toBeVisible();
  await expect(page.locator('.parent-overview .parent-row strong')).toHaveText(['Bäcken', 'Stigen', 'Trädgården', 'Barnets inställningar', 'Hämta ett barn', 'Den här enheten', 'Tyck till']);
  await parentPlace(page, 'Trädgården');
  const garden = page.getByRole('region', { name: /^Trädgården/ });
  await expect(garden.getByRole('heading', { name: 'Trädgården', exact: true })).toBeVisible();
  // The same order on every place: the state, what is hard and the mix-ups, the check, all facts, the start check.
  await expect(garden.getByRole('heading', { level: 3 })).toHaveText(['Läget', 'Svåra just nu', 'Vanligaste förväxlingarna', 'Trädgårdens koll', 'Startkoll']);
  await expect(page.locator('.confusions li')).toHaveCount(1);
  await expect(page.locator('.confusions li')).toContainText('svarade');
  await expect(garden.getByRole('button', { name: 'Gör om startkollen' })).toBeVisible();
  // The settings are not here but on the child's settings page.
  await expect(garden.getByRole('checkbox')).toHaveCount(0);
  await expect(garden.getByRole('combobox', { name: 'Passlängd' })).toHaveCount(0);
  // All facts, folded: one heat map for the multiplications and one for delat med.
  await expect(garden.locator('.heat-cell.heat-learning-0').first()).toBeHidden();
  await garden.getByText('Alla fakta (värmekartor)').click();
  await expect(garden.getByRole('group', { name: 'Värmekarta över gångertabellen' }).locator('.heat-cell')).toHaveCount(100);
  await expect(garden.getByRole('group', { name: 'Värmekarta över delat med' }).locator('.heat-cell')).toHaveCount(100);
  await garden.locator('.heat-cell.heat-learning-0').first().click();
  await expect(garden.locator('.heat-detail').first()).toContainText('försök');
  await parentBack(page);

  // How to bring a child from Gångerträdgården; nothing came along on this device.
  await parentLink(page, 'Hämta ett barn');
  await expect(page.getByRole('heading', { name: 'Från Gångerträdgården' })).toBeVisible();
  await expect(page.getByText(/hämtades från Gångerträdgården/)).toHaveCount(0);
  await parentBack(page);
  await parentLink(page, 'Den här enheten');
  await expect(page.getByRole('heading', { name: 'Integritet' })).toBeVisible();
  await expect(page.locator('.privacy')).toContainText('inga cookies');
  await parentBack(page);

  // The child's settings, every place's on the same page.
  await parentSettings(page);
  await expect(page.getByRole('region', { name: 'Trädgården' }).getByRole('checkbox', { name: /Fritt svar/ })).toBeChecked();
  await page.getByRole('combobox', { name: 'Passlängd' }).selectOption('15');
  await expect(page.getByRole('combobox', { name: 'Passlängd' })).toHaveValue('15');
  await page.getByRole('textbox', { name: 'Namn' }).fill('Alva-Li');
  await page.getByRole('button', { name: 'Spara', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Alva-Lis inställningar' })).toBeVisible();
  await parentBack(page);
  await expect(page.getByRole('button', { name: 'Alva-Li', exact: true })).toBeVisible();
});

test('a JSON backup restores everything on another device', async ({ page, browser }) => {
  await createProfile(page, 'Alva');
  await seedStates(page, { '2x3': { status: 'fluent', box: 3 }, '10x4': { status: 'automatic', box: 5 } });
  await openParent(page);
  await parentSettings(page);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Spara säkerhetskopia (JSON)' }).click()]);
  expect(download.suggestedFilename()).toBe('mattedalen-alva-2026-02-02.json');
  const file = await download.path();

  const other = await browser.newPage();
  await other.goto('/');
  await openParent(other, '1111', /annan enhet/);
  await other.locator('input[type=file][accept*=json]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: await readFile(file) });
  await expect(other.getByText('Alva är återställd')).toBeVisible();
  await other.getByRole('button', { name: 'Stäng föräldravyn' }).click();
  await enterGarden(other, 'Alva');
  await expect(other.locator('.grid-cell.stage-bush')).toHaveCount(1);
  await expect(other.locator('.grid-cell.stage-tree')).toHaveCount(1);
  await other.close();
});

test('a QR code moves a child to another device', async ({ page, browser }) => {
  await createProfile(page, 'Alva');
  const states: Record<string, { status: string; box: number }> = {};
  for (let n = 1; n <= 10; n++) states[`10x${n}`] = { status: 'automatic', box: 5 };
  for (let n = 1; n <= 9; n++) states[`2x${n}`] = { status: 'fluent', box: 2 };
  states['5x3'] = { status: 'learning', box: 1 };
  await seedStates(page, states);
  // The brook comes along in the same code.
  await seedStates(
    page,
    { '1+1': { status: 'fluent', box: 3 }, '2-1': { status: 'fluent', box: 3 }, '2+1': { status: 'learning', box: 1 } },
    { packId: 'addition', unlockedUnitIds: ['ettmer', 'noll'] },
  );
  await openParent(page);
  await parentSettings(page);
  await page.getByRole('button', { name: 'Visa QR-kod' }).click();
  const qrImage = await page.locator('.qr-code svg').screenshot();

  // A second device: fresh browser, nothing stored.
  const other = await browser.newPage();
  await other.goto('/');
  await openParent(other, '2222', /annan enhet/);
  await other.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'qr.png', mimeType: 'image/png', buffer: qrImage });
  await expect(other.getByRole('heading', { name: 'Hämta Alva?' })).toBeVisible();
  await expect(other.getByText('10 automatiserade, 9 flytande och 1 som övas.')).toBeVisible();
  await expect(other.getByText('0 automatiserade, 2 flytande och 1 som övas.')).toBeVisible();
  await other.getByRole('button', { name: 'Lägg till', exact: true }).click();
  await expect(other.getByText('Alva är hämtad')).toBeVisible();
  await parentPlace(other, 'Bäcken');
  await expect(other.getByRole('region', { name: /^Bäcken/ }).locator('.brook-parts li').first()).toContainText('plus 1 av 19 · minus 1 av 19');
  await parentBack(other);

  await other.getByRole('button', { name: 'Stäng föräldravyn' }).click();
  await enterGarden(other, 'Alva');
  await expect(other.locator('.grid-cell.stage-tree')).toHaveCount(10);
  await expect(other.locator('.grid-cell.stage-bush')).toHaveCount(9);
  await expect(other.locator('.grid-cell.stage-sprout')).toHaveCount(1);
  await other.getByRole('button', { name: 'Till dalen' }).click();
  await other.getByRole('button', { name: /^Bäcken\./ }).click();
  await expect(other.locator('.place-now')).toHaveText('Nu: Ett mer, ett mindre');
  await other.close();
});

test('a profile can be deleted', async ({ page }) => {
  await createProfile(page, 'Alva');
  await switchPlayer(page);
  await page.getByRole('button', { name: 'Ny spelare' }).click();
  await createProfile(page, 'Bo');
  await switchPlayer(page);
  await openParent(page);
  await parentSettings(page);
  await page.getByRole('button', { name: 'Ta bort Alva…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ta bort' }).click();
  await expect(page.getByText('Alva är borttagen')).toBeVisible();
  await expect(page.locator('.parent-tab')).toHaveCount(1);
});

test('the camera is turned off when a scan is replaced or the parent view is left', async ({ page }) => {
  // A stand-in camera that counts its live tracks.
  await page.addInitScript(() => {
    const live = new Set<MediaStreamTrack>();
    (window as unknown as { liveTracks: () => number }).liveTracks = () => live.size;
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      canvas.getContext('2d')!.fillRect(0, 0, 64, 64);
      const stream = canvas.captureStream();
      for (const track of stream.getTracks()) {
        live.add(track);
        const stop = track.stop.bind(track);
        track.stop = () => {
          live.delete(track);
          stop();
        };
      }
      return stream;
    };
  });
  await page.reload();
  const liveTracks = () => page.evaluate(() => (window as unknown as { liveTracks: () => number }).liveTracks());

  await createProfile(page, 'Alva', 'brook');
  await page.getByRole('button', { name: 'Börja från början' }).click();
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await page.getByRole('button', { name: 'Byt spelare' }).click();
  await openParent(page);
  await parentLink(page, 'Hämta ett barn');
  await page.getByRole('button', { name: 'Skanna QR-kod' }).click();
  await expect.poll(liveTracks).toBe(1);
  // Scanning again replaces the first camera instead of adding a second.
  await page.getByRole('button', { name: 'Skanna QR-kod' }).click();
  await expect.poll(liveTracks).toBe(1);
  // Leaving the page mid-scan turns the camera off.
  await page.getByRole('button', { name: 'Tillbaka' }).click();
  await page.clock.runFor(1000);
  await expect.poll(liveTracks).toBe(0);
});

test('the phone back button goes from a page to the overview, then out of "För vuxna"', async ({ page }) => {
  await createProfile(page, 'Alva');
  await switchPlayer(page);
  await openParent(page);
  await parentPlace(page, 'Bäcken');
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'För vuxna' })).toBeVisible();
  await parentSettings(page);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'För vuxna' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Vem spelar?' })).toBeVisible();
});

test('"Att göra för dig" lists what waits for a grown-up, and a thing goes when it is done', async ({ page }) => {
  await createProfile(page, 'Alva', 'brook');
  await page.getByRole('button', { name: 'Börja från början' }).click();
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await page.getByRole('button', { name: 'Byt spelare' }).click();
  await openParent(page);
  const todo = page.getByRole('region', { name: 'Att göra för dig' });
  await expect(todo.getByText(/^Stigen: Stigen är inte öppen än\./)).toBeVisible();
  await expect(todo.getByText(/^Trädgården: Trädgården är inte öppen än\./)).toBeVisible();
  // Done here: the garden opens, and it goes from the list. It cannot be put away otherwise.
  await todo.getByRole('button', { name: 'Öppna Trädgården nu' }).click();
  await expect(page.getByRole('region', { name: 'Att göra för dig' }).getByText(/^Trädgården:/)).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Att göra för dig' }).getByText(/^Stigen:/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Dölj|Avfärda/ })).toHaveCount(0);

  // A row per place: what the child is on, and how much sits.
  const brook = page.locator('.place-row', { has: page.locator('strong', { hasText: /^Bäcken$/ }) });
  await expect(brook).toContainText('Nu: Ett mer, ett mindre');
  await expect(brook.locator('.known-text')).toHaveText(/^0 av \d+ sitter$/);
});

test('a new check result waits in "Att göra" until its place has been looked at', async ({ page }) => {
  await createProfile(page, 'Alva');
  await switchPlayer(page);
  // A check done in the garden.
  await page.evaluate(async () => {
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
      tx.objectStore('sessions').put({ id: 'check-1', profileId: profiles[0]!.id, packId: 'multiplication', mode: 'check', day: '2026-02-02', startedAt: 1, endedAt: 2, answered: 0, correct: 0, introduced: [] });
      tx.oncomplete = r;
    });
    db.close();
  });
  await openParent(page);
  const todo = page.getByRole('region', { name: 'Att göra för dig' });
  await expect(todo.getByText('Trädgården: Ett nytt kollresultat för Alva.')).toBeVisible();
  await todo.getByRole('button', { name: 'Visa kollen' }).click();
  await expect(page.getByRole('region', { name: /^Trädgården/ }).getByRole('heading', { name: 'Trädgårdens koll' })).toBeVisible();
  await parentBack(page);
  await expect(page.getByText('Ett nytt kollresultat för Alva.')).toHaveCount(0);
});

test('"Svåra just nu" shows five at first, and all with "Visa alla"', async ({ page }) => {
  await createProfile(page, 'Bo');
  const hard = { status: 'learning', box: 1, wrongDays: 3, introducedDay: '2026-01-20' };
  await seedStates(page, Object.fromEntries(['3x6', '3x7', '3x8', '4x6', '4x7', '4x8', '6x7'].map((id) => [id, hard])));
  await page.goto('/');
  await openParent(page);
  // The overview names the hardest one, the smallest first.
  await expect(page.locator('.place-row', { has: page.locator('strong', { hasText: /^Trädgården$/ }) })).toContainText('Svårast: 3 × 6 = 18');
  await parentPlace(page, 'Trädgården');
  const list = page.locator('.hard-list li');
  await expect(list).toHaveCount(7);
  await expect(page.locator('.hard-list li:visible')).toHaveCount(5);
  await page.getByRole('button', { name: 'Visa alla 7' }).click();
  await expect(page.locator('.hard-list li:visible')).toHaveCount(7);
  await expect(page.getByRole('button', { name: /^Visa alla/ })).toHaveCount(0);
});

test('"Ge mer tid": suggested for a child who is right but slow, and a choice in the child’s settings', async ({ page }) => {
  await createProfile(page, 'Alva');
  // Ten facts right on two days, but never under 5 s; even the quickest take 6 s.
  const slow = (n: number) => ({
    status: 'learning',
    box: 1,
    introducedDay: '2026-01-20',
    dayBest: { '2026-01-28': { choice: 6000 + n * 100 }, '2026-01-30': { choice: 6200 + n * 100 } },
  });
  await seedStates(page, Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => [`10x${n}`, slow(n)])));
  await openParent(page);
  const todo = page.getByRole('region', { name: 'Att göra för dig' });
  await expect(todo.getByText(/^Alva svarar rätt men långsamt på 10 fakta\. De blir inte buskar förrän svaren går under 5 s\./)).toBeVisible();
  await todo.getByRole('button', { name: 'Ge mer tid' }).click();
  await expect(page.getByText(/svarar rätt men långsamt/)).toHaveCount(0);

  await parentSettings(page);
  const more = page.getByRole('checkbox', { name: 'Ge mer tid' });
  await expect(more).toBeChecked();
  await expect(page.getByText(/En buske kräver då svar under 10 s i stället för 5 s, och ett träd under 8 s i stället för 4 s\./)).toBeVisible();
  // Off again: the suggestion comes back. (The first "Sparat" goes first, so the next one is this one.)
  await expect(page.locator('.toast')).toHaveCount(0);
  await more.uncheck();
  await expect(page.getByText('Sparat')).toBeVisible();
  await parentBack(page);
  await expect(page.getByRole('region', { name: 'Att göra för dig' }).getByRole('button', { name: 'Ge mer tid' })).toBeVisible();
});

test('"Fil till piloten": the child’s answers under a pilot code, without the name, saved on the device', async ({ page }) => {
  await createProfile(page, 'Alva');
  await page.getByRole('button', { name: 'Vattna trädgården' }).click();
  await untilIntro(page);
  await passIntro(page);
  await answer(page);
  await expect(page.locator('.feedback, .numpad-display.correct, .choice.correct').first()).toBeVisible();
  await page.goto('/');
  await openParent(page);
  await parentSettings(page);
  await page.getByRole('button', { name: 'Fil till piloten…' }).click();
  await expect(page.getByRole('heading', { name: 'Fil till piloten' })).toBeVisible();
  await expect(page.getByText(/^Alla svar: \d+ stycken/)).toBeVisible();
  await expect(page.getByText('Namnet Alva och djuret. Barnet heter bara pilotkoden i filen.')).toBeVisible();
  // A code is needed, of letters and digits.
  await page.getByRole('button', { name: 'Spara filen' }).click();
  await expect(page.getByRole('alert')).toHaveText('Skriv en pilotkod med bokstäver och siffror, till exempel P03.');
  await page.getByRole('textbox', { name: 'Pilotkod' }).fill('p03');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Spara filen' }).click()]);
  expect(download.suggestedFilename()).toBe('mattedalen-pilot-P03-2026-02-02.json');
  const text = await readFile((await download.path())!, 'utf8');
  const file = JSON.parse(text);
  expect(file).toMatchObject({ format: 'mattedalen-pilot', code: 'P03' });
  expect(file.attempts.length).toBeGreaterThan(0);
  expect(text).not.toContain('Alva');
  // Back to the child's settings; the code is kept for the child.
  await page.getByRole('button', { name: 'Tillbaka' }).click();
  await expect(page.getByRole('heading', { name: 'Alvas inställningar' })).toBeVisible();
  await page.getByRole('button', { name: 'Fil till piloten…' }).click();
  await expect(page.getByRole('textbox', { name: 'Pilotkod' })).toHaveValue('P03');
});

test('"Tyck till": a mail to the project from the grown-up’s own mail app, with the version and nothing about the child', async ({ page }) => {
  await createProfile(page, 'Alva');
  await page.goto('/');
  await openParent(page);
  await parentLink(page, 'Tyck till');
  await expect(page.getByText('matematikdalen@gmail.com')).toBeVisible();
  const href = await page.getByRole('link', { name: 'Skriv ett mejl' }).getAttribute('href');
  expect(href).toMatch(/^mailto:matematikdalen@gmail\.com\?subject=/);
  const body = decodeURIComponent(new URL(href!).searchParams.get('body') ?? '');
  expect(body).toContain('Barnets ålder:');
  expect(body).toMatch(/Appens version: \S+/);
  expect(body).not.toContain('Alva');
  await parentBack(page);
});
