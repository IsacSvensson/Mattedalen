import { expect, test, type Page } from '@playwright/test';
import { introHeading, openParent, parentLink } from './helpers';

/** The grown-ups' first start on a device without children (docs/PLAN-ENKLARE.md, E2). */

const skip = (page: Page) => page.getByRole('button', { name: 'Hoppa över' });
const childScreen = (page: Page) => page.getByRole('heading', { name: 'Vad heter du?' });

async function readDb(page: Page): Promise<{ profiles: { name: string; avatar: string; settings: Record<string, unknown> }[]; settings: Record<string, unknown> }> {
  return page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((r) => {
      const q = indexedDB.open('mattedalen');
      q.onsuccess = () => r(q.result);
    });
    const all = <T>(store: string): Promise<T[]> =>
      new Promise((r) => {
        const q = db.transaction(store).objectStore(store).getAll();
        q.onsuccess = () => r(q.result as T[]);
      });
    const keys: string[] = await new Promise((r) => {
      const q = db.transaction('settings').objectStore('settings').getAllKeys();
      q.onsuccess = () => r(q.result as string[]);
    });
    const values = await all<unknown>('settings');
    const profiles = await all<{ name: string; avatar: string; settings: Record<string, unknown> }>('profiles');
    db.close();
    return { profiles, settings: Object.fromEntries(keys.map((k, i) => [k, values[i]])) };
  });
}

/** From the welcome to the questions about the child, choosing the code 2580. */
async function toChildStep(page: Page): Promise<void> {
  await page.goto('/');
  await expect(introHeading(page)).toBeVisible();
  await page.getByRole('button', { name: 'Kom igång' }).click();
  await expect(page.getByRole('heading', { name: 'Lägg till appen på hemskärmen' })).toBeVisible();
  await page.getByRole('button', { name: 'Fortsätt här' }).click();
  await expect(page.getByRole('heading', { name: 'Välj en vuxenkod' })).toBeVisible();
  await page.keyboard.type('2580');
  await expect(page.getByRole('heading', { name: 'Skriv koden igen' })).toBeVisible();
  await page.keyboard.type('2580');
  await expect(page.getByRole('heading', { name: 'Om barnet' })).toBeVisible();
}

test('a new device: what the app is, the home screen, the code and the child, then the child chooses an animal and the start check begins', async ({ page }) => {
  await page.goto('/');
  await expect(introHeading(page)).toBeVisible();
  await expect(page.locator('.about-facts li')).toHaveCount(4);
  await expect(page.locator('.about-facts')).toContainText('Inget skickas, och inget spåras.');
  await expect(page.getByRole('img', { name: 'Steg 1 av 4' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Hämta det här/ })).toBeVisible();

  await toChildStep(page);
  await expect(page.getByRole('img', { name: 'Steg 4 av 4' })).toBeVisible();
  const handOver = page.getByRole('button', { name: /^Lämna över/ });
  await expect(handOver).toBeDisabled();
  await page.getByRole('textbox', { name: 'Namn' }).fill('Bosse');
  await expect(handOver).toHaveText('Lämna över till Bosse');
  // Not before the question about the start check is answered.
  await expect(handOver).toBeDisabled();
  await page.getByRole('button', { name: 'Ja eller kanske' }).click();
  await page.getByRole('combobox', { name: 'Tid per dag' }).selectOption('15');
  await handOver.click();

  // The child's turn: an animal, and the start check right away, without the question.
  await expect(page.getByRole('heading', { name: 'Hej Bosse!' })).toBeVisible();
  await page.getByRole('button', { name: 'Välj groda' }).click();
  await page.getByRole('button', { name: 'Klar' }).click();
  await expect(page.locator('.placement-run')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Kan du redan lite plus och minus?' })).toHaveCount(0);

  const db = await readDb(page);
  expect(db.profiles).toHaveLength(1);
  expect(db.profiles[0]).toMatchObject({ name: 'Bosse', avatar: '🐸', settings: { sessionMinutes: 15, readAloud: false } });
  expect(db.settings).toMatchObject({ grownUpIntro: 'done', parentPin: '2580' });
});

test('"Nej" about plus and minus: the brook from the beginning, without asking the child', async ({ page }) => {
  await toChildStep(page);
  await page.getByRole('textbox', { name: 'Namn' }).fill('Bosse');
  await page.getByRole('button', { name: 'Nej' }).click();
  await page.getByRole('button', { name: 'Lämna över till Bosse' }).click();
  await page.getByRole('button', { name: 'Klar' }).click();
  await expect(page.getByRole('heading', { name: 'Bosses bäck' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hoppa på stenarna' })).toBeVisible();
});

test('"Hoppa över" on every step leads to the child\'s own screen, and the first start does not come back', async ({ page }) => {
  // On the welcome.
  await page.goto('/');
  await skip(page).click();
  await expect(childScreen(page)).toBeVisible();
  await expect(page.getByText('Välkommen till Mattedalen!')).toBeVisible();
  await page.reload();
  await expect(childScreen(page)).toBeVisible();
  await expect(introHeading(page)).toHaveCount(0);
});

for (const step of ['home', 'pin', 'child'] as const) {
  test(`"Hoppa över" on the step "${step}"`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Kom igång' }).click();
    if (step !== 'home') await page.getByRole('button', { name: 'Fortsätt här' }).click();
    if (step === 'child') await page.getByRole('button', { name: 'Senare' }).click();
    await skip(page).click();
    await expect(childScreen(page)).toBeVisible();
    expect((await readDb(page)).settings).toMatchObject({ grownUpIntro: 'skipped' });
  });
}

test('"Senare" leaves the code for later: it is chosen the first time "För vuxna" opens, as before', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Kom igång' }).click();
  await page.getByRole('button', { name: 'Fortsätt här' }).click();
  await page.getByRole('button', { name: 'Senare' }).click();
  await page.getByRole('textbox', { name: 'Namn' }).fill('Bosse');
  await page.getByRole('button', { name: 'Nej' }).click();
  await page.getByRole('button', { name: 'Lämna över till Bosse' }).click();
  await page.getByRole('button', { name: 'Klar' }).click();
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await page.getByRole('button', { name: 'Byt spelare' }).click();
  await page.getByRole('button', { name: 'För vuxna' }).click();
  await expect(page.getByRole('heading', { name: 'Välj en vuxenkod' })).toBeVisible();
});

test('no home-screen step when the app is already on the home screen', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (q: string) => (q.includes('display-mode: standalone') ? ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList) : original(q));
  });
  await page.goto('/');
  await expect(page.getByRole('img', { name: 'Steg 1 av 3' })).toBeVisible();
  await page.getByRole('button', { name: 'Kom igång' }).click();
  await expect(page.getByRole('heading', { name: 'Välj en vuxenkod' })).toBeVisible();
});

test.describe('on an iPhone', () => {
  test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  test('the home screen first, and why', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Kom igång' }).click();
    await expect(page.getByText(/På iPhone och iPad har den egen lagring/)).toBeVisible();
  });
});

test('with a Swedish voice on the device: "Läser barnet själv?", and "Inte än" turns reading aloud on', async ({ page }) => {
  await page.addInitScript(() => {
    class FakeUtterance {
      lang = '';
      rate = 1;
      voice: unknown = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance });
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        getVoices: () => [{ lang: 'sv-SE', name: 'Alva', localService: true }],
        speak: (u: FakeUtterance) => setTimeout(() => u.onend?.(), 10),
        cancel: () => undefined,
        addEventListener: () => undefined,
      },
    });
  });
  await toChildStep(page);
  await page.getByRole('textbox', { name: 'Namn' }).fill('Bosse');
  await page.getByRole('button', { name: 'Nej' }).click();
  const handOver = page.getByRole('button', { name: 'Lämna över till Bosse' });
  await expect(handOver).toBeDisabled();
  await page.getByRole('group', { name: 'Läser barnet själv?' }).getByRole('button', { name: 'Inte än' }).click();
  await handOver.click();
  await page.getByRole('button', { name: 'Klar' }).click();
  await expect(page.getByRole('heading', { name: 'Bosses bäck' })).toBeVisible();
  expect((await readDb(page)).profiles[0]?.settings).toMatchObject({ readAloud: true });
});

test('without a voice the question is not asked, and the page says why', async ({ page }) => {
  await toChildStep(page);
  await expect(page.getByRole('group', { name: 'Läser barnet själv?' })).toHaveCount(0);
  await expect(page.getByText(/Den här enheten har ingen svensk röst/)).toBeVisible();
});

test('a child from another device: "Hämta det här" on the welcome', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Hämta det här/ }).click();
  await expect(page.getByRole('heading', { name: 'Välj en vuxenkod' })).toBeVisible();
  await page.keyboard.type('2580');
  await expect(page.getByRole('heading', { name: 'Skriv koden igen' })).toBeVisible();
  await page.keyboard.type('2580');
  await expect(page.getByRole('heading', { name: 'Hämta ett barn', level: 1 })).toBeVisible();
});

test('"Så fungerar Mattedalen" in "För vuxna": the same four lines', async ({ page }) => {
  await toChildStep(page);
  await page.getByRole('textbox', { name: 'Namn' }).fill('Bosse');
  await page.getByRole('button', { name: 'Nej' }).click();
  await page.getByRole('button', { name: 'Lämna över till Bosse' }).click();
  await page.getByRole('button', { name: 'Klar' }).click();
  await page.getByRole('button', { name: 'Till dalen' }).click();
  await page.getByRole('button', { name: 'Byt spelare' }).click();
  await openParent(page);
  await parentLink(page, 'Så fungerar Mattedalen');
  await expect(page.locator('.about-facts li')).toHaveCount(4);
});
